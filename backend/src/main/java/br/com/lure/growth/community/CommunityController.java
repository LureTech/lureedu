package br.com.lure.growth.community;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.common.CommentDto;
import br.com.lure.growth.common.CommentDto.CreateCommentRequest;
import br.com.lure.growth.common.TimeUtils;
import br.com.lure.growth.community.CommunityDtos.CommunityStatsDto;
import br.com.lure.growth.community.CommunityDtos.LikeResponse;
import br.com.lure.growth.community.CommunityDtos.NewCountResponse;
import br.com.lure.growth.community.CommunityDtos.PostDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/community")
public class CommunityController {

    private final CommunityService community;

    public CommunityController(CommunityService community) {
        this.community = community;
    }

    /**
     * {@code sort}: recent (padrão, paginado por {@code before}) | hot (em alta, paginado por {@code offset}).
     * Filtros opcionais: {@code category}, {@code tag} (hashtag exata), {@code q} (texto ou nome do autor),
     * {@code unanswered} (sem comentários).
     */
    @GetMapping("/posts")
    public List<PostDto> feed(@RequestParam(required = false) String category,
                              @RequestParam(required = false) String before,
                              @RequestParam(defaultValue = "20") int limit,
                              @RequestParam(defaultValue = "recent") String sort,
                              @RequestParam(required = false) String tag,
                              @RequestParam(required = false) String q,
                              @RequestParam(defaultValue = "false") boolean unanswered,
                              @RequestParam(defaultValue = "0") int offset,
                              @AuthenticationPrincipal AuthUser me) {
        return community.feed(sort, category, tag, q, unanswered, TimeUtils.parseInstant(before, "before"), offset,
                limit, me);
    }

    @GetMapping("/posts/new-count")
    public NewCountResponse newCount(@RequestParam(required = false) String since,
                                     @RequestParam(required = false) String category,
                                     @AuthenticationPrincipal AuthUser me) {
        return community.newCount(TimeUtils.parseInstant(since, "since"), category, me);
    }

    @GetMapping("/posts/{id}")
    public PostDto post(@PathVariable UUID id, @AuthenticationPrincipal AuthUser me) {
        return community.post(id, me);
    }

    /** multipart/form-data (com ou sem imagem); também aceita form-urlencoded quando não há imagem. */
    @PostMapping("/posts")
    public ResponseEntity<PostDto> create(@RequestParam(required = false) String body,
                                          @RequestParam(required = false) String category,
                                          @RequestParam(name = "image", required = false) MultipartFile image,
                                          @RequestParam(required = false) Integer imageWidth,
                                          @RequestParam(required = false) Integer imageHeight,
                                          @AuthenticationPrincipal AuthUser me) {
        PostDto created = community.create(body, category, image, imageWidth, imageHeight, me);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @DeleteMapping("/posts/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @AuthenticationPrincipal AuthUser me) {
        community.delete(id, me);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/posts/{id}/like")
    public LikeResponse like(@PathVariable UUID id, @AuthenticationPrincipal AuthUser me) {
        return community.like(id, me);
    }

    @DeleteMapping("/posts/{id}/like")
    public LikeResponse unlike(@PathVariable UUID id, @AuthenticationPrincipal AuthUser me) {
        return community.unlike(id, me);
    }

    @GetMapping("/posts/{id}/comments")
    public List<CommentDto> comments(@PathVariable UUID id, @AuthenticationPrincipal AuthUser me) {
        return community.listComments(id, me);
    }

    @PostMapping("/posts/{id}/comments")
    public ResponseEntity<CommentDto> addComment(@PathVariable UUID id, @Valid @RequestBody CreateCommentRequest body,
                                                 @AuthenticationPrincipal AuthUser me) {
        return ResponseEntity.status(HttpStatus.CREATED).body(community.addComment(id, body.body(), me));
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Void> deleteComment(@PathVariable UUID id, @AuthenticationPrincipal AuthUser me) {
        community.deleteComment(id, me);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public CommunityStatsDto stats(@AuthenticationPrincipal AuthUser me) {
        return community.stats(me);
    }
}
