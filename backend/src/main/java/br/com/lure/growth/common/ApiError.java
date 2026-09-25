package br.com.lure.growth.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * Corpo padrão de erro: {@code { status, error, message, fields? }}.
 * {@code fields} só aparece em erros de validação.
 */
public record ApiError(
        int status,
        String error,
        String message,
        @JsonInclude(JsonInclude.Include.NON_NULL) Map<String, String> fields
) {

    public static ApiError of(HttpStatus status, String message) {
        return new ApiError(status.value(), status.getReasonPhrase(), message, null);
    }

    public static ApiError of(HttpStatus status, String message, Map<String, String> fields) {
        return new ApiError(status.value(), status.getReasonPhrase(), message, fields);
    }
}
