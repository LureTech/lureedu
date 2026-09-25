package br.com.lure.growth.diagnostic;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Diagnóstico respondido. Guarda as respostas (JSON) e a nota geral; o resultado completo é recalculado
 * na leitura (assim as seções recomendadas refletem o catálogo atual).
 */
@Entity
@Table(name = "diagnostic_submissions")
public class DiagnosticSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "answers_json", nullable = false, length = 2000)
    private String answersJson;

    @Column(nullable = false)
    private double overall;

    @Column(name = "overall_label", nullable = false, length = 20)
    private String overallLabel;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected DiagnosticSubmission() {
    }

    public DiagnosticSubmission(UUID userId, String answersJson, double overall, String overallLabel,
                                Instant createdAt) {
        this.userId = userId;
        this.answersJson = answersJson;
        this.overall = overall;
        this.overallLabel = overallLabel;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getAnswersJson() {
        return answersJson;
    }

    public double getOverall() {
        return overall;
    }

    public String getOverallLabel() {
        return overallLabel;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
