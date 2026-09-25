package br.com.lure.growth.auth;

import br.com.lure.growth.user.Role;

import java.security.Principal;
import java.util.UUID;

/**
 * Usuário autenticado da requisição atual (montado pelo {@link ActiveUserFilter} com o papel atual do banco).
 * Injete nos controllers com {@code @AuthenticationPrincipal AuthUser me}.
 */
public record AuthUser(UUID id, String email, Role role) implements Principal {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    @Override
    public String getName() {
        return id.toString();
    }
}
