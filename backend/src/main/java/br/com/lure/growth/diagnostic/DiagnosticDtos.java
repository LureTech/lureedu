package br.com.lure.growth.diagnostic;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class DiagnosticDtos {

    private DiagnosticDtos() {
    }

    public record OptionDto(int score, String label, String text) {
    }

    public record QuestionDto(String id, String text, List<OptionDto> options) {
    }

    public record PillarDto(String id, String name, List<QuestionDto> questions) {
    }

    public record SubmitRequest(@NotNull(message = "Envie as respostas.") Map<String, Integer> answers) {
    }

    public record PillarResultDto(String id, String name, double avg, String label, String tone) {
    }

    public record SectionRefDto(String id, String title) {
    }

    public record PlanItemDto(String pillarId, String name, List<String> actions, List<SectionRefDto> sections) {
    }

    public record DiagnosticResultDto(UUID id, Instant createdAt, double overall, String overallLabel,
                                      String overallTone, List<PillarResultDto> pillars, List<String> strengths,
                                      List<String> weaknesses, List<PlanItemDto> plan,
                                      Map<String, Integer> answers) {
    }

    public record SubmissionSummaryDto(UUID id, Instant createdAt, double overall, String overallLabel) {
    }
}
