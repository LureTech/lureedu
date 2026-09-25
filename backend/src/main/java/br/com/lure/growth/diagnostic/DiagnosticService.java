package br.com.lure.growth.diagnostic;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.catalog.Section;
import br.com.lure.growth.catalog.SectionRepository;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.Messages;
import br.com.lure.growth.common.TimeUtils;
import br.com.lure.growth.diagnostic.DiagnosticDtos.DiagnosticResultDto;
import br.com.lure.growth.diagnostic.DiagnosticDtos.OptionDto;
import br.com.lure.growth.diagnostic.DiagnosticDtos.PillarDto;
import br.com.lure.growth.diagnostic.DiagnosticDtos.PillarResultDto;
import br.com.lure.growth.diagnostic.DiagnosticDtos.PlanItemDto;
import br.com.lure.growth.diagnostic.DiagnosticDtos.QuestionDto;
import br.com.lure.growth.diagnostic.DiagnosticDtos.SectionRefDto;
import br.com.lure.growth.diagnostic.DiagnosticDtos.SubmissionSummaryDto;
import br.com.lure.growth.diagnostic.PillarCatalog.Pillar;
import br.com.lure.growth.diagnostic.PillarCatalog.Question;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Diagnóstico de maturidade: médias por pilar, nota geral, forças/fraquezas e plano de ação.
 * Faixas: &lt; 3 Crítico · &lt; 4.2 Estável · senão Excelente (calculadas sobre a média sem arredondar).
 */
@Service
public class DiagnosticService {

    private static final String INVALID_ANSWERS = "Responda todas as 42 perguntas com notas de 1 a 5.";
    private static final TypeReference<LinkedHashMap<String, Integer>> ANSWERS_TYPE = new TypeReference<>() {
    };

    private final PillarCatalog catalog;
    private final DiagnosticSubmissionRepository submissions;
    private final SectionRepository sections;
    private final ObjectMapper objectMapper;

    public DiagnosticService(PillarCatalog catalog, DiagnosticSubmissionRepository submissions,
                             SectionRepository sections, ObjectMapper objectMapper) {
        this.catalog = catalog;
        this.submissions = submissions;
        this.sections = sections;
        this.objectMapper = objectMapper;
    }

    public List<PillarDto> pillars() {
        return catalog.pillars().stream()
                .map(p -> new PillarDto(p.id(), p.name(), p.questions().stream()
                        .map(q -> new QuestionDto(q.id(), q.text(), q.options().stream()
                                .map(o -> new OptionDto(o.score(), o.label(), o.text()))
                                .toList()))
                        .toList()))
                .toList();
    }

    @Transactional
    public DiagnosticResultDto submit(Map<String, Integer> rawAnswers, AuthUser me) {
        Map<String, Integer> answers = validate(rawAnswers);
        Computed computed = compute(answers);
        DiagnosticSubmission saved = submissions.save(new DiagnosticSubmission(me.id(), toJson(answers),
                computed.overall(), computed.overallLabel(), TimeUtils.now()));
        return toResult(saved.getId(), saved.getCreatedAt(), answers, computed);
    }

