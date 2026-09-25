package br.com.lure.growth.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CourseRepository extends JpaRepository<Course, UUID> {

    Optional<Course> findBySlug(String slug);

    boolean existsBySlug(String slug);

    boolean existsBySectionId(String sectionId);

    @Query("select c from Course c order by c.sortOrder asc, c.createdAt asc")
    List<Course> findAllOrdered();

    @Query("select c from Course c where c.sectionId = :sectionId order by c.sortOrder asc, c.createdAt asc")
    List<Course> findBySectionOrdered(@Param("sectionId") String sectionId);

    @Query("select coalesce(max(c.sortOrder), 0) from Course c where c.sectionId = :sectionId")
    int maxSortOrderInSection(@Param("sectionId") String sectionId);
}
