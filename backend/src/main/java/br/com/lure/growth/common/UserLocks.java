package br.com.lure.growth.common;

import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

/**
 * Serializa operações de um mesmo usuário que fazem "ler → decidir → gravar"
 * (upsert de progresso, emissão de certificado, limites de publicação, curtidas).
 * O lock envolve a transação inteira, então a próxima requisição já enxerga o commit anterior.
 * <p>
 * Locks em memória: válidos para uma única instância da aplicação (as constraints únicas do
 * banco continuam sendo a última linha de defesa).
 */
@Component
public class UserLocks {

    private static final int STRIPES = 256;

    private final ReentrantLock[] locks = new ReentrantLock[STRIPES];
    private final TransactionTemplate tx;

    public UserLocks(PlatformTransactionManager transactionManager) {
        for (int i = 0; i < STRIPES; i++) {
            locks[i] = new ReentrantLock();
        }
        this.tx = new TransactionTemplate(transactionManager);
    }

    /** Executa {@code work} dentro de uma transação, com o lock do usuário. */
    public <T> T inTransaction(UUID userId, Supplier<T> work) {
        ReentrantLock lock = locks[Math.floorMod(userId.hashCode(), STRIPES)];
        lock.lock();
        try {
            return tx.execute(status -> work.get());
        } finally {
            lock.unlock();
        }
    }
}