    @Transactional(readOnly = true)
    public List<SubmissionSummaryDto> list(AuthUser me) {
        return submissions.findByUserIdOrderByCreatedAtDesc(me.id()).stream()
                .map(s -> new SubmissionSummaryDto(s.getId(), s.getCreatedAt(), s.getOverall(), s.getOverallLabel()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<DiagnosticResultDto> latest(AuthUser me) {
        return submissions.findFirstByUserIdOrderByCreatedAtDesc(me.id()).map(this::toResult);
    }

    /** Só o dono ou um admin. */
    @Transactional(readOnly = true)
    public DiagnosticResultDto get(UUID id, AuthUser me) {
        DiagnosticSubmission s = submissions.findById(id)
                .orElseThrow(() -> ApiException.notFound("Diagnóstico não encontrado."));
        if (!me.isAdmin() && !s.getUserId().equals(me.id())) {
            throw ApiException.forbidden(Messages.NO_PERMISSION);
        }
        return toResult(s);
    }

    // ------------------------------------------------------------------ cálculo

    /** Exige exatamente as 42 perguntas, notas inteiras de 1 a 5; devolve na ordem do questionário. */
    Map<String, Integer> validate(Map<String, Integer> raw) {
        if (raw == null || raw.size() != catalog.questionIds().size()) {
            throw ApiException.badRequest(INVALID_ANSWERS);
        }
        Map<String, Integer> ordered = new LinkedHashMap<>();
        for (String qid : catalog.questionIds()) {
            Integer value = raw.get(qid);
            if (value == null || value < 1 || value > 5) {
                throw ApiException.badRequest(INVALID_ANSWERS);
            }
            ordered.put(qid, value);
        }
        return ordered;
    }

    Computed compute(Map<String, Integer> answers) {
        List<PillarScore> scores = new ArrayList<>();
        for (Pillar p : catalog.pillars()) {
            double sum = 0;
            for (Question q : p.questions()) {
                sum += answers.getOrDefault(q.id(), 0);
            }
            scores.add(new PillarScore(p, sum / p.questions().size()));
        }
        double overallRaw = scores.stream().mapToDouble(PillarScore::avg).average().orElse(0);
        Band overallBand = Band.of(overallRaw);

        // Uma única ordenação estável (empates mantêm a ordem dos pilares): fortes = 2 primeiros,
        // fracos = 2 últimos. Assim um pilar nunca aparece como forte e fraco ao mesmo tempo.
        List<PillarScore> byBest = scores.stream()
                .sorted(Comparator.comparingDouble(PillarScore::avg).reversed()).toList();
        List<PillarScore> byWorst = new ArrayList<>(byBest);
        Collections.reverse(byWorst);

        List<PillarResultDto> pillarResults = scores.stream()
                .map(s -> {
                    Band b = Band.of(s.avg());
                    return new PillarResultDto(s.pillar().id(), s.pillar().name(), round2(s.avg()), b.label, b.tone);
                })
                .toList();
        List<String> strengths = byBest.stream().limit(2).map(s -> s.pillar().id()).toList();
        List<PillarScore> weakest = byWorst.stream().limit(2).toList();
        return new Computed(round2(overallRaw), overallBand.label, overallBand.tone, pillarResults, strengths,
                weakest.stream().map(s -> s.pillar().id()).toList(), weakest.stream().map(PillarScore::pillar).toList());
    }

    private DiagnosticResultDto toResult(DiagnosticSubmission s) {
        Map<String, Integer> answers = fromJson(s.getAnswersJson());
        return toResult(s.getId(), s.getCreatedAt(), answers, compute(answers));
    }

    private DiagnosticResultDto toResult(UUID id, Instant createdAt, Map<String, Integer> answers, Computed c) {
        Map<String, Section> sectionById = sections.findAll().stream()
                .collect(Collectors.toMap(Section::getId, Function.identity()));
        List<PlanItemDto> plan = c.weakestPillars().stream()
                .map(p -> new PlanItemDto(p.id(), p.name(), p.actions(), p.recommendedSections().stream()
                        .map(sectionById::get)
                        .filter(java.util.Objects::nonNull)
                        .map(sec -> new SectionRefDto(sec.getId(), sec.getTitle()))
                        .toList()))
                .toList();
        return new DiagnosticResultDto(id, createdAt, c.overall(), c.overallLabel(), c.overallTone(), c.pillars(),
                c.strengths(), c.weaknesses(), plan, answers);
    }

    static double round2(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private String toJson(Map<String, Integer> answers) {
        try {
            return objectMapper.writeValueAsString(answers);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private Map<String, Integer> fromJson(String json) {
        try {
            return objectMapper.readValue(json, ANSWERS_TYPE);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Respostas do diagnóstico corrompidas", e);
        }
    }

    private record PillarScore(Pillar pillar, double avg) {
    }

    record Computed(double overall, String overallLabel, String overallTone, List<PillarResultDto> pillars,
                    List<String> strengths, List<String> weaknesses, List<Pillar> weakestPillars) {
    }

    enum Band {
        CRITICAL("Crítico", "critical"),
        STABLE("Estável", "stable"),
        EXCELLENT("Excelente", "excellent");

        final String label;
        final String tone;

        Band(String label, String tone) {
            this.label = label;
            this.tone = tone;
        }

        static Band of(double avg) {
            if (avg < 3) {
                return CRITICAL;
            }
            return avg < 4.2 ? STABLE : EXCELLENT;
        }
    }
}
