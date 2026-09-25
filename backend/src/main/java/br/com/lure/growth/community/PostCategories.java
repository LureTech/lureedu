package br.com.lure.growth.community;

import br.com.lure.growth.common.TextUtils;

import java.util.List;
import java.util.Optional;

/** Categorias válidas de post (o valor gravado/retornado é o rótulo com acento). */
public final class PostCategories {

    public static final List<String> ALL = List.of("Conquista", "Dúvida", "Networking", "Case", "Insight");

    private PostCategories() {
    }

    /** Aceita variações de caixa/acento ("duvida" → "Dúvida"). */
    public static Optional<String> resolve(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        String normalized = TextUtils.normalize(value.strip());
        return ALL.stream().filter(c -> TextUtils.normalize(c).equals(normalized)).findFirst();
    }
}
