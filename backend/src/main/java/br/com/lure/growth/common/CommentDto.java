package br.com.lure.growth.common;

import br.com.lure.growth.user.AuthorDto;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.UUID;

/** Comentário (módulo ou comunidade). {@code canDelete} é calculado para quem está pedindo. */
public record CommentDto(UUID id, String body, Instant createdAt, AuthorDto author, boolean canDelete) {

    /** Corpo de criação de comentário; o limite de tamanho é validado no serviço (1000 ou 300). */
    public record CreateCommentRequest(@NotBlank(message = "Escreva um comentário.") String body) {
    }
}
