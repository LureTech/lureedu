package br.com.lure.growth.common;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Substitui o "/error" padrão do Spring Boot para que erros fora dos controllers (filtros, container)
 * também saiam no formato {@link ApiError}.
 */
@RestController
public class ApiErrorController implements ErrorController {

    @RequestMapping("/error")
    public ResponseEntity<ApiError> error(HttpServletRequest request) {
        Object code = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        HttpStatus status = code instanceof Integer c && HttpStatus.resolve(c) != null
                ? HttpStatus.resolve(c)
                : HttpStatus.INTERNAL_SERVER_ERROR;
        String message = switch (status) {
            case NOT_FOUND -> "Recurso não encontrado.";
            case UNAUTHORIZED -> Messages.LOGIN_REQUIRED;
            case FORBIDDEN -> Messages.NO_PERMISSION;
            case PAYLOAD_TOO_LARGE -> "Arquivo grande demais. O limite é de 50 MB.";
            default -> status.is5xxServerError() ? Messages.UNEXPECTED : "Requisição inválida.";
        };
        return ResponseEntity.status(status).body(ApiError.of(status, message));
    }
}
