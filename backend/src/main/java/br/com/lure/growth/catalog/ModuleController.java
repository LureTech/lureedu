package br.com.lure.growth.catalog;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.catalog.CatalogDtos.DurationRequest;
import br.com.lure.growth.catalog.CatalogDtos.ModuleDetailDto;
import br.com.lure.growth.catalog.CatalogDtos.ProgressUpdateDto;
import br.com.lure.growth.catalog.CatalogDtos.ProgressUpdateRequest;
import br.com.lure.growth.catalog.CatalogDtos.QuizAttemptRequest;
import br.com.lure.growth.catalog.CatalogDtos.QuizDto;
import br.com.lure.growth.catalog.CatalogDtos.QuizResultDto;
import br.com.lure.growth.common.CommentDto;
import br.com.lure.growth.common.CommentDto.CreateCommentRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Módulo (curso), aulas/progresso, comentários do módulo e prova final. */
@RestController
public class ModuleController {

    private final ModuleService modules;
    private final ProgressService progress;
    private final ModuleCommentService comments;
    private final QuizService quiz;

    public ModuleController(ModuleService modules, ProgressService progress, ModuleCommentService comments,
                            QuizService quiz) {
        this.modules = modules;
        this.progress = progress;
        this.comments = comments;
        this.quiz = quiz;
    }

    @GetMapping("/api/modules/{slug}")
    public ModuleDetailDto detail(@PathVariable String slug, @AuthenticationPrincipal AuthUser me) {
        return modules.detail(slug, me);
    }

    @PutMapping("/api/lessons/{lessonId}/progress")
    public ProgressUpdateDto updateProgress(@PathVariable UUID lessonId,
                                            @Valid @RequestBody ProgressUpdateRequest body,
                                            @AuthenticationPrincipal AuthUser me) {
        return progress.update(lessonId, body, me);
    }

    @PostMapping("/api/lessons/{lessonId}/duration")
    public ResponseEntity<Void> setDuration(@PathVariable UUID lessonId, @Valid @RequestBody DurationRequest body,
                                            @AuthenticationPrincipal AuthUser me) {
        progress.setDuration(lessonId, body.durationSeconds(), me);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/modules/{slug}/comments")
    public List<CommentDto> comments(@PathVariable String slug, @AuthenticationPrincipal AuthUser me) {
        return comments.list(slug, me);
    }

    @PostMapping("/api/modules/{slug}/comments")
    public ResponseEntity<CommentDto> addComment(@PathVariable String slug,
                                                 @Valid @RequestBody CreateCommentRequest body,
                                                 @AuthenticationPrincipal AuthUser me) {
        return ResponseEntity.status(HttpStatus.CREATED).body(comments.create(slug, body.body(), me));
    }

    @DeleteMapping("/api/module-comments/{id}")
    public ResponseEntity<Void> deleteComment(@PathVariable UUID id, @AuthenticationPrincipal AuthUser me) {
        comments.delete(id, me);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/modules/{slug}/quiz")
    public QuizDto getQuiz(@PathVariable String slug, @AuthenticationPrincipal AuthUser me) {
        return quiz.getQuiz(slug, me);
    }

    @PostMapping("/api/modules/{slug}/quiz/attempts")
    public QuizResultDto attempt(@PathVariable String slug, @Valid @RequestBody QuizAttemptRequest body,
                                 @AuthenticationPrincipal AuthUser me) {
        return quiz.attempt(slug, body.answers(), me);
    }
}
