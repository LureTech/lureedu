package br.com.lure.growth;

import br.com.lure.growth.user.Role;
import br.com.lure.growth.user.User;
import br.com.lure.growth.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Base dos testes de integração: contexto Spring completo + H2 em memória (perfil "test").
 * Antes de cada teste o banco volta ao estado "recém-instalado" (admin + 9 seções padrão).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTestBase {

    protected static final String ADMIN_EMAIL = "admin@lure.com.br";
    protected static final String ADMIN_PASSWORD = "Lure@2026";
    protected static final String PASSWORD = "Senha@1234";

    @Autowired
    protected MockMvc mvc;
    @Autowired
    protected ObjectMapper json;
    @Autowired
    protected JdbcTemplate jdbc;
    @Autowired
    protected UserRepository users;
    @Autowired
    protected PasswordEncoder passwordEncoder;

    @BeforeEach
    void resetDatabase() {
        jdbc.update("DELETE FROM community_posts");
        jdbc.update("DELETE FROM notifications");
        jdbc.update("DELETE FROM diagnostic_submissions");
        jdbc.update("DELETE FROM certificates");
        jdbc.update("DELETE FROM courses");
        jdbc.update("DELETE FROM refresh_tokens");
        jdbc.update("DELETE FROM password_reset_tokens");
        jdbc.update("DELETE FROM notification_prefs");
        jdbc.update("DELETE FROM users WHERE email <> ?", ADMIN_EMAIL);
        jdbc.update("DELETE FROM sections WHERE id NOT IN "
                + "('intro','social','call','rh','comercial','marketing','trafego','ia','conteudo')");
    }

    // ------------------------------------------------------------------ usuários e tokens

    protected User createUser(String email, Role role, String fullName) {
        return users.save(new User(email, passwordEncoder.encode(PASSWORD), fullName, role));
    }

    protected MvcResult loginResult(String email, String password, boolean rememberMe) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", email, "password", password, "rememberMe", rememberMe))))
                .andReturn();
    }

    protected JsonNode login(String email, String password) throws Exception {
        MvcResult result = loginResult(email, password, false);
        if (result.getResponse().getStatus() != 200) {
            throw new AssertionError("Login falhou: " + result.getResponse().getContentAsString());
        }
        return read(result);
    }

    protected String adminToken() throws Exception {
        return login(ADMIN_EMAIL, ADMIN_PASSWORD).get("accessToken").asText();
    }

    /** Cria um membro e devolve o access token dele. */
    protected String memberToken(String email) throws Exception {
        createUser(email, Role.MEMBER, "Membro " + email.substring(0, email.indexOf('@')));
        return login(email, PASSWORD).get("accessToken").asText();
    }

    protected static <T extends MockHttpServletRequestBuilder> T auth(T builder, String token) {
        builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        return builder;
    }

    // ------------------------------------------------------------------ catálogo via API admin

    protected JsonNode createModule(String adminToken, String sectionId, String title, boolean locked) throws Exception {
        MvcResult r = mvc.perform(auth(post("/api/admin/modules"), adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("sectionId", sectionId, "title", title, "locked", locked,
                                "author", "Time LURE"))))
                .andExpect(status().isCreated())
                .andReturn();
        return read(r);
    }

    protected JsonNode addLesson(String adminToken, String moduleId, String title) throws Exception {
        MvcResult r = mvc.perform(auth(post("/api/admin/modules/" + moduleId + "/lessons"), adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("title", title, "videoUrl", "https://youtu.be/dQw4w9WgXcQ"))))
                .andExpect(status().isCreated())
                .andReturn();
        return read(r);
    }

    // ------------------------------------------------------------------ JSON

    protected String toJson(Object value) throws Exception {
        return json.writeValueAsString(value);
    }

    protected JsonNode read(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString());
    }
}
