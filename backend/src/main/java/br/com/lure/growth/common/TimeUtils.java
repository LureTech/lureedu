package br.com.lure.growth.common;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;

public final class TimeUtils {

    public static final ZoneId SAO_PAULO = ZoneId.of("America/Sao_Paulo");

    private TimeUtils() {
    }

    /** "Agora" com precisão de milissegundos (igual ao que o frontend consegue representar). */
    public static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MILLIS);
    }

    /** Início do dia de hoje no fuso de São Paulo. */
    public static Instant startOfTodaySaoPaulo() {
        return ZonedDateTime.now(SAO_PAULO).truncatedTo(ChronoUnit.DAYS).toInstant();
    }

    /** Aceita ISO-8601 com "Z" ou com offset. Vazio → null. Inválido → 400. */
    public static Instant parseInstant(String value, String paramName) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String v = value.strip();
        try {
            return Instant.parse(v);
        } catch (DateTimeParseException e) {
            try {
                return OffsetDateTime.parse(v).toInstant();
            } catch (DateTimeParseException e2) {
                throw ApiException.badRequest("Parâmetro inválido: " + paramName + ".");
            }
        }
    }
}
