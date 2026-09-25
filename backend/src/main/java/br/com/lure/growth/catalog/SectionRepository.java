package br.com.lure.growth.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SectionRepository extends JpaRepository<Section, String> {

    List<Section> findAllByOrderBySortOrderAscTitleAsc();

    @Query("select coalesce(max(s.sortOrder), 0) from Section s")
    int maxSortOrder();
}
