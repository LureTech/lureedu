package br.com.lure.growth.diagnostic;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DiagnosticSubmissionRepository extends JpaRepository<DiagnosticSubmission, UUID> {

    List<DiagnosticSubmission> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<DiagnosticSubmission> findFirstByUserIdOrderByCreatedAtDesc(UUID userId);
}
