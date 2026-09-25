package br.com.lure.growth.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** Progresso de um usuário em uma aula (uma linha por usuário+aula). */
@Entity
@Table(name = "lesson_progress")
public class LessonProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "lesson_id", nullable = false)
    private UUID lessonId;

    @Column(nullable = false)
    private boolean completed;

    @Column(name = "watched_seconds", nullable = false)
    private int watchedSeconds;

    @Column(name = "last_position", nullable = false)
    private int lastPosition;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected LessonProgress() {
    }

    public LessonProgress(UUID userId, UUID lessonId) {
        this.userId = userId;
        this.lessonId = lessonId;
    }

    /** Marca/desmarca a conclusão, registrando quando foi concluída. */
    public void setCompleted(boolean completed, Instant now) {
        if (completed && !this.completed) {
            this.completedAt = now;
        } else if (!completed) {
            this.completedAt = null;
        }
        this.completed = completed;
    }

    /** {@code watchedSeconds} nunca diminui. */
    public void addWatchedSeconds(int value) {
        this.watchedSeconds = Math.max(this.watchedSeconds, value);
    }

    public void setLastPosition(int lastPosition) {
        this.lastPosition = lastPosition;
    }

    public void touch(Instant now) {
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getLessonId() {
        return lessonId;
    }

    public boolean isCompleted() {
        return completed;
    }

    public int getWatchedSeconds() {
        return watchedSeconds;
    }

    public int getLastPosition() {
        return lastPosition;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
