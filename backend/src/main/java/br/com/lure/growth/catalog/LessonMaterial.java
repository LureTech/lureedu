package br.com.lure.growth.catalog;

import br.com.lure.growth.common.TimeUtils;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** Material complementar de uma aula (PDF, planilha…). O nome original fica no {@code label}. */
@Entity
@Table(name = "lesson_materials")
public class LessonMaterial {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "lesson_id", nullable = false)
    private UUID lessonId;

    @Column(nullable = false)
    private String label;

    @Column(name = "file_path", nullable = false)
    private String filePath;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "content_type", length = 150)
    private String contentType;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected LessonMaterial() {
    }

    public LessonMaterial(UUID lessonId, String label, String filePath, long sizeBytes, String contentType) {
        this.lessonId = lessonId;
        this.label = label;
        this.filePath = filePath;
        this.sizeBytes = sizeBytes;
        this.contentType = contentType;
    }

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = TimeUtils.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getLessonId() {
        return lessonId;
    }

    public String getLabel() {
        return label;
    }

    public String getFilePath() {
        return filePath;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public String getContentType() {
        return contentType;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
