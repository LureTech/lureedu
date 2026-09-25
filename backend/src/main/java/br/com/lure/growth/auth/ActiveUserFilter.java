package br.com.lure.growth.auth;

import br.com.lure.growth.common.Messages;
import br.com.lure.growth.user.Role;
import br.com.lure.growth.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Roda depois da validação do JWT: confere se a conta ainda existe e está ativa (senão 403) e
 * troca a autenticação por um {@link AuthUser} com o papel atual do banco — assim bloqueios e
 * mudanças de papel valem quase na hora, sem esperar o access token expirar.
 * <p>
 * O resultado dessa consulta fica guardado por {@value #CACHE_TTL_MS} ms por usuário: com o banco
 * na nuvem, fazer um SELECT a cada requisição custa um ida e volta de rede em tudo que o aluno faz.
 * O preço é que um bloqueio ou troca de papel pode levar até esse tempo para valer.
 * <p>
 * Não é um {@code @Component} de propósito (senão o Spring Boot o registraria também como filtro de servlet).
 */
public class ActiveUserFilter extends OncePerRequestFilter {

    /** Validade do acesso guardado em memória (15s). */
    private static final long CACHE_TTL_MS = 15_000;
    /** Teto de segurança: a partir daqui o mapa é esvaziado em vez de crescer sem limite. */
    private static final int MAX_CACHED_USERS = 5_000;

    private final UserRepository users;
    private final JsonErrorWriter errorWriter;
    private final ConcurrentMap<UUID, CachedAccess> cache = new ConcurrentHashMap<>();

    public ActiveUserFilter(UserRepository users, JsonErrorWriter errorWriter) {
        this.users = users;
        this.errorWriter = errorWriter;
    }

    private record CachedAccess(boolean active, Role role, long expiresAt) {
    }

    /** Acesso do usuário, do cache ou do banco. */
    private CachedAccess access(UUID userId) {
        long now = System.currentTimeMillis();
        CachedAccess cached = cache.get(userId);
        if (cached != null && cached.expiresAt() > now) {
            return cached;
        }
        CachedAccess fresh = users.findAccessById(userId)
                .map(a -> new CachedAccess(a.getActive(), a.getRole(), now + CACHE_TTL_MS))
                .orElseGet(() -> new CachedAccess(false, null, now + CACHE_TTL_MS));
        if (cache.size() >= MAX_CACHED_USERS) {
            cache.clear();
        }
        cache.put(userId, fresh);
        return fresh;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication current = SecurityContextHolder.getContext().getAuthentication();
        if (current instanceof JwtAuthenticationToken jwtAuth) {
            Jwt jwt = jwtAuth.getToken();
            UUID userId;
            try {
                userId = UUID.fromString(jwt.getSubject());
            } catch (IllegalArgumentException | NullPointerException e) {
                SecurityContextHolder.clearContext();
                errorWriter.write(response, HttpStatus.UNAUTHORIZED, Messages.SESSION_EXPIRED);
                return;
            }
            CachedAccess access = access(userId);
            if (!access.active() || access.role() == null) {
                SecurityContextHolder.clearContext();
                errorWriter.write(response, HttpStatus.FORBIDDEN, Messages.ACCOUNT_BLOCKED);
                return;
            }
            Role role = access.role();
            AuthUser principal = new AuthUser(userId, jwt.getClaimAsString("email"), role);
            UsernamePasswordAuthenticationToken authentication = UsernamePasswordAuthenticationToken.authenticated(
                    principal, jwt, List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
        }
        chain.doFilter(request, response);
    }
}
