package br.com.lure.growth;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DiagnosticIntegrationTest extends IntegrationTestBase {

    @Test
    void pillarsHaveSixPillarsSevenQuestionsFiveOptions() throws Exception {
        JsonNode pillars = read(mvc.perform(auth(get("/api/diagnostic/pillars"), memberToken("tais@lure.com.br")))
                .andExpect(status().isOk()).andReturn());
        assertThat(pillars).hasSize(6);
        pillars.forEach(p -> {
            assertThat(p.get("questions")).hasSize(7);
            p.get("questions").forEach(q -> assertThat(q.get("options")).hasSize(5));
            assertThat(p.has("actions")).isFalse(); // não faz parte do PillarDto
        });
    }

    @Test
    void submitComputesResultsAndPlan() throws Exception {
        String member = memberToken("ugo@lure.com.br");
        mvc.perform(auth(get("/api/diagnostic/submissions/latest"), member)).andExpect(status().isNoContent());

        // gestao: 5,4,4,4,4,4,4 → 29/7 = 4.14 (Estável); cultura 2; marketing 3; vendas 4; experiencia 5; ia 1
        Map<String, Integer> answers = new LinkedHashMap<>();
        int[] base = {0, 2, 3, 4, 5, 1};
        for (int p = 1; p <= 6; p++) {
            for (int q = 1; q <= 7; q++) {
                answers.put(p + "." + q, p == 1 ? (q == 1 ? 5 : 4) : base[p - 1]);
            }
        }

        JsonNode result = read(mvc.perform(auth(post("/api/diagnostic/submissions"), member)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("answers", answers))))
                .andExpect(status().isCreated()).andReturn());

        // média geral = (29/7 + 2 + 3 + 4 + 5 + 1) / 6 = 3.19
        assertThat(result.get("overall").asDouble()).isEqualTo(3.19);
        assertThat(result.get("overallLabel").asText()).isEqualTo("Estável");
        assertThat(result.get("overallTone").asText()).isEqualTo("stable");
        assertThat(result.at("/pillars/0/id").asText()).isEqualTo("gestao");
        assertThat(result.at("/pillars/0/avg").asDouble()).isEqualTo(4.14);
        assertThat(result.at("/pillars/0/tone").asText()).isEqualTo("stable");
        assertThat(result.at("/pillars/1/label").asText()).isEqualTo("Crítico");
        assertThat(result.at("/pillars/4/tone").asText()).isEqualTo("excellent");
        assertThat(result.get("strengths").toString()).isEqualTo("[\"experiencia\",\"gestao\"]");
        assertThat(result.get("weaknesses").toString()).isEqualTo("[\"ia\",\"cultura\"]");
        assertThat(result.at("/plan/0/pillarId").asText()).isEqualTo("ia");
        assertThat(result.at("/plan/0/sections/0/id").asText()).isEqualTo("ia");
        assertThat(result.at("/plan/0/sections/0/title").asText()).isEqualTo("IA APLICADA");
        assertThat(result.at("/plan/1/sections/0/id").asText()).isEqualTo("rh");
        assertThat(result.at("/plan/0/actions").size()).isGreaterThan(0);
        assertThat(result.get("answers").size()).isEqualTo(42);

        String id = result.get("id").asText();
        mvc.perform(auth(get("/api/diagnostic/submissions/latest"), member))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.overall").value(3.19));
        mvc.perform(auth(get("/api/diagnostic/submissions"), member))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].overallLabel").value("Estável"));

        // só o dono ou admin
        mvc.perform(auth(get("/api/diagnostic/submissions/" + id), memberToken("vera@lure.com.br")))
                .andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/diagnostic/submissions/" + id), adminToken())).andExpect(status().isOk());

        // validação: faltando pergunta ou nota fora de 1–5
        Map<String, Integer> missing = new LinkedHashMap<>(answers);
        missing.remove("6.7");
        mvc.perform(auth(post("/api/diagnostic/submissions"), member)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("answers", missing))))
                .andExpect(status().isBadRequest());
        Map<String, Integer> outOfRange = new LinkedHashMap<>(answers);
        outOfRange.put("1.1", 6);
        mvc.perform(auth(post("/api/diagnostic/submissions"), member)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("answers", outOfRange))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Responda todas as 42 perguntas com notas de 1 a 5."));
    }

    @Test
    void tiedPillarsNeverAppearAsStrengthAndWeakness() throws Exception {
        Map<String, Integer> answers = new LinkedHashMap<>();
        for (int p = 1; p <= 6; p++) {
            for (int q = 1; q <= 7; q++) {
                answers.put(p + "." + q, 3);
            }
        }

        JsonNode result = read(mvc.perform(auth(post("/api/diagnostic/submissions"), memberToken("wal@lure.com.br"))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("answers", answers))))
                .andExpect(status().isCreated()).andReturn());

        assertThat(result.get("strengths").toString()).isEqualTo("[\"gestao\",\"cultura\"]");
        assertThat(result.get("weaknesses").toString()).isEqualTo("[\"ia\",\"experiencia\"]");
        assertThat(result.at("/plan/0/pillarId").asText()).isEqualTo("ia");
    }
}
