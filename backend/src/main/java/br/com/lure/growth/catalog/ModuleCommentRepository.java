package br.com.lure.growth.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ModuleCommentRepository extends JpaRepository<ModuleComment, UUID> {

    @Query("select c from ModuleComment c where c.courseId = :courseId order by c.createdAt desc, c.id desc")
    List<ModuleComment> findByCourseNewestFirst(@Param("courseId") UUID courseId);
}
