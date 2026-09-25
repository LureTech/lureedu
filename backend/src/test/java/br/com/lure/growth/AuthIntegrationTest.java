package br.com.lure.growth;

import br.com.lure.growth.user.Role;
import br.com.lure.growth.user.User;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthIntegrationTest extends IntegrationTestBase {

    private static final String BLOCKED_MESSAGE =
            "Sua conta está sem acesso no momento. Fale com o administrador para liberar.";

    @Test
    void loginOkReturnsTokensAndUser() throws Exception {
        createUser("ana@lure.com.br", Role.MEMBER, "Ana");

        JsonNode body = login("ANA@lure.com.br", PASSWORD);

        assertThat(body.get("accessToken").asText()).isNotBlank();
        assertThat(body.get("refreshToken").asText()).isNotBlank();
        assertThat(body.get("expiresIn").asInt()).isEqualTo(900);
        assertThat(body.at("/user/email").asText()).isEqualTo("ana@lure.com.br");
        assertThat(body.at("/user/role").asText()).isEqualTo("MEMBER");
        assertThat(body.at("/user/lastLoginAt").isNull()).isFalse();
        assertThat(body.at("/user").has("avatarUrl")).isTrue(); // campos nulos presentes

        mvc.perform(auth(get("/api/auth/me"), body.get("accessToken").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Ana"));
    }

    @Test
    void wrongPasswordIs401WithContractMessage() throws Exception {
        createUser("bia@lure.com.br", Role.MEMBER, "Bia");

        MvcResult r = loginResult("bia@lure.com.br", "senha-errada", false);

        assertThat(r.getResponse().getStatus()).isEqualTo(401);
        JsonNode err = read(r);
        assertThat(err.get("status").asInt()).isEqualTo(401);
        assertThat(err.get("error").asText()).isEqualTo("Unauthorized");
        assertThat(err.get("message").asText()).isEqualTo("E-mail ou senha incorretos.");
        assertThat(err.has("fields")).isFalse();
    }

    @Test
    void validationErrorsHaveFields() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "nao-e-email", "password", ""))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.email").value("E-mail inválido."))
                .andExpect(jsonPath("$.fields.password").value("Informe a senha."));
    }

    @Test
    void blockedUserCannotLoginRefreshOrUseToken() throws Exception {
        User user = createUser("caio@lure.com.br", Role.MEMBER, "Caio");
        JsonNode session = login("caio@lure.com.br", PASSWORD);
        String access = session.get("accessToken").asText();

        mvc.perform(auth(patch("/api/admin/users/" + user.getId()), adminToken())
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("active", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        // login → 403
        MvcResult r = loginResult("caio@lure.com.br", PASSWORD, false);
        assertThat(r.getResponse().getStatus()).isEqualTo(403);
        assertThat(read(r).get("message").asText()).isEqualTo(BLOCKED_MESSAGE);

        // token ainda válido → 403 em qualquer rota
        mvc.perform(auth(get("/api/catalog"), access))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(BLOCKED_MESSAGE));

        // refresh → 403 com a mesma mensagem
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("refreshToken", session.get("refreshToken").asText()))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(BLOCKED_MESSAGE));

        // liberado de novo → a sessão volta a funcionar
        mvc.perform(auth(patch("/api/admin/users/" + user.getId()), adminToken())
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("active", true))))
                .andExpect(status().isOk());
        mvc.perform(auth(get("/api/catalog"), access)).andExpect(status().isOk());
    }

    @Test
    void refreshRotatesTokens() throws Exception {
        createUser("davi@lure.com.br", Role.MEMBER, "Davi");
        JsonNode first = login("davi@lure.com.br", PASSWORD);
        String oldRefresh = first.get("refreshToken").asText();

        MvcResult rotated = mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("refreshToken", oldRefresh))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode second = read(rotated);
        String newRefresh = second.get("refreshToken").asText();
        assertThat(newRefresh).isNotEqualTo(oldRefresh);
        mvc.perform(auth(get("/api/auth/me"), second.get("accessToken").asText())).andExpect(status().isOk());

        // o antigo foi revogado
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("refreshToken", oldRefresh))))
                .andExpect(status().isUnauthorized());

        // logout revoga o novo
        mvc.perform(post("/api/auth/logout").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("refreshToken", newRefresh))))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("refreshToken", newRefresh))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void fiveFailuresTriggerRateLimit() throws Exception {
        createUser("eva@lure.com.br", Role.MEMBER, "Eva");
        for (int i = 0; i < 5; i++) {
            assertThat(loginResult("eva@lure.com.br", "errada", false).getResponse().getStatus()).isEqualTo(401);
        }
        MvcResult r = loginResult("eva@lure.com.br", PASSWORD, false);
        assertThat(r.getResponse().getStatus()).isEqualTo(429);
        assertThat(read(r).get("message").asText())
                .isEqualTo("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
    }

    @Test
    void memberGets403OnAdminRoutesAndAnonymousGets401() throws Exception {
        String member = memberToken("fabio@lure.com.br");

        mvc.perform(auth(get("/api/admin/stats"), member)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").exists());
        mvc.perform(auth(get("/api/admin/users"), member)).andExpect(status().isForbidden());
        mvc.perform(auth(post("/api/admin/modules"), member).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("sectionId", "intro", "title", "X", "locked", false))))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/catalog")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
        mvc.perform(get("/api/catalog").header("Authorization", "Bearer lixo")).andExpect(status().isUnauthorized());

        mvc.perform(auth(get("/api/admin/stats"), adminToken())).andExpect(status().isOk())
                .andExpect(jsonPath("$.admins").value(1));
    }

    @Test
    void adminCannotChangeOwnAccess() throws Exception {
        String admin = adminToken();
        String adminId = users.findByEmail(ADMIN_EMAIL).orElseThrow().getId().toString();
        mvc.perform(auth(patch("/api/admin/users/" + adminId), admin).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("role", "MEMBER"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Você não pode alterar o próprio acesso."));
    }

    @Test
    void forgotPasswordAlways204() throws Exception {
        mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "ninguem@lure.com.br"))))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("token", "invalido", "newPassword", "12345678"))))
                .andExpect(status().isBadRequest());
    }
}
