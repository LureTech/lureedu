package br.com.lure.growth.catalog;

import br.com.lure.growth.common.StringListJsonConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "quiz_questions")
public class QuizQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "course_id", nullable = false)
    private UUID courseId;

    @Column(nullable = false)
    private int position;

    @Column(name = "question_text", nullable = false, length = 1000)
    private String text;

    /** Alternativas (2 a 6), guardadas como JSON. */
    @Convert(converter = StringListJsonConverter.class)
    @Column(name = "options_json", nullable = false, length = 4000)
    private List<String> options = new ArrayList<>();

    @Column(name = "correct_index", nullable = false)
    private int correctIndex;

    protected QuizQuestion() {
    }

    public QuizQuestion(UUID courseId, int position, String text, List<String> options, int correctIndex) {
        this.courseId = courseId;
        this.position = position;
        this.text = text;
        this.options = new ArrayList<>(options);
        this.correctIndex = correctIndex;
    }

    public UUID getId() {
        return id;
    }

    public UUID getCourseId() {
        return courseId;
    }

    public int getPosition() {
        return position;
    }

    public String getText() {
        return text;
    }

    public List<String> getOptions() {
        return options;
    }

    public int getCorrectIndex() {
        return correctIndex;
    }
}
