package br.com.lure.growth.catalog;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.CommentDto;
import br.com.lure.growth.common.Messages;
import br.com.lure.growth.common.TimeUtils;
import br.com.lure.growth.user.AuthorDto;
import br.com.lure.growth.user.User;
import br.com.lure.growth.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Comentários na página do módulo (1–1000 caracteres). */
@Service
public class ModuleCommentService {

    public static final int MAX_LENGTH = 1000;

    private final CourseAccess access;
    private final ModuleCommentRepository comments;
    private final UserRepository users;

    public ModuleCommentService(CourseAccess access, ModuleCommentRepository comments, UserRepository users) {
        this.access = access;
        this.comments = comments;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<CommentDto> list(String slug, AuthUser me) {
        Course course = access.requireBySlug(slug, me);
        List<ModuleComment> list = comments.findByCourseNewestFirst(course.getId());
        Set<UUID> authorIds = list.stream().map(ModuleComment::getUserId).collect(Collectors.toSet());
        Map<UUID, User> authors = users.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return list.stream().map(c -> toDto(c, authors.get(c.getUserId()), me)).toList();
    }

    @Transactional
    public CommentDto create(String slug, String rawBody, AuthUser me) {
        Course course = access.requireBySlug(slug, me);
        String body = rawBody == null ? "" : rawBody.strip();
        if (body.isEmpty()) {
            throw ApiException.badRequest("Escreva um comentário.");
        }
        if (body.length() > MAX_LENGTH) {
            throw ApiException.badRequest("O comentário pode ter no máximo 1000 caracteres.");
        }
        ModuleComment saved = comments.save(new ModuleComment(course.getId(), me.id(), body, TimeUtils.now()));
        User author = users.findById(me.id()).orElse(null);
        return toDto(saved, author, me);
    }

    @Transactional
    public void delete(UUID commentId, AuthUser me) {
        ModuleComment comment = comments.findById(commentId)
                .orElseThrow(() -> ApiException.notFound(Messages.COMMENT_NOT_FOUND));
        if (!me.isAdmin() && !comment.getUserId().equals(me.id())) {
            throw ApiException.forbidden(Messages.NO_PERMISSION);
        }
        comments.delete(comment);
    }

    private static CommentDto toDto(ModuleComment c, User author, AuthUser me) {
        AuthorDto authorDto = author != null ? AuthorDto.from(author) : AuthorDto.unknown(c.getUserId());
        boolean canDelete = me.isAdmin() || c.getUserId().equals(me.id());
        return new CommentDto(c.getId(), c.getBody(), c.getCreatedAt(), authorDto, canDelete);
    }
}
