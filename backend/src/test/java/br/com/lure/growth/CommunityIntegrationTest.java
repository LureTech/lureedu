package br.com.lure.growth;

import br.com.lure.growth.user.Role;
import br.com.lure.growth.user.User;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CommunityIntegrationTest extends IntegrationTestBase {

    /** Cabeçalho PNG válido (o servidor confere os "magic bytes"). */
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 'I', 'H', 'D', 'R'};

    @Test
    void postValidation() throws Exception {
        String member = memberToken("lia@lure.com.br");

        createPost(member, "   ", "Dúvida", null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Escreva alguma coisa ou anexe uma imagem."));
        createPost(member, "x".repeat(501), "Dúvida", null)
                .andExpect(status().isBadRequest());
        createPost(member, "Oi", "Fofoca", null)
                .andExpect(status().isBadRequest());
        createPost(member, "Oi", "Dúvida", new MockMultipartFile("image", "a.gif", "image/gif", "GIF89a".getBytes()))
                .andExpect(status().isBadRequest());
        createPost(member, "Oi", "Dúvida",
                new MockMultipartFile("image", "fake.png", "image/png", "<html>".getBytes()))
                .andExpect(status().isBadRequest());
        createPost(member, "Oi", "Dúvida",
                new MockMultipartFile("image", "big.png", "image/png", new byte[2 * 1024 * 1024 + 1]))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void imagePostAndCooldown() throws Exception {
        String member = memberToken("leo@lure.com.br");

        JsonNode post = read(createPost(member, "", "Conquista",
                new MockMultipartFile("image", "foto.png", "image/png", PNG), "640", "480")
                .andExpect(status().isCreated()).andReturn());
        assertThat(post.get("imageUrl").asText()).startsWith("/files/community/").endsWith(".png");
        assertThat(post.get("imageWidth").asInt()).isEqualTo(640);
        assertThat(post.get("category").asText()).isEqualTo("Conquista");
        assertThat(post.at("/author/fullName").asText()).isEqualTo("Membro leo");
        assertThat(post.get("canDelete").asBoolean()).isTrue();

        mvc.perform(get(post.get("imageUrl").asText())).andExpect(status().isOk());

        createPost(member, "Outro post", "Insight", null)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Aguarde alguns segundos antes de publicar de novo."));
    }

    @Test
    void dailyLimit() throws Exception {
        String member = memberToken("lara@lure.com.br");
        UUID userId = users.findByEmail("lara@lure.com.br").orElseThrow().getId();
        Instant oneHourAgo = Instant.now().minus(1, ChronoUnit.HOURS);
        for (int i = 0; i < 10; i++) {
            jdbc.update("INSERT INTO community_posts (id, user_id, category, body, created_at) VALUES (?, ?, ?, ?, ?)",
                    UUID.randomUUID(), userId, "Insight", "post " + i, Timestamp.from(oneHourAgo.plusSeconds(i)));
        }
        createPost(member, "11º post", "Insight", null)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Você atingiu o limite de 10 publicações por dia."));
        mvc.perform(auth(get("/api/community/stats"), member))
                .andExpect(jsonPath("$.myPosts24h").value(10))
                .andExpect(jsonPath("$.remainingToday").value(0));
    }

    @Test
    void likesCommentsNotificationsAndPermissions() throws Exception {
        String owner = memberToken("mia@lure.com.br");
        String other = memberToken("noa@lure.com.br");
        String third = memberToken("oto@lure.com.br");

        JsonNode post = read(createPost(owner, "Fechei meu primeiro contrato! #vitoria #Vendas", "Conquista", null)
                .andExpect(status().isCreated()).andReturn());
        String postId = post.get("id").asText();

        // curtida idempotente
        like(other).andExpect(jsonPath("$.liked").value(true)).andExpect(jsonPath("$.likesCount").value(1));
        like(other).andExpect(jsonPath("$.likesCount").value(1));
        mvc.perform(auth(post("/api/community/posts/" + postId + "/like"), owner))
                .andExpect(jsonPath("$.likesCount").value(2));

        mvc.perform(auth(get("/api/community/posts"), other))
                .andExpect(jsonPath("$[0].likesCount").value(2))
                .andExpect(jsonPath("$[0].likedByMe").value(true))
                .andExpect(jsonPath("$[0].canDelete").value(false))
                .andExpect(jsonPath("$[0].author.fullName").value("Membro mia"));

        mvc.perform(auth(delete("/api/community/posts/" + postId + "/like"), other))
                .andExpect(jsonPath("$.liked").value(false))
                .andExpect(jsonPath("$.likesCount").value(1));
        mvc.perform(auth(delete("/api/community/posts/" + postId + "/like"), other))
                .andExpect(jsonPath("$.likesCount").value(1));

        // comentário
        JsonNode comment = read(mvc.perform(auth(post("/api/community/posts/" + postId + "/comments"), other)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("body", "Parabéns!"))))
                .andExpect(status().isCreated()).andReturn());
        mvc.perform(auth(post("/api/community/posts/" + postId + "/comments"), other)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("body", "x".repeat(301)))))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/community/posts/" + postId + "/comments"), owner))
                .andExpect(jsonPath("$[0].body").value("Parabéns!"))
                .andExpect(jsonPath("$[0].canDelete").value(true)); // dono do post pode apagar

        // notificações do dono: 1 LIKE (de other; a própria curtida não conta) + 1 COMMENT
        mvc.perform(auth(get("/api/notifications"), owner))
                .andExpect(jsonPath("$.unread").value(2))
                .andExpect(jsonPath("$.items[0].type").value("COMMENT"))
                .andExpect(jsonPath("$.items[1].type").value("LIKE"));

        // permissões de exclusão
        mvc.perform(auth(delete("/api/community/comments/" + comment.get("id").asText()), third))
                .andExpect(status().isForbidden());
        mvc.perform(auth(delete("/api/community/posts/" + postId), third)).andExpect(status().isForbidden());
        mvc.perform(auth(delete("/api/community/comments/" + comment.get("id").asText()), owner))
                .andExpect(status().isNoContent());

        // estatísticas e hashtags
        mvc.perform(auth(get("/api/community/stats"), third))
                .andExpect(jsonPath("$.members").value(4))
                .andExpect(jsonPath("$.postsToday").value(1))
                .andExpect(jsonPath("$.postsTotal").value(1))
                .andExpect(jsonPath("$.tags[0].tag").value("vendas"))
                .andExpect(jsonPath("$.tags[1].tag").value("vitoria"));

        // novas publicações de outras pessoas
        mvc.perform(auth(get("/api/community/posts/new-count").param("since", "2020-01-01T00:00:00Z"), third))
                .andExpect(jsonPath("$.count").value(1));
        mvc.perform(auth(get("/api/community/posts/new-count").param("since", "2020-01-01T00:00:00Z"), owner))
                .andExpect(jsonPath("$.count").value(0));

        mvc.perform(auth(delete("/api/community/posts/" + postId), adminToken())).andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/community/posts"), owner)).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void adminPostNotifiesMembersRespectingPrefs() throws Exception {
        String wants = memberToken("pia@lure.com.br");
        String optedOut = memberToken("rui@lure.com.br");
        mvc.perform(auth(put("/api/me/notification-prefs"), optedOut).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("community", false, "replies", true, "newContent", true))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.community").value(false));

        createPost(adminToken(), "Live amanhã às 19h!", "Insight", null).andExpect(status().isCreated());

        mvc.perform(auth(get("/api/notifications"), wants))
                .andExpect(jsonPath("$.unread").value(1))
                .andExpect(jsonPath("$.items[0].type").value("COMMUNITY"))
                .andExpect(jsonPath("$.items[0].link", startsWith("/comunidade?post=")));
        mvc.perform(auth(get("/api/notifications"), optedOut)).andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void authorProfileIsAlwaysCurrent() throws Exception {
        String member = memberToken("sol@lure.com.br");
        createPost(member, "Primeiro post", "Networking", null).andExpect(status().isCreated());
        mvc.perform(auth(put("/api/me"), member).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("fullName", "Sol Nascente")))).andExpect(status().isOk());
        mvc.perform(auth(get("/api/community/posts"), member))
                .andExpect(jsonPath("$[0].author.fullName").value("Sol Nascente"));

        User noName = createUser("sem.nome@lure.com.br", Role.MEMBER, null);
        String token = login(noName.getEmail(), PASSWORD).get("accessToken").asText();
        createPost(token, "Oi", "Networking", null).andExpect(status().isCreated())
                .andExpect(jsonPath("$.author.fullName").value("sem.nome"));
    }

    @Test
    void feedRankingFiltersSearchAndPreviews() throws Exception {
        String ana = memberToken("ana@lure.com.br");
        String bia = memberToken("bia@lure.com.br");
        String caio = memberToken("caio@lure.com.br");

        String growth = postId(createPost(ana, "Dobrei o faturamento com essa rotina #Growth", "Conquista", null));
        String pixel = postId(createPost(bia, "Alguém sabe configurar o pixel da Meta? #trafego", "Dúvida", null));
        String hacks = postId(createPost(caio, "Case completo de #growthhacks, 100% orgânico", "Case", null));
        age(growth, 5 * 60);
        age(pixel, 60);
        age(hacks, 30);

        // o post mais antigo vira conversa: 2 curtidas + 4 comentários
        mvc.perform(auth(post("/api/community/posts/" + growth + "/like"), bia)).andExpect(status().isOk());
        mvc.perform(auth(post("/api/community/posts/" + growth + "/like"), caio)).andExpect(status().isOk());
        comment(growth, bia, "Que rotina?");
        comment(growth, caio, "Conta mais!");
        comment(growth, bia, "Salvei!");
        comment(growth, ana, "Posto amanhã");

        assertThat(ids(get("/api/community/posts"), ana)).containsExactly(hacks, pixel, growth);
        // em alta: engajamento vence a idade
        assertThat(ids(get("/api/community/posts").param("sort", "hot"), ana)).containsExactly(growth, hacks, pixel);
        assertThat(ids(get("/api/community/posts").param("sort", "hot").param("offset", "1").param("limit", "1"), ana))
                .containsExactly(hacks);

        // hashtag exata (#growth não casa #growthhacks), sem diferenciar maiúsculas
        assertThat(ids(get("/api/community/posts").param("tag", "growth"), ana)).containsExactly(growth);
        assertThat(ids(get("/api/community/posts").param("tag", "#GrowthHacks").param("sort", "hot"), ana))
                .containsExactly(hacks);

        // busca no texto (curingas do LIKE são literais) e no nome do autor
        assertThat(ids(get("/api/community/posts").param("q", "PIXEL"), ana)).containsExactly(pixel);
        assertThat(ids(get("/api/community/posts").param("q", "100%"), ana)).containsExactly(hacks);
        assertThat(ids(get("/api/community/posts").param("q", "%"), ana)).containsExactly(hacks);
        assertThat(ids(get("/api/community/posts").param("q", "membro caio"), ana)).containsExactly(hacks);

        assertThat(ids(get("/api/community/posts").param("unanswered", "true"), ana)).containsExactly(hacks, pixel);

        // prévia: os 2 comentários mais novos, do mais antigo pro mais novo
        mvc.perform(auth(get("/api/community/posts/" + growth), bia))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commentsCount").value(4))
                .andExpect(jsonPath("$.likedByMe").value(true))
                .andExpect(jsonPath("$.recentComments.length()").value(2))
                .andExpect(jsonPath("$.recentComments[0].body").value("Salvei!"))
                .andExpect(jsonPath("$.recentComments[1].body").value("Posto amanhã"))
                .andExpect(jsonPath("$.recentComments[1].author.fullName").value("Membro ana"));
        mvc.perform(auth(get("/api/community/posts").param("sort", "hot"), ana))
                .andExpect(jsonPath("$[0].recentComments.length()").value(2))
                .andExpect(jsonPath("$[1].recentComments.length()").value(0));
        mvc.perform(auth(get("/api/community/posts/" + UUID.randomUUID()), ana)).andExpect(status().isNotFound());

        mvc.perform(auth(get("/api/community/posts").param("sort", "top"), ana)).andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/community/posts").param("tag", "a b"), ana)).andExpect(status().isBadRequest());

        // quem mais movimentou na semana: bia (1 post + 2 comentários)
        mvc.perform(auth(get("/api/community/stats"), ana))
                .andExpect(jsonPath("$.topVoices[0].author.fullName").value("Membro bia"))
                .andExpect(jsonPath("$.topVoices[0].posts").value(1))
                .andExpect(jsonPath("$.topVoices[0].comments").value(2))
                .andExpect(jsonPath("$.topVoices.length()").value(3));

        // aviso de posts novos traz quem postou (mais recente primeiro, sem o próprio usuário)
        mvc.perform(auth(get("/api/community/posts/new-count").param("since", "2020-01-01T00:00:00Z"), ana))
                .andExpect(jsonPath("$.count").value(2))
                .andExpect(jsonPath("$.authors.length()").value(2))
                .andExpect(jsonPath("$.authors[0].fullName").value("Membro caio"));

        // notificação de comentário abre direto a conversa
        mvc.perform(auth(get("/api/notifications"), ana))
                .andExpect(jsonPath("$.items[0].link").value("/comunidade?post=" + growth));
    }

    private String postId(ResultActions created) throws Exception {
        return read(created.andExpect(status().isCreated()).andReturn()).get("id").asText();
    }

    private void age(String postId, long minutes) {
        jdbc.update("UPDATE community_posts SET created_at = ? WHERE id = ?",
                Timestamp.from(Instant.now().minus(minutes, ChronoUnit.MINUTES)), UUID.fromString(postId));
    }

    private void comment(String postId, String token, String body) throws Exception {
        mvc.perform(auth(post("/api/community/posts/" + postId + "/comments"), token)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("body", body))))
                .andExpect(status().isCreated());
    }

    private List<String> ids(MockHttpServletRequestBuilder req, String token) throws Exception {
        JsonNode list = read(mvc.perform(auth(req, token)).andExpect(status().isOk()).andReturn());
        List<String> out = new ArrayList<>();
        list.forEach(p -> out.add(p.get("id").asText()));
        return out;
    }

    private ResultActions createPost(String token, String body, String category, MockMultipartFile image)
            throws Exception {
        return createPost(token, body, category, image, null, null);
    }

    private ResultActions createPost(String token, String body, String category, MockMultipartFile image,
                                     String width, String height) throws Exception {
        var request = multipart("/api/community/posts");
        if (image != null) {
            request.file(image);
        }
        request.param("body", body).param("category", category);
        if (width != null) {
            request.param("imageWidth", width).param("imageHeight", height);
        }
        return mvc.perform(auth(request, token));
    }

    private String currentPostId(String token) throws Exception {
        return read(mvc.perform(auth(get("/api/community/posts"), token)).andReturn()).at("/0/id").asText();
    }

    private ResultActions like(String token) throws Exception {
        return mvc.perform(auth(post("/api/community/posts/" + currentPostId(token) + "/like"), token))
                .andExpect(status().isOk());
    }
}
