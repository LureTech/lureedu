package br.com.lure.growth.community;

import java.util.UUID;

/** Projeção "id do usuário → quantidade" (quem mais postou/comentou na semana). */
public interface UserCount {

    UUID getUserId();

    long getN();
}
