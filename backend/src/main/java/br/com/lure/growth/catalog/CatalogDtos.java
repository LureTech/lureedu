package br.com.lure.growth.catalog;

import br.com.lure.growth.storage.StorageService;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** DTOs públicos do catálogo (seções 3–6 do contrato). */
public final class CatalogDtos {

    private CatalogDtos() {
    }

    public record SectionDto(String id, String title, String subtitle, int sortOrder) {
        public static SectionDto from(Section s) {
            return new SectionDto(s.getId(), s.getTitle(), s.getSubtitle(), s.getSortOrder());
        }
    }

    public record ModuleCardDto(UUID id, String slug, String sectionId, String title, String author,
                                String coverUrl, boolean locked, int lessonCount, int completedLessons,
                                int progress) {
    }

    public record CatalogSectionDto(SectionDto section, List<ModuleCardDto> modules) {
    }

    public record MaterialDto(UUID id, String label, String url, long sizeBytes, String contentType) {
        public static MaterialDto from(LessonMaterial m) {
            return new MaterialDto(m.getId(), m.getLabel(), StorageService.urlOf(m.getFilePath()), m.getSizeBytes(),
                    m.getContentType());
        }
    }

    public record LessonDto(UUID id, int position, String title, String description, String videoUrl,
                            Integer durationSeconds, boolean completed, int lastPosition, int watchedSeconds,
                            List<MaterialDto> materials) {
    }

    public record CertificateDto(UUID id, String code, String studentName, String moduleTitle,
                                 String sectionTitle, String author, int lessonCount, Instant issuedAt,
                                 String moduleSlug) {
    }

    public record ContinueWatchingDto(String moduleSlug, String moduleTitle, String coverUrl, UUID lessonId,
                                      String lessonTitle, int lessonPosition, int lastPosition) {
    }

    public record ProgressSummaryDto(int totalLessons, int completedLessons, int percent,
                                     List<ModuleCardDto> inProgress, List<ModuleCardDto> completed,
                                     @JsonInclude(JsonInclude.Include.ALWAYS) ContinueWatchingDto continueWatching) {
    }

    public record SearchModuleDto(String slug, String title, String sectionTitle, String coverUrl, boolean locked) {
    }

    public record SearchLessonDto(String moduleSlug, String moduleTitle, UUID lessonId, String lessonTitle,
                                  int position) {
    }

    public record SearchResultDto(List<SearchModuleDto> modules, List<SearchLessonDto> lessons) {
        public static SearchResultDto empty() {
            return new SearchResultDto(List.of(), List.of());
        }
    }

    public record QuizSummaryDto(int questionCount, boolean unlocked, boolean passed, Integer bestScore,
                                 int attempts) {
    }

    public record ModuleDetailDto(UUID id, String slug, String sectionId, String sectionTitle, String title,
                                  String description, String author, String coverUrl, boolean locked,
                                  List<LessonDto> lessons, int progress, int completedLessons,
                                  QuizSummaryDto quiz, CertificateDto certificate) {
    }

    public record ProgressUpdateRequest(
            Boolean completed,
            @Min(value = 0, message = "Valor inválido.") @Max(value = 1_000_000, message = "Valor inválido.")
            Integer watchedSeconds,
            @Min(value = 0, message = "Valor inválido.") @Max(value = 1_000_000, message = "Valor inválido.")
            Integer lastPosition
    ) {
    }

    public record ProgressUpdateDto(UUID lessonId, boolean completed, int watchedSeconds, int lastPosition,
                                    int moduleProgress, int completedLessons, CertificateDto certificate) {
    }

    public record DurationRequest(
            @NotNull(message = "Informe a duração.")
            @Min(value = 1, message = "Duração inválida.") @Max(value = 172_800, message = "Duração inválida.")
            Integer durationSeconds
    ) {
    }

    public record QuizQuestionDto(UUID id, String text, List<String> options) {
    }

    public record QuizDto(boolean unlocked, int passingScore, int attempts, Integer bestScore, boolean passed,
                          List<QuizQuestionDto> questions) {
    }

    public record QuizAttemptRequest(@NotNull(message = "Envie as respostas.") Map<String, Integer> answers) {
    }

    public record QuestionResultDto(UUID questionId, boolean correct, int correctIndex) {
    }

    public record QuizResultDto(int score, int correct, int total, boolean passed, List<QuestionResultDto> results,
                                CertificateDto certificate) {
    }

    /** round(completed / total * 100); 0 quando não há aulas; só é 100 quando tudo foi concluído. */
    public static int percent(long completed, long total) {
        if (total <= 0) {
            return 0;
        }
        long done = Math.min(completed, total);
        int value = (int) Math.round(done * 100.0 / total);
        return done < total ? Math.min(value, 99) : 100;
    }
}
