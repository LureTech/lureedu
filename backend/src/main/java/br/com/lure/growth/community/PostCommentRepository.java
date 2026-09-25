package br.com.lure.growth.community;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PostCommentRepository extends JpaRepository<PostComment, UUID> {

    @Query("select c from PostComment c where c.postId = :postId order by c.createdAt asc, c.id asc")
    List<PostComment> findByPostOldestFirst(@Param("postId") UUID postId);

    @Query("select c.postId as postId, count(c) as n from PostComment c where c.postId in :postIds group by c.postId")
    List<PostCount> countByPosts(@Param("postIds") Collection<UUID> postIds);

    /**
     * Comentários mais novos de cada post: os que têm menos de 2 comentários mais novos no mesmo post
     * (subconsulta correlata — funciona igual no H2 e no PostgreSQL). Empates de horário podem trazer
     * um a mais; quem chama corta em 2.
     */
    @Query("select c from PostComment c where c.postId in :postIds and (select count(c2) from PostComment c2 "
            + "where c2.postId = c.postId and c2.createdAt > c.createdAt) < 2 order by c.createdAt asc, c.id asc")
    List<PostComment> findLatestPerPost(@Param("postIds") Collection<UUID> postIds);

    @Query("select c.userId as userId, count(c) as n from PostComment c where c.createdAt >= :since group by c.userId")
    List<UserCount> countByUserSince(@Param("since") Instant since);
}
