package br.com.lure.growth.diagnostic;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Pilares do diagnóstico de maturidade, carregados de {@code classpath:diagnostic/pillars.json} na inicialização
 * (6 pilares × 7 perguntas × 5 opções, com ações e seções recomendadas).
 */
@Component
public class PillarCatalog {

    private static final Logger log = LoggerFactory.getLogger(PillarCatalog.class);
    private static final String RESOURCE = "diagnostic/pillars.json";

    private final List<Pillar> pillars;
    private final List<String> questionIds;

    public PillarCatalog(ObjectMapper objectMapper) {
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            this.pillars = List.copyOf(objectMapper.readValue(in, new TypeReference<List<Pillar>>() {
            }));
        } catch (IOException e) {
            throw new UncheckedIOException("Não foi possível ler " + RESOURCE, e);
        }
        List<String> ids = new ArrayList<>();
        for (Pillar p : pillars) {
            if (p.questions() == null || p.questions().isEmpty()) {
                throw new IllegalStateException("Pilar sem perguntas: " + p.id());
            }
            for (Question q : p.questions()) {
                if (q.options() == null || q.options().size() != 5) {
                    throw new IllegalStateException("Pergunta " + q.id() + " deve ter 5 opções.");
                }
                ids.add(q.id());
            }
        }
        this.questionIds = Collections.unmodifiableList(ids);
        log.info("Diagnóstico: {} pilares, {} perguntas carregadas.", pillars.size(), questionIds.size());
    }

    public List<Pillar> pillars() {
        return pillars;
    }

    /** Ids de todas as perguntas, na ordem do questionário ("1.1", "1.2", …). */
    public List<String> questionIds() {
        return questionIds;
    }

    public record Pillar(String id, String name, List<String> actions, List<String> recommendedSections,
                         List<Question> questions) {
        public Pillar {
            actions = actions == null ? List.of() : List.copyOf(actions);
            recommendedSections = recommendedSections == null ? List.of() : List.copyOf(recommendedSections);
        }
    }

    public record Question(String id, String text, List<Option> options) {
    }

    public record Option(int score, String label, String text) {
    }
}
