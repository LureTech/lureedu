package br.com.lure.growth.community;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.CommentDto;
import br.com.lure.growth.common.Messages;
import br.com.lure.growth.common.TextUtils;
import br.com.lure.growth.common.TimeUtils;
import br.com.lure.growth.common.UserLocks;
import br.com.lure.growth.community.CommunityDtos.CommunityStatsDto;
import br.com.lure.growth.community.CommunityDtos.LikeResponse;
import br.com.lure.growth.community.CommunityDtos.NewCountResponse;
import br.com.lure.growth.community.CommunityDtos.PostDto;
import br.com.lure.growth.community.CommunityDtos.TagCount;
import br.com.lure.growth.community.CommunityDtos.VoiceDto;
import br.com.lure.growth.notification.NotificationService;
import br.com.lure.growth.notification.NotificationType;
import br.com.lure.growth.storage.StorageService;
import br.com.lure.growth.storage.StorageService.Folder;
import br.com.lure.growth.user.AuthorDto;
import br.com.lure.growth.user.User;
import br.com.lure.growth.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class CommunityService {

    public static final int MAX_BODY = 500;
    public static final int MAX_COMMENT = 300;
    public static final int DAILY_LIMIT = 10;
    public static final Duration COOLDOWN = Duration.ofSeconds(30);
    public static final long IMAGE_MAX_BYTES = 2L * 1024 * 1024;
    private static final String LINK = "/comunidade";
    /** Quantos posts recentes entram no ranking "Em alta" (o decaimento por idade cuida do resto). */
    static final int HOT_CANDIDATES = 500;
    static final int PREVIEW_COMMENTS = 2;
    static final int TOP_VOICES = 5;
    static final int MAX_QUERY = 60;
    /** #palavra: letras (com acento), dígitos e _. Não casa no meio de palavras ("abc#x"). */
    private static final Pattern HASHTAG = Pattern.compile("(?<![\\p{L}\\p{N}_#])#([\\p{L}\\p{N}_]{1,50})");

    private final PostRepository posts;
    private final PostLikeRepository likes;
    private final PostCommentRepository comments;
    private final UserRepository users;
    private final StorageService storage;
    private final NotificationService notifications;
    private final UserLocks userLocks;
    private final EntityManager em;

    public CommunityService(PostRepository posts, PostLikeRepository likes, PostCommentRepository comments,
                            UserRepository users, StorageService storage, NotificationService notifications,
                            UserLocks userLocks, EntityManager em) {
        this.posts = posts;
        this.likes = likes;
        this.comments = comments;
        this.users = users;
        this.storage = storage;
        this.notifications = notifications;
        this.userLocks = userLocks;
        this.em = em;
    }

    // ------------------------------------------------------------------ feed

    /** Filtros do feed (todos opcionais; {@code tag} sem "#" e em minúsculas, {@code query} em minúsculas). */
    record FeedFilter(String category, String tag, String query, boolean unanswered) {
    }

    /**
     * Feed paginado. {@code sort=recent} (padrão): mais novos primeiro, paginado por {@code before}.
     * {@code sort=hot}: "Em alta" — engajamento com decaimento por idade (ver {@link #hotScore}), paginado por
     * {@code offset}. Filtros: categoria, hashtag exata, busca no texto/nome do autor e "sem resposta".
     */
    @Transactional(readOnly = true)
    public List<PostDto> feed(String sort, String rawCategory, String rawTag, String rawQuery, boolean unanswered,
                              Instant before, int offset, int limit, AuthUser me) {
        int size = Math.max(1, Math.min(limit, 50));
        FeedFilter filter = new FeedFilter(categoryFilter(rawCategory), tagFilter(rawTag), queryFilter(rawQuery),
                unanswered);
        List<CommunityPost> page = switch (sort == null ? "recent" : sort.strip().toLowerCase(Locale.ROOT)) {
            case "", "recent" -> recentPage(filter, before, size);
            case "hot" -> hotPage(filter, Math.max(0, offset), size);
            default -> throw ApiException.badRequest("Ordenação inválida.");
        };
        return toDtos(page, me);
    }

    @Transactional(readOnly = true)
    public PostDto post(UUID postId, AuthUser me) {
        return toDtos(List.of(requirePost(postId)), me).get(0);
    }

    /** Quantas publicações de outras pessoas chegaram desde {@code since} + até 3 autores delas. */
    @Transactional(readOnly = true)
    public NewCountResponse newCount(Instant since, String rawCategory, AuthUser me) {
        if (since == null) {
            return new NewCountResponse(0, List.of());
        }
        String category = categoryFilter(rawCategory);
        long count = category == null
                ? posts.countByCreatedAtAfterAndUserIdNot(since, me.id())
                : posts.countByCreatedAtAfterAndUserIdNotAndCategory(since, me.id(), category);
        if (count == 0) {
            return new NewCountResponse(0, List.of());
        }
        String jpql = "select p.userId from CommunityPost p where p.createdAt > :since and p.userId <> :me"
                + (category != null ? " and p.category = :category" : "") + " order by p.createdAt desc";
        TypedQuery<UUID> query = em.createQuery(jpql, UUID.class)
                .setParameter("since", since).setParameter("me", me.id()).setMaxResults(20);
        if (category != null) {
            query.setParameter("category", category);
        }
        List<UUID> authorIds = query.getResultList().stream().distinct().limit(3).toList();
        Map<UUID, User> byId = usersById(new HashSet<>(authorIds));
        List<AuthorDto> authors = authorIds.stream()
                .map(id -> byId.containsKey(id) ? AuthorDto.from(byId.get(id)) : AuthorDto.unknown(id))
                .toList();
        return new NewCountResponse(count, authors);
    }

    /** Cronológico. Com filtro de hashtag o LIKE traz falsos positivos (#vendas ⊂ #vendasb2b): busca em lotes. */
    private List<CommunityPost> recentPage(FeedFilter f, Instant before, int size) {
        List<CommunityPost> out = new ArrayList<>(size);
        Instant cursor = before;
        int batch = f.tag() != null ? size * 2 : size;
        for (int round = 0; round < 10 && out.size() < size; round++) {
            List<CommunityPost> chunk = filteredQuery(f, cursor).setMaxResults(batch).getResultList();
            for (CommunityPost p : chunk) {
                if (out.size() < size && hasTag(p, f.tag())) {
                    out.add(p);
                }
            }
            if (chunk.size() < batch) {
                break;
            }
            cursor = chunk.get(chunk.size() - 1).getCreatedAt();
        }
        return out;
    }

    /** "Em alta": ranqueia os {@link #HOT_CANDIDATES} posts mais recentes que passam no filtro. */
    private List<CommunityPost> hotPage(FeedFilter f, int offset, int size) {
        List<CommunityPost> candidates = filteredQuery(f, null).setMaxResults(HOT_CANDIDATES).getResultList().stream()
                .filter(p -> hasTag(p, f.tag()))
                .toList();
        if (candidates.isEmpty() || offset >= candidates.size()) {
            return List.of();
        }
        Set<UUID> ids = candidates.stream().map(CommunityPost::getId).collect(Collectors.toSet());
        Map<UUID, Long> likeCounts = countMap(likes.countByPosts(ids));
        Map<UUID, Long> commentCounts = countMap(comments.countByPosts(ids));
        Instant now = TimeUtils.now();
        Map<UUID, Double> score = new HashMap<>();
        for (CommunityPost p : candidates) {
            score.put(p.getId(), hotScore(likeCounts.getOrDefault(p.getId(), 0L),
                    commentCounts.getOrDefault(p.getId(), 0L), p.getCreatedAt(), now));
        }
        return candidates.stream()
                .sorted(Comparator.comparingDouble((CommunityPost p) -> score.get(p.getId())).reversed()
                        .thenComparing(CommunityPost::getCreatedAt, Comparator.reverseOrder()))
                .skip(offset)
                .limit(size)
                .toList();
    }

    /**
     * Pontuação "em alta" (estilo Hacker News): engajamento dividido pela idade elevada a 1,5.
     * Comentário vale o dobro da curtida — conversa é o que a comunidade quer ver.
     */
    static double hotScore(long likesCount, long commentsCount, Instant createdAt, Instant now) {
        double hours = Math.max(0, Duration.between(createdAt, now).toMinutes() / 60.0);
        return (1 + likesCount + 2.0 * commentsCount) / Math.pow(hours + 2, 1.5);
    }

    private TypedQuery<CommunityPost> filteredQuery(FeedFilter f, Instant before) {
        StringBuilder jpql = new StringBuilder("select p from CommunityPost p where 1 = 1");
        Map<String, Object> params = new HashMap<>();
        if (f.category() != null) {
            jpql.append(" and p.category = :category");
            params.put("category", f.category());
        }
        if (f.tag() != null) {
            jpql.append(" and lower(p.body) like :tag escape '!'");
            params.put("tag", "%#" + escapeLike(f.tag()) + "%");
        }
        if (f.query() != null) {
            jpql.append(" and (lower(p.body) like :q escape '!' or p.userId in "
                    + "(select u.id from User u where lower(u.fullName) like :q escape '!'))");
            params.put("q", "%" + escapeLike(f.query()) + "%");
        }
        if (f.unanswered()) {
            jpql.append(" and not exists (select c.id from PostComment c where c.postId = p.id)");
        }
        if (before != null) {
            jpql.append(" and p.createdAt < :before");
            params.put("before", before);
        }
        jpql.append(" order by p.createdAt desc, p.id desc");
        TypedQuery<CommunityPost> query = em.createQuery(jpql.toString(), CommunityPost.class);
        params.forEach(query::setParameter);
        return query;
    }

    /** Confere a hashtag exata (o LIKE do banco também casa prefixos). */
    private static boolean hasTag(CommunityPost p, String tag) {
        if (tag == null) {
            return true;
        }
        Matcher m = HASHTAG.matcher(p.getBody() == null ? "" : p.getBody());
        while (m.find()) {
            if (m.group(1).toLowerCase(Locale.ROOT).equals(tag)) {
                return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------------ posts

    public PostDto create(String rawBody, String rawCategory, MultipartFile image, Integer width, Integer height,
                          AuthUser me) {
        String category = PostCategories.resolve(rawCategory)
                .orElseThrow(() -> ApiException.badRequest("Escolha uma categoria válida."));
        String body = rawBody == null ? "" : rawBody.strip();
        if (body.length() > MAX_BODY) {
            throw ApiException.badRequest("O texto pode ter no máximo 500 caracteres.");
        }
        boolean hasImage = image != null && !image.isEmpty();
        if (body.isEmpty() && !hasImage) {
            throw ApiException.badRequest("Escreva alguma coisa ou anexe uma imagem.");
        }

        return userLocks.inTransaction(me.id(), () -> {
            Instant now = TimeUtils.now();
            if (posts.countByUserIdAndCreatedAtAfter(me.id(), now.minus(Duration.ofHours(24))) >= DAILY_LIMIT) {
                throw ApiException.tooManyRequests("Você atingiu o limite de 10 publicações por dia.");
            }
            posts.findFirstByUserIdOrderByCreatedAtDesc(me.id())
                    .filter(last -> last.getCreatedAt().isAfter(now.minus(COOLDOWN)))
                    .ifPresent(last -> {
                        throw ApiException.tooManyRequests("Aguarde alguns segundos antes de publicar de novo.");
                    });

            String imagePath = null;
            Integer w = null;
            Integer h = null;
            if (hasImage) {
                imagePath = storage.storeImage(image, Folder.COMMUNITY, IMAGE_MAX_BYTES,
                        "A imagem deve ter no máximo 2 MB.").path();
                if (validDimension(width) && validDimension(height)) {
                    w = width;
                    h = height;
                }
            }
            CommunityPost post = posts.save(new CommunityPost(me.id(), category, body, imagePath, w, h, now));
            User author = users.findById(me.id()).orElseThrow();
            if (author.isAdmin()) {
                String excerpt = TextUtils.excerpt(body, 140);
                notifications.notifyCommunity(me.id(), "Nova publicação da equipe LURE",
                        excerpt != null ? excerpt : "Uma nova imagem foi compartilhada na comunidade.",
                        linkTo(post.getId()));
            }
            return toDto(post, author, 0, 0, false, List.of(), me);
        });
    }

    @Transactional
    public void delete(UUID postId, AuthUser me) {
        CommunityPost post = requirePost(postId);
        if (!me.isAdmin() && !post.getUserId().equals(me.id())) {
            throw ApiException.forbidden(Messages.NO_PERMISSION);
        }
        storage.deleteAfterCommit(post.getImagePath());
        posts.delete(post);
    }

    // ------------------------------------------------------------------ curtidas

    public LikeResponse like(UUID postId, AuthUser me) {
        return userLocks.inTransaction(me.id(), () -> {
            CommunityPost post = requirePost(postId);
            if (!likes.existsByPostIdAndUserId(postId, me.id())) {
                likes.saveAndFlush(new PostLike(postId, me.id(), TimeUtils.now()));
                String actor = users.findById(me.id()).map(User::displayName).orElse("Alguém");
                notifications.notifyReply(post.getUserId(), me.id(), NotificationType.LIKE,
                        actor + " curtiu sua publicação", TextUtils.excerpt(post.getBody(), 120), linkTo(postId));
            }
            return new LikeResponse(true, likes.countByPostId(postId));
        });
    }

    public LikeResponse unlike(UUID postId, AuthUser me) {
        return userLocks.inTransaction(me.id(), () -> {
            requirePost(postId);
            likes.deleteByPostAndUser(postId, me.id());
            return new LikeResponse(false, likes.countByPostId(postId));
        });
    }

    // ------------------------------------------------------------------ comentários

    @Transactional(readOnly = true)
    public List<CommentDto> listComments(UUID postId, AuthUser me) {
        CommunityPost post = requirePost(postId);
        List<PostComment> list = comments.findByPostOldestFirst(postId);
        Map<UUID, User> authors = usersById(list.stream().map(PostComment::getUserId).collect(Collectors.toSet()));
        return list.stream().map(c -> toCommentDto(c, authors.get(c.getUserId()), post, me)).toList();
    }

    @Transactional
    public CommentDto addComment(UUID postId, String rawBody, AuthUser me) {
        CommunityPost post = requirePost(postId);
        String body = rawBody == null ? "" : rawBody.strip();
        if (body.isEmpty()) {
            throw ApiException.badRequest("Escreva um comentário.");
        }
        if (body.length() > MAX_COMMENT) {
            throw ApiException.badRequest("O comentário pode ter no máximo 300 caracteres.");
        }
        PostComment saved = comments.save(new PostComment(postId, me.id(), body, TimeUtils.now()));
        User author = users.findById(me.id()).orElseThrow();
        notifications.notifyReply(post.getUserId(), me.id(), NotificationType.COMMENT,
                author.displayName() + " comentou na sua publicação", TextUtils.excerpt(body, 120), linkTo(postId));
        return toCommentDto(saved, author, post, me);
    }

    /** Pode apagar: autor do comentário, autor do post ou admin. */
    @Transactional
    public void deleteComment(UUID commentId, AuthUser me) {
        PostComment comment = comments.findById(commentId)
                .orElseThrow(() -> ApiException.notFound(Messages.COMMENT_NOT_FOUND));
        CommunityPost post = posts.findById(comment.getPostId()).orElse(null);
        if (!canDeleteComment(comment, post, me)) {
            throw ApiException.forbidden(Messages.NO_PERMISSION);
        }
        comments.delete(comment);
    }

    // ------------------------------------------------------------------ estatísticas

    @Transactional(readOnly = true)
    public CommunityStatsDto stats(AuthUser me) {
        Instant now = TimeUtils.now();
        long mine = posts.countByUserIdAndCreatedAtAfter(me.id(), now.minus(Duration.ofHours(24)));
        return new CommunityStatsDto(
                users.countByActiveTrue(),
                posts.countByCreatedAtGreaterThanEqual(TimeUtils.startOfTodaySaoPaulo()),
                posts.count(),
                mine,
                Math.max(0, DAILY_LIMIT - mine),
                topTags(posts.findBodiesSince(now.minus(Duration.ofDays(30)))),
                topVoices(now.minus(Duration.ofDays(7))));
    }

    /** Top 5 de quem mais movimentou (post vale 2, comentário vale 1); só contas ativas. */
    private List<VoiceDto> topVoices(Instant since) {
        Map<UUID, Long> postsBy = userCountMap(posts.countByUserSince(since));
        Map<UUID, Long> commentsBy = userCountMap(comments.countByUserSince(since));
        Set<UUID> ids = new HashSet<>(postsBy.keySet());
        ids.addAll(commentsBy.keySet());
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<UUID, User> byId = usersById(ids);
        return ids.stream()
                .filter(id -> byId.containsKey(id) && byId.get(id).isActive())
                .map(id -> new VoiceDto(AuthorDto.from(byId.get(id)), postsBy.getOrDefault(id, 0L),
                        commentsBy.getOrDefault(id, 0L)))
                .sorted(Comparator.comparingLong((VoiceDto v) -> 2 * v.posts() + v.comments()).reversed()
                        .thenComparing(v -> v.author().fullName()))
                .limit(TOP_VOICES)
                .toList();
    }

    /** Top 6 hashtags (minúsculas, sem "#"), contando cada tag uma vez por post. */
    static List<TagCount> topTags(Collection<String> bodies) {
        Map<String, Long> counts = new HashMap<>();
        for (String body : bodies) {
            if (body == null || body.indexOf('#') < 0) {
                continue;
            }
            Set<String> seen = new LinkedHashSet<>();
            Matcher m = HASHTAG.matcher(body);
            while (m.find()) {
                seen.add(m.group(1).toLowerCase(Locale.ROOT));
            }
            seen.forEach(tag -> counts.merge(tag, 1L, Long::sum));
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(6)
                .map(e -> new TagCount(e.getKey(), e.getValue()))
                .toList();
    }

    // ------------------------------------------------------------------ helpers

    private List<PostDto> toDtos(List<CommunityPost> list, AuthUser me) {
        if (list.isEmpty()) {
            return List.of();
        }
        Set<UUID> ids = list.stream().map(CommunityPost::getId).collect(Collectors.toSet());
        Map<UUID, Long> likeCounts = countMap(likes.countByPosts(ids));
        Map<UUID, Long> commentCounts = countMap(comments.countByPosts(ids));
        Set<UUID> likedByMe = new HashSet<>(likes.findLikedPostIds(me.id(), ids));

        // prévia: os PREVIEW_COMMENTS mais novos de cada post, em ordem cronológica
        Map<UUID, List<PostComment>> latest = new HashMap<>();
        for (PostComment c : comments.findLatestPerPost(ids)) {
            latest.computeIfAbsent(c.getPostId(), k -> new ArrayList<>()).add(c);
        }
        latest.replaceAll((postId, cs) -> cs.subList(Math.max(0, cs.size() - PREVIEW_COMMENTS), cs.size()));

        Set<UUID> userIds = list.stream().map(CommunityPost::getUserId).collect(Collectors.toCollection(HashSet::new));
        latest.values().forEach(cs -> cs.forEach(c -> userIds.add(c.getUserId())));
        Map<UUID, User> byId = usersById(userIds);
        return list.stream()
                .map(p -> toDto(p, byId.get(p.getUserId()), likeCounts.getOrDefault(p.getId(), 0L),
                        commentCounts.getOrDefault(p.getId(), 0L), likedByMe.contains(p.getId()),
                        latest.getOrDefault(p.getId(), List.of()).stream()
                                .map(c -> toCommentDto(c, byId.get(c.getUserId()), p, me))
                                .toList(),
                        me))
                .toList();
    }

    private static PostDto toDto(CommunityPost p, User author, long likesCount, long commentsCount, boolean liked,
                                 List<CommentDto> recentComments, AuthUser me) {
        AuthorDto authorDto = author != null ? AuthorDto.from(author) : AuthorDto.unknown(p.getUserId());
        return new PostDto(p.getId(), p.getCategory(), p.getBody(), StorageService.urlOf(p.getImagePath()),
                p.getImageWidth(), p.getImageHeight(), likesCount, commentsCount, liked, p.getCreatedAt(), authorDto,
                me.isAdmin() || p.getUserId().equals(me.id()), recentComments);
    }

    /** Link da notificação: abre direto a conversa do post. */
    private static String linkTo(UUID postId) {
        return LINK + "?post=" + postId;
    }

    private static Map<UUID, Long> countMap(List<PostCount> rows) {
        return rows.stream().collect(Collectors.toMap(PostCount::getPostId, PostCount::getN));
    }

    private static Map<UUID, Long> userCountMap(List<UserCount> rows) {
        return rows.stream().collect(Collectors.toMap(UserCount::getUserId, UserCount::getN));
    }

    /** Hashtag do filtro: com ou sem "#", minúsculas; formato inválido → 400. */
    private static String tagFilter(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String tag = raw.strip().replaceFirst("^#", "").toLowerCase(Locale.ROOT);
        if (!tag.matches("[\\p{L}\\p{N}_]{1,50}")) {
            throw ApiException.badRequest("Hashtag inválida.");
        }
        return tag;
    }

    private static String queryFilter(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String q = raw.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        return q.length() > MAX_QUERY ? q.substring(0, MAX_QUERY) : q;
    }

    /** Escapa curingas do LIKE (o escape usado nas consultas é "!"). */
    static String escapeLike(String value) {
        return value.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    private static CommentDto toCommentDto(PostComment c, User author, CommunityPost post, AuthUser me) {
        AuthorDto authorDto = author != null ? AuthorDto.from(author) : AuthorDto.unknown(c.getUserId());
        return new CommentDto(c.getId(), c.getBody(), c.getCreatedAt(), authorDto, canDeleteComment(c, post, me));
    }

    private static boolean canDeleteComment(PostComment c, CommunityPost post, AuthUser me) {
        return me.isAdmin() || c.getUserId().equals(me.id()) || (post != null && post.getUserId().equals(me.id()));
    }

    private Map<UUID, User> usersById(Set<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return users.findAllById(ids).stream().collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private CommunityPost requirePost(UUID postId) {
        return posts.findById(postId).orElseThrow(() -> ApiException.notFound(Messages.POST_NOT_FOUND));
    }

    /** Filtro de categoria opcional; valor desconhecido → 400. */
    private static String categoryFilter(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return PostCategories.resolve(raw).orElseThrow(() -> ApiException.badRequest("Categoria inválida."));
    }

    private static boolean validDimension(Integer value) {
        return value != null && value > 0 && value <= 20_000;
    }
}
