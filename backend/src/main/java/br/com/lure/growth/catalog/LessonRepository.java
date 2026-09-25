package br.com.lure.growth.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface LessonRepository extends JpaRepository<Lesson, UUID> {

    List<Lesson> findByCourseIdOrderByPositionAsc(UUID courseId);

    long countByCourseId(UUID courseId);

    @Query("select coalesce(max(l.position), 0) from Lesson l where l.courseId = :courseId")
    int maxPosition(@Param("courseId") UUID courseId);

    /** Contagens agregadas por módulo (uma consulta para o catálogo inteiro). */
    @Query("""
            select l.courseId as courseId, count(l) as lessons,
                   sum(case when l.videoUrl is not null then 1 else 0 end) as withVideo
            from Lesson l group by l.courseId
            """)
    List<CourseLessonCounts> countsPerCourse();

    interface CourseLessonCounts {
        UUID getCourseId();

        long getLessons();

        Long getWithVideo();
    }
}
