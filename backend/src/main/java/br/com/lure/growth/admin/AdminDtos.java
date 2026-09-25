package br.com.lure.growth.admin;

import br.com.lure.growth.catalog.CatalogDtos.LessonDto;
import br.com.lure.growth.user.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** DTOs da área administrativa (seção 10 do contrato). */
public final class AdminDtos {

    private AdminDtos() {
    }

    // ------------------------------------------------------------------ visão geral e contas

    public record AdminStatsDto(long users, long activeUsers, long admins, long modules, long lessons,
                                long lessonsCompleted, long certificates, long postsTotal, long postsToday,
                                long diagnostics) {
    }

    public record CreateUserRequest(
            @NotBlank(message = "Informe o e-mail.") @Email(message = "E-mail inválido.")
            @Size(max = 254, message = "E-mail longo demais.") String email,
            @NotBlank(message = "Informe a senha.")
            @Size(min = 8, message = "A senha precisa ter pelo menos 8 caracteres.")
            @Size(max = 72, message = "A senha pode ter no máximo 72 caracteres.") String password,
            @Size(max = 80, message = "O nome pode ter no máximo 80 caracteres.") String fullName,
            @NotNull(message = "Escolha o perfil de acesso.") Role role
    ) {
    }

    public record UpdateUserRequest(
            @Size(max = 80, message = "O nome pode ter no máximo 80 caracteres.") String fullName,
            Role role,
            Boolean active
    ) {
    }

    public record AdminResetPasswordRequest(
            @NotBlank(message = "Informe a nova senha.")
            @Size(min = 8, message = "A senha precisa ter pelo menos 8 caracteres.")
            @Size(max = 72, message = "A senha pode ter no máximo 72 caracteres.") String newPassword
    ) {
    }

    // ------------------------------------------------------------------ seções

    public record SectionCreateRequest(
            @Size(max = 60, message = "O identificador pode ter no máximo 60 caracteres.") String id,
            @NotBlank(message = "Informe o título.") @Size(max = 120, message = "O título pode ter no máximo 120 caracteres.")
            String title,
            @Size(max = 255, message = "O subtítulo pode ter no máximo 255 caracteres.") String subtitle
    ) {
    }

    public record SectionUpdateRequest(
            @NotBlank(message = "Informe o título.") @Size(max = 120, message = "O título pode ter no máximo 120 caracteres.")
            String title,
            @Size(max = 255, message = "O subtítulo pode ter no máximo 255 caracteres.") String subtitle,
            @Min(value = 0, message = "Ordem inválida.") @Max(value = 100_000, message = "Ordem inválida.")
            Integer sortOrder
    ) {
    }

    // ------------------------------------------------------------------ módulos

    /** {@code ModuleInput} do contrato; {@code sortOrder} só é usado no PUT (opcional). */
    public record ModuleInput(
            @NotBlank(message = "Escolha a seção.") String sectionId,
            @NotBlank(message = "Informe o título.") @Size(max = 160, message = "O título pode ter no máximo 160 caracteres.")
            String title,
            @Size(max = 4000, message = "A descrição pode ter no máximo 4000 caracteres.") String description,
            @Size(max = 120, message = "O autor pode ter no máximo 120 caracteres.") String author,
            Boolean locked,
            @Min(value = 0, message = "Ordem inválida.") @Max(value = 100_000, message = "Ordem inválida.")
            Integer sortOrder
    ) {
    }

    public record LockRequest(@NotNull(message = "Informe se o módulo está trancado.") Boolean locked) {
    }

    public record AdminModuleDto(UUID id, String slug, String sectionId, String sectionTitle, String title,
                                 String description, String author, String coverUrl, boolean locked, int sortOrder,
                                 int lessonCount, int lessonsWithVideo, int quizQuestionCount, Instant createdAt) {
    }

    public record AdminModuleDetailDto(UUID id, String slug, String sectionId, String sectionTitle, String title,
                                       String description, String author, String coverUrl, boolean locked,
                                       int sortOrder, int lessonCount, int lessonsWithVideo, int quizQuestionCount,
                                       Instant createdAt, List<LessonDto> lessons, List<AdminQuizQuestionDto> quiz) {
    }

    public record AdminQuizQuestionDto(UUID id, String text, List<String> options, int correctIndex) {
    }

    // ------------------------------------------------------------------ aulas e prova

    public record LessonInput(
            @NotBlank(message = "Informe o título da aula.")
            @Size(max = 200, message = "O título pode ter no máximo 200 caracteres.") String title,
            @Size(max = 4000, message = "A descrição pode ter no máximo 4000 caracteres.") String description,
            @Size(max = 1000, message = VideoUrls.INVALID) String videoUrl,
            @Min(value = 0, message = "Duração inválida.") @Max(value = 172_800, message = "Duração inválida.")
            Integer durationSeconds
    ) {
    }

    public record LessonOrderRequest(@NotNull(message = "Envie a nova ordem das aulas.") List<UUID> lessonIds) {
    }

    public record QuizQuestionInput(String text, List<String> options, Integer correctIndex) {
    }

    public record QuizReplaceRequest(@NotNull(message = "Envie as perguntas.") List<QuizQuestionInput> questions) {
    }
}
