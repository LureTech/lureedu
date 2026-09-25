package br.com.lure.growth.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Certificado de conclusão. Guarda um "retrato" (nome do aluno, títulos, autor, nº de aulas) do momento
 * da emissão; {@code courseId} vira null se o módulo for apagado — o certificado continua válido.
 */
@Entity
@Table(name = "certificates")
public class Certificate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 20)
    private String code;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "course_id")
    private UUID courseId;

    @Column(name = "student_name", nullable = false, length = 120)
    private String studentName;

    @Column(name = "module_title", nullable = false, length = 160)
    private String moduleTitle;

    @Column(name = "section_title", nullable = false, length = 120)
    private String sectionTitle;

    @Column(length = 120)
    private String author;

    @Column(name = "lesson_count", nullable = false)
    private int lessonCount;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    protected Certificate() {
    }

    public Certificate(String code, UUID userId, UUID courseId, String studentName, String moduleTitle,
                       String sectionTitle, String author, int lessonCount, Instant issuedAt) {
        this.code = code;
        this.userId = userId;
        this.courseId = courseId;
        this.studentName = studentName;
        this.moduleTitle = moduleTitle;
        this.sectionTitle = sectionTitle;
        this.author = author;
        this.lessonCount = lessonCount;
        this.issuedAt = issuedAt;
    }

    public UUID getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getCourseId() {
        return courseId;
    }

    public String getStudentName() {
        return studentName;
    }

    public String getModuleTitle() {
        return moduleTitle;
    }

    public String getSectionTitle() {
        return sectionTitle;
    }

    public String getAuthor() {
        return author;
    }

    public int getLessonCount() {
        return lessonCount;
    }

    public Instant getIssuedAt() {
        return issuedAt;
    }
}
