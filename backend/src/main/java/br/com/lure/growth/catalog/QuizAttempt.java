package br.com.lure.growth.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "quiz_attempts")
public class QuizAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "course_id", nullable = false)
    private UUID courseId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private int score;

    @Column(nullable = false)
    private boolean passed;

    @Column(name = "answers_json", nullable = false, length = 4000)
    private String answersJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected QuizAttempt() {
    }

    public QuizAttempt(UUID courseId, UUID userId, int score, boolean passed, String answersJson, Instant createdAt) {
        this.courseId = courseId;
        this.userId = userId;
        this.score = score;
        this.passed = passed;
        this.answersJson = answersJson;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getCourseId() {
        return courseId;
    }

    public UUID getUserId() {
        return userId;
    }

    public int getScore() {
        return score;
    }

    public boolean isPassed() {
        return passed;
    }

    public String getAnswersJson() {
        return answersJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
