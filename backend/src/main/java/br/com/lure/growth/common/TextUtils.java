package br.com.lure.growth.common;

import java.text.Normalizer;
import java.util.Locale;
import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * Utilitários de texto: normalização para busca e geração de slugs.
 */
public final class TextUtils {

    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]+");
    private static final Pattern EDGE_DASHES = Pattern.compile("(^-+)|(-+$)");

    private TextUtils() {
    }

    /** Remove acentos e passa para minúsculas ("Gestão" → "gestao"). */
    public static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(value, Normalizer.Form.NFD);
        return DIACRITICS.matcher(decomposed).replaceAll("").toLowerCase(Locale.ROOT);
    }

    /** "Call de Vendas: Fechamento!" → "call-de-vendas-fechamento". */
    public static String slugify(String value, int maxLength) {
        String slug = NON_ALNUM.matcher(normalize(value)).replaceAll("-");
        slug = EDGE_DASHES.matcher(slug).replaceAll("");
        if (slug.length() > maxLength) {
            slug = EDGE_DASHES.matcher(slug.substring(0, maxLength)).replaceAll("");
        }
        return slug;
    }

    /**
     * Gera um slug único: se {@code base} já existir, tenta {@code base-2}, {@code base-3}…
     */
    public static String uniqueSlug(String title, int maxLength, String fallback, Predicate<String> exists) {
        String base = slugify(title, maxLength - 4);
        if (base.isEmpty()) {
            base = fallback;
        }
        String candidate = base;
        int n = 2;
        while (exists.test(candidate)) {
            candidate = base + "-" + n++;
        }
        return candidate;
    }

    /** Trim; string vazia vira null. */
    public static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String t = value.strip();
        return t.isEmpty() ? null : t;
    }

    public static String trimToEmpty(String value) {
        return value == null ? "" : value.strip();
    }

    public static String excerpt(String value, int max) {
        if (value == null) {
            return null;
        }
        String t = value.strip().replaceAll("\\s+", " ");
        if (t.isEmpty()) {
            return null;
        }
        return t.length() <= max ? t : t.substring(0, max - 1).stripTrailing() + "…";
    }
}
