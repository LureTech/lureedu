package br.com.lure.growth;

import br.com.lure.growth.admin.VideoUrls;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CatalogIntegrationTest extends IntegrationTestBase {

    @Test
    void lockedModuleIsListedButNotAccessibleForMembers() throws Exception {
        String admin = adminToken();
        JsonNode open = createModule(admin, "trafego", "Meta Ads na Prática", false);
        JsonNode locked = createModule(admin, "trafego", "Google Ads Avançado", true);
        addLesson(admin, open.get("id").asText(), "Estrutura de campanhas");
        JsonNode lockedLesson = addLesson(admin, locked.get("id").asText(), "Palavras-chave");
        String member = memberToken("gil@lure.com.br");

        // catálogo: aparece com locked=true e sem progresso
        JsonNode catalog = read(mvc.perform(auth(get("/api/catalog"), member))
                .andExpect(status().isOk()).andReturn());
        assertThat(catalog).hasSize(1); // só a seção com módulos
        assertThat(catalog.at("/0/section/id").asText()).isEqualTo("trafego");
        assertThat(catalog.at("/0/modules")).hasSize(2);
        assertThat(catalog.at("/0/modules/1/locked").asBoolean()).isTrue();
        assertThat(catalog.at("/0/modules/1/lessonCount").asInt()).isEqualTo(1);

        String slug = locked.get("slug").asText();
        mvc.perform(auth(get("/api/modules/" + slug), member)).andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/modules/" + slug + "/comments"), member)).andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/modules/" + slug + "/quiz"), member)).andExpect(status().isForbidden());
        mvc.perform(auth(put("/api/lessons/" + lockedLesson.get("id").asText() + "/progress"), member)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
                .andExpect(status().isForbidden());

        // admin acessa
        mvc.perform(auth(get("/api/modules/" + slug), admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.locked").value(true));

        // busca: membro não vê o trancado; admin vê
        JsonNode memberSearch = read(mvc.perform(auth(get("/api/search").param("q", "ads"), member)).andReturn());
        assertThat(memberSearch.get("modules")).hasSize(1);
        assertThat(memberSearch.at("/modules/0/slug").asText()).isEqualTo(open.get("slug").asText());
        JsonNode adminSearch = read(mvc.perform(auth(get("/api/search").param("q", "ADS"), admin)).andReturn());
        assertThat(adminSearch.get("modules")).hasSize(2);

        // resumo de progresso ignora módulos trancados
        mvc.perform(auth(get("/api/progress/summary"), member)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalLessons").value(1))
                .andExpect(jsonPath("$.continueWatching").isEmpty());
    }

    @Test
    void unlockingNotifiesMembersAndSearchIsAccentInsensitive() throws Exception {
        String admin = adminToken();
        String member = memberToken("hugo@lure.com.br");
        JsonNode module = createModule(admin, "ia", "Automação com Inteligência", true);
        addLesson(admin, module.get("id").asText(), "Prompts eficientes");

        mvc.perform(auth(patch("/api/admin/modules/" + module.get("id").asText() + "/lock"), admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"locked\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.locked").value(false));

        mvc.perform(auth(get("/api/notifications"), member)).andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(1))
                .andExpect(jsonPath("$.items[0].type").value("NEW_CONTENT"))
                .andExpect(jsonPath("$.items[0].link").value("/curso/" + module.get("slug").asText()));

        mvc.perform(auth(get("/api/search").param("q", "automacao"), member))
                .andExpect(jsonPath("$.modules[0].title").value("Automação com Inteligência"));
        mvc.perform(auth(get("/api/search").param("q", "a"), member))
                .andExpect(jsonPath("$.modules").isEmpty());
    }

    @Test
    void progressUpsertKeepsWatchedSecondsMonotonic() throws Exception {
        String admin = adminToken();
        JsonNode module = createModule(admin, "social", "Social Selling Essencial", false);
        JsonNode lesson = addLesson(admin, module.get("id").asText(), "Perfil que vende");
        addLesson(admin, module.get("id").asText(), "Rotina de prospecção");
        String member = memberToken("ivo@lure.com.br");
        String url = "/api/lessons/" + lesson.get("id").asText() + "/progress";

        mvc.perform(auth(put(url), member).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("watchedSeconds", 120, "lastPosition", 118))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchedSeconds").value(120))
                .andExpect(jsonPath("$.completed").value(false));
        mvc.perform(auth(put(url), member).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("watchedSeconds", 30, "completed", true))))
                .andExpect(jsonPath("$.watchedSeconds").value(120))
                .andExpect(jsonPath("$.lastPosition").value(118))
                .andExpect(jsonPath("$.moduleProgress").value(50))
                .andExpect(jsonPath("$.completedLessons").value(1))
                .andExpect(jsonPath("$.certificate").isEmpty());
        mvc.perform(auth(put(url), member).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("watchedSeconds", -1))))
                .andExpect(status().isBadRequest());

        mvc.perform(auth(get("/api/progress/summary"), member))
                .andExpect(jsonPath("$.inProgress[0].progress").value(50))
                .andExpect(jsonPath("$.continueWatching.lessonId").value(lesson.get("id").asText()))
                .andExpect(jsonPath("$.continueWatching.lastPosition").value(118));

        // duração: membro grava só se vazia; admin sobrescreve
        String duration = "/api/lessons/" + lesson.get("id").asText() + "/duration";
        mvc.perform(auth(post(duration), member).contentType(MediaType.APPLICATION_JSON)
                .content("{\"durationSeconds\":300}")).andExpect(status().isNoContent());
        mvc.perform(auth(post(duration), member).contentType(MediaType.APPLICATION_JSON)
                .content("{\"durationSeconds\":999}")).andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/modules/" + module.get("slug").asText()), member))
                .andExpect(jsonPath("$.lessons[0].durationSeconds").value(300))
                .andExpect(jsonPath("$.progress").value(50));
    }

    @Test
    void videoUrlsAreValidatedAndNormalized() throws Exception {
        String admin = adminToken();
        String moduleId = createModule(admin, "conteudo", "Roteiros", false).get("id").asText();
        String url = "/api/admin/modules/" + moduleId + "/lessons";
        for (String ok : new String[]{"dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
                "https://youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ",
                "https://www.youtube.com/live/dQw4w9WgXcQ?si=x"}) {
            mvc.perform(auth(post(url), admin).contentType(MediaType.APPLICATION_JSON)
                            .content(toJson(Map.of("title", "Aula", "videoUrl", ok))))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.videoUrl").value("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
        }
        String direct = "https://pub-0123abcd.r2.dev/modulo-1/Aula-01.MP4?v=2";
        mvc.perform(auth(post(url), admin).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("title", "Aula", "videoUrl", direct))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.videoUrl").value(direct));
        for (String bad : new String[]{"https://vimeo.com/1234", "http://cdn.exemplo.com/aula.mp4",
                "https://cdn.exemplo.com/aula.pdf"}) {
            mvc.perform(auth(post(url), admin).contentType(MediaType.APPLICATION_JSON)
                            .content(toJson(Map.of("title", "Aula", "videoUrl", bad))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(VideoUrls.INVALID));
        }
    }

    @Test
    void sectionWithModulesCannotBeDeleted() throws Exception {
        String admin = adminToken();
        mvc.perform(auth(post("/api/admin/sections"), admin).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("title", "Gestão Financeira", "subtitle", "Caixa e DRE"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("gestao-financeira"))
                .andExpect(jsonPath("$.sortOrder").value(10));
        createModule(admin, "gestao-financeira", "Fluxo de caixa", false);
        mvc.perform(auth(delete("/api/admin/sections/gestao-financeira"), admin))
                .andExpect(status().isConflict());
    }
}
