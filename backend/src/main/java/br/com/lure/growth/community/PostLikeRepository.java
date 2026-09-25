package br.com.lure.growth.community;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PostLikeRepository extends JpaRepository<PostLike, UUID> {

    boolean existsByPostIdAndUserId(UUID postId, UUID userId);

    long countByPostId(UUID postId);

    @Modifying(flushAutomatically = true)
    @Query("delete from PostLike l where l.postId = :postId and l.userId = :userId")
    int deleteByPostAndUser(@Param("postId") UUID postId, @Param("userId") UUID userId);

    @Query("select l.postId as postId, count(l) as n from PostLike l where l.postId in :postIds group by l.postId")
    List<PostCount> countByPosts(@Param("postIds") Collection<UUID> postIds);

    @Query("select l.postId from PostLike l where l.userId = :userId and l.postId in :postIds")
    List<UUID> findLikedPostIds(@Param("userId") UUID userId, @Param("postIds") Collection<UUID> postIds);
}
