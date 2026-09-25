package br.com.lure.growth;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CertificateAndQuizIntegrationTest extends IntegrationTestBase {

    @Test
    void completingAllLessonsWithoutQuizIssuesCertificateOnce() throws Exception {
        String admin = adminToken();
        JsonNode module = createModule(admin, "call", "Call de Vendas Consultiva", false);
        String moduleId = module.get("id").asText();
        JsonNode l1 = addLesson(admin, moduleId, "Preparação");
        JsonNode l2 = addLesson(admin, moduleId, "Fechamento");
        String member = memberToken("julia@lure.com.br");

        JsonNode first = complete(member, l1.get("id").asText());
        assertThat(first.get("certificate").isNull()).isTrue();
        assertThat(first.get("moduleProgress").asInt()).isEqualTo(50);

        JsonNode last = complete(member, l2.get("id").asText());
        assertThat(last.get("moduleProgress").asInt()).isEqualTo(100);
        JsonNode cert = last.get("certificate");
        assertThat(cert.isObject()).isTrue();
        String code = cert.get("code").asText();
        assertThat(code).matches("LURE-[A-Z0-9]{5}-[A-Z0-9]{5}");
        assertThat(cert.get("studentName").asText()).isEqualTo("Membro julia");
        assertThat(cert.get("moduleTitle").asText()).isEqualTo("Call de Vendas Consultiva");
        assertThat(cert.get("sectionTitle").asText()).isEqualTo("CALL DE VENDAS");
        assertThat(cert.get("lessonCount").asInt()).isEqualTo(2);
        assertThat(cert.get("moduleSlug").asText()).isEqualTo(module.get("slug").asText());

        // chamada seguinte não reemite
        assertThat(complete(member, l2.get("id").asText()).get("certificate").isNull()).isTrue();

        // página do módulo e lista do aluno
        mvc.perform(auth(get("/api/modules/" + module.get("slug").asText()), member))
                .andExpect(jsonPath("$.certificate.code").value(code))
                .andExpect(jsonPath("$.progress").value(100));
        mvc.perform(auth(get("/api/certificates"), member))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].code").value(code));

        // verificação pública (sem token), inclusive com código em minúsculas
        mvc.perform(get("/api/public/certificates/" + code.toLowerCase()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.studentName").value("Membro julia"));
        mvc.perform(get("/api/public/certificates/LURE-00000-00000")).andExpect(status().isNotFound());

        // apagar o módulo mantém o certificado válido (moduleSlug vira null)
        mvc.perform(auth(delete("/api/admin/modules/" + moduleId), admin)).andExpect(status().isNoContent());
        mvc.perform(get("/api/public/certificates/" + code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.moduleTitle").value("Call de Vendas Consultiva"))
                .andExpect(jsonPath("$.moduleSlug").isEmpty());
    }

    @Test
    void quizIsGatedAndPassingIssuesCertificate() throws Exception {
        String admin = adminToken();
        JsonNode module = createModule(admin, "comercial", "Funil de Alto Ticket", false);
        String moduleId = module.get("id").asText();
        String slug = module.get("slug").asText();
        JsonNode lesson = addLesson(admin, moduleId, "Etapas do funil");

        MvcResult quizResult = mvc.perform(auth(put("/api/admin/modules/" + moduleId + "/quiz"), admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("questions", List.of(
                                Map.of("text", "Qual etapa vem primeiro?", "options", List.of("Fechamento", "Prospecção"),
                                        "correctIndex", 1),
                                Map.of("text", "BANT significa?", "options", List.of("Budget, Authority, Need, Timing",
                                        "Nada", "Outra coisa"), "correctIndex", 0))))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode questions = read(quizResult);
        assertThat(questions).hasSize(2);

        String member = memberToken("karla@lure.com.br");

        // antes de concluir as aulas: perguntas escondidas e tentativa → 409
        mvc.perform(auth(get("/api/modules/" + slug + "/quiz"), member))
                .andExpect(jsonPath("$.unlocked").value(false))
                .andExpect(jsonPath("$.passingScore").value(70))
                .andExpect(jsonPath("$.questions").isEmpty());
        mvc.perform(auth(post("/api/modules/" + slug + "/quiz/attempts"), member)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"answers\":{}}"))
                .andExpect(status().isConflict());

        // concluir as aulas NÃO emite certificado (prova pendente)
        assertThat(complete(member, lesson.get("id").asText()).get("certificate").isNull()).isTrue();
        mvc.perform(auth(get("/api/modules/" + slug), member))
                .andExpect(jsonPath("$.quiz.unlocked").value(true))
                .andExpect(jsonPath("$.quiz.questionCount").value(2))
                .andExpect(jsonPath("$.certificate").isEmpty());
        JsonNode quiz = read(mvc.perform(auth(get("/api/modules/" + slug + "/quiz"), member)).andReturn());
        assertThat(quiz.get("questions")).hasSize(2);
        assertThat(quiz.at("/questions/0").has("correctIndex")).isFalse();

        // reprovado (50%)
        String q1 = questions.at("/0/id").asText();
        String q2 = questions.at("/1/id").asText();
        JsonNode failed = attempt(member, slug, Map.of(q1, 1, q2, 2));
        assertThat(failed.get("score").asInt()).isEqualTo(50);
        assertThat(failed.get("passed").asBoolean()).isFalse();
        assertThat(failed.get("certificate").isNull()).isTrue();
        assertThat(failed.at("/results/1/correct").asBoolean()).isFalse();
        assertThat(failed.at("/results/1/correctIndex").asInt()).isEqualTo(0);

        // aprovado → certificado
        JsonNode passed = attempt(member, slug, Map.of(q1, 1, q2, 0));
        assertThat(passed.get("score").asInt()).isEqualTo(100);
        assertThat(passed.get("passed").asBoolean()).isTrue();
        assertThat(passed.at("/certificate/code").asText()).startsWith("LURE-");

        mvc.perform(auth(get("/api/modules/" + slug), member))
                .andExpect(jsonPath("$.quiz.passed").value(true))
                .andExpect(jsonPath("$.quiz.attempts").value(2))
                .andExpect(jsonPath("$.quiz.bestScore").value(100))
                .andExpect(jsonPath("$.certificate.code").value(passed.at("/certificate/code").asText()));

        // nova aprovação não reemite
        assertThat(attempt(member, slug, Map.of(q1, 1, q2, 0)).get("certificate").isNull()).isTrue();
    }

    @Test
    void quizValidation() throws Exception {
        String admin = adminToken();
        String moduleId = createModule(admin, "rh", "Cultura", false).get("id").asText();
        mvc.perform(auth(put("/api/admin/modules/" + moduleId + "/quiz"), admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("questions", List.of(
                                Map.of("text", "Só uma opção?", "options", List.of("A"), "correctIndex", 0))))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Pergunta 1: informe de 2 a 6 alternativas."));
    }

    private JsonNode complete(String token, String lessonId) throws Exception {
        return read(mvc.perform(auth(put("/api/lessons/" + lessonId + "/progress"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
                .andExpect(status().isOk())
                .andReturn());
    }

    private JsonNode attempt(String token, String slug, Map<String, Integer> answers) throws Exception {
        return read(mvc.perform(auth(post("/api/modules/" + slug + "/quiz/attempts"), token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("answers", new HashMap<>(answers)))))
                .andExpect(status().isOk())
                .andReturn());
    }
}
