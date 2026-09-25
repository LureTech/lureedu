package br.com.lure.growth.common;

import org.springframework.http.HttpStatus;

/**
 * Exceção de negócio com status HTTP e mensagem para o usuário (PT-BR).
 * Use as fábricas estáticas: {@code ApiException.notFound("...")}, etc.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static BadRequest badRequest(String message) {
        return new BadRequest(message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, message);
    }

    public static Forbidden forbidden(String message) {
        return new Forbidden(message);
    }

    public static NotFound notFound(String message) {
        return new NotFound(message);
    }

    public static Conflict conflict(String message) {
        return new Conflict(message);
    }

    public static ApiException payloadTooLarge(String message) {
        return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, message);
    }

    public static TooManyRequests tooManyRequests(String message) {
        return new TooManyRequests(message);
    }

    public static class BadRequest extends ApiException {
        public BadRequest(String message) {
            super(HttpStatus.BAD_REQUEST, message);
        }
    }

    public static class Forbidden extends ApiException {
        public Forbidden(String message) {
            super(HttpStatus.FORBIDDEN, message);
        }
    }

    public static class NotFound extends ApiException {
        public NotFound(String message) {
            super(HttpStatus.NOT_FOUND, message);
        }
    }

    public static class Conflict extends ApiException {
        public Conflict(String message) {
            super(HttpStatus.CONFLICT, message);
        }
    }

    public static class TooManyRequests extends ApiException {
        public TooManyRequests(String message) {
            super(HttpStatus.TOO_MANY_REQUESTS, message);
        }
    }
}
