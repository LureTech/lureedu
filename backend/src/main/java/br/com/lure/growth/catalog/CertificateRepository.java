package br.com.lure.growth.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CertificateRepository extends JpaRepository<Certificate, UUID> {

    Optional<Certificate> findByUserIdAndCourseId(UUID userId, UUID courseId);

    List<Certificate> findByUserIdOrderByIssuedAtDesc(UUID userId);

    Optional<Certificate> findByCode(String code);

    boolean existsByCode(String code);
}
