package br.com.lure.growth.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface NotificationPrefsRepository extends JpaRepository<NotificationPrefs, UUID> {

    /** Usuários ativos (exceto {@code excluded}) que NÃO desligaram "novo conteúdo". */
    @Query("""
            select u.id from User u
            where u.active = true and u.id <> :excluded
              and not exists (select 1 from NotificationPrefs p where p.userId = u.id and p.newContent = false)
            """)
    List<UUID> findNewContentRecipients(@Param("excluded") UUID excluded);

    /** Usuários ativos (exceto {@code excluded}) que NÃO desligaram "comunidade". */
    @Query("""
            select u.id from User u
            where u.active = true and u.id <> :excluded
              and not exists (select 1 from NotificationPrefs p where p.userId = u.id and p.community = false)
            """)
    List<UUID> findCommunityRecipients(@Param("excluded") UUID excluded);
}
