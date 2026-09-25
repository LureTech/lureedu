package br.com.lure.growth.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface QuizQuestionRepository extends JpaRepository<QuizQuestion, UUID> {

    List<QuizQuestion> findByCourseIdOrderByPositionAsc(UUID courseId);

    long countByCourseId(UUID courseId);

    @Query("select q.courseId as courseId, count(q) as questions from QuizQuestion q group by q.courseId")
    List<CourseQuestionCount> countsPerCourse();

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from QuizQuestion q where q.courseId = :courseId")
    int deleteByCourse(@Param("courseId") UUID courseId);

    interface CourseQuestionCount {
        UUID getCourseId();

        long getQuestions();
    }
}
