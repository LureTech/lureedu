package br.com.lure.growth.auth;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limite de tentativas de login em memória: 5 falhas para o mesmo e-mail em 15 minutos → bloqueio
 * até a falha mais antiga sair da janela.
 */
@Component
public class LoginAttemptService {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int CLEANUP_THRESHOLD = 10_000;

    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    public boolean isBlocked(String email) {
        Deque<Instant> deque = failures.get(email);
        if (deque == null) {
            return false;
        }
        synchronized (deque) {
            prune(deque, Instant.now());
            return deque.size() >= MAX_FAILURES;
        }
    }

    public void recordFailure(String email) {
        if (failures.size() > CLEANUP_THRESHOLD) {
            cleanup();
        }
        Deque<Instant> deque = failures.computeIfAbsent(email, k -> new ArrayDeque<>());
        synchronized (deque) {
            Instant now = Instant.now();
            prune(deque, now);
            deque.addLast(now);
        }
    }

    public void reset(String email) {
        failures.remove(email);
    }

    private static void prune(Deque<Instant> deque, Instant now) {
        Instant limit = now.minus(WINDOW);
        while (!deque.isEmpty() && deque.peekFirst().isBefore(limit)) {
            deque.pollFirst();
        }
    }

    private void cleanup() {
        Instant now = Instant.now();
        failures.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                prune(e.getValue(), now);
                return e.getValue().isEmpty();
            }
        });
    }
}
