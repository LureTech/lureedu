package br.com.lure.growth.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, UUID> {

    boolean existsByUserIdAndCourseIdAndPassedTrue(UUID userId, UUID courseId);

    @Query("""
            select count(a) as attempts, max(a.score) as bestScore,
                   sum(case when a.passed = true then 1 else 0 end) as passedCount
            from QuizAttempt a where a.userId = :userId and a.courseId = :courseId
            """)
    AttemptStats stats(@Param("userId") UUID userId, @Param("courseId") UUID courseId);

    interface AttemptStats {
        Long getAttempts();

        Integer getBestScore();

        Long getPassedCount();
    }
}
