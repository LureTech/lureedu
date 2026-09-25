package br.com.lure.growth.community;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PostRepository extends JpaRepository<CommunityPost, UUID> {

    long countByUserIdAndCreatedAtAfter(UUID userId, Instant after);

    Optional<CommunityPost> findFirstByUserIdOrderByCreatedAtDesc(UUID userId);

    long countByCreatedAtGreaterThanEqual(Instant since);

    long countByCreatedAtAfterAndUserIdNot(Instant after, UUID userId);

    long countByCreatedAtAfterAndUserIdNotAndCategory(Instant after, UUID userId, String category);

    @Query("select p.body from CommunityPost p where p.createdAt >= :since")
    List<String> findBodiesSince(@Param("since") Instant since);

    @Query("select p.userId as userId, count(p) as n from CommunityPost p where p.createdAt >= :since group by p.userId")
    List<UserCount> countByUserSince(@Param("since") Instant since);
}
