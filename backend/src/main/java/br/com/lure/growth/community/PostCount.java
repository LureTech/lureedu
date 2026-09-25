package br.com.lure.growth.community;

import java.util.UUID;

/** Projeção "id do post → quantidade" usada nas contagens em lote (curtidas, comentários). */
public interface PostCount {

    UUID getPostId();

    long getN();
}
