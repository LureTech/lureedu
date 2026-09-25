package br.com.lure.growth.user;

import br.com.lure.growth.storage.StorageService;

import java.util.UUID;

/** Autor de post/comentário — sempre montado a partir do perfil atual. */
public record AuthorDto(UUID id, String fullName, String avatarUrl) {

    public static AuthorDto from(User u) {
        return new AuthorDto(u.getId(), u.displayName(), StorageService.urlOf(u.getAvatarPath()));
    }

    /** Autor de uma conta que não existe mais (não deve acontecer por causa do CASCADE). */
    public static AuthorDto unknown(UUID id) {
        return new AuthorDto(id, "Usuário", null);
    }
}
