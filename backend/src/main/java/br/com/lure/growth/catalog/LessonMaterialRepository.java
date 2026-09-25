package br.com.lure.growth.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface LessonMaterialRepository extends JpaRepository<LessonMaterial, UUID> {

    @Query("select m from LessonMaterial m where m.lessonId in :lessonIds order by m.createdAt asc")
    List<LessonMaterial> findByLessonIds(@Param("lessonIds") Collection<UUID> lessonIds);

    @Query("select m.filePath from LessonMaterial m where m.lessonId = :lessonId")
    List<String> findPathsByLesson(@Param("lessonId") UUID lessonId);

    @Query("select m.filePath from LessonMaterial m join Lesson l on l.id = m.lessonId where l.courseId = :courseId")
    List<String> findPathsByCourse(@Param("courseId") UUID courseId);
}
