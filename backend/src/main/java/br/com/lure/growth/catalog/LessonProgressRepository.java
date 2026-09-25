package br.com.lure.growth.catalog;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LessonProgressRepository extends JpaRepository<LessonProgress, UUID> {

    Optional<LessonProgress> findByUserIdAndLessonId(UUID userId, UUID lessonId);

    @Query("select p from LessonProgress p where p.userId = :userId and p.lessonId in :lessonIds")
    List<LessonProgress> findByUserAndLessons(@Param("userId") UUID userId,
                                              @Param("lessonIds") Collection<UUID> lessonIds);

    /** Aulas concluídas pelo usuário, agrupadas por módulo (uma consulta para o catálogo inteiro). */
    @Query("""
            select l.courseId as courseId, count(p) as completed
            from LessonProgress p join Lesson l on l.id = p.lessonId
            where p.userId = :userId and p.completed = true
            group by l.courseId
            """)
    List<CourseCompletion> completedPerCourse(@Param("userId") UUID userId);

    /** Última atividade do usuário em cada módulo (concluída ou não). */
    @Query("""
            select l.courseId as courseId, max(p.updatedAt) as lastActivity
            from LessonProgress p join Lesson l on l.id = p.lessonId
            where p.userId = :userId
            group by l.courseId
            """)
    List<CourseActivity> activityPerCourse(@Param("userId") UUID userId);

    @Query("""
            select count(p) from LessonProgress p join Lesson l on l.id = p.lessonId
            where p.userId = :userId and p.completed = true and l.courseId = :courseId
            """)
    long countCompletedInCourse(@Param("userId") UUID userId, @Param("courseId") UUID courseId);

    /** Candidatos a "continuar assistindo": em módulos liberados, mais recentes primeiro. */
    @Query("""
            select p from LessonProgress p
              join Lesson l on l.id = p.lessonId
              join Course c on c.id = l.courseId
            where p.userId = :userId and c.locked = false
              and (p.lastPosition > 0 or p.completed = false)
            order by p.updatedAt desc
            """)
    List<LessonProgress> findContinueCandidates(@Param("userId") UUID userId, Pageable page);

    long countByCompletedTrue();

    interface CourseCompletion {
        UUID getCourseId();

        long getCompleted();
    }

    interface CourseActivity {
        UUID getCourseId();

        Instant getLastActivity();
    }
}
