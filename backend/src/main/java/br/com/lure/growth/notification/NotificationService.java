package br.com.lure.growth.notification;

import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.TimeUtils;
import br.com.lure.growth.notification.NotificationDtos.NotificationDto;
import br.com.lure.growth.notification.NotificationDtos.NotificationListDto;
import br.com.lure.growth.notification.NotificationDtos.NotificationPrefsDto;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

    private static final String INSERT_SQL = """
            INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, FALSE, ?)
            """;
    private static final int BATCH_SIZE = 500;

    private final NotificationRepository notifications;
    private final NotificationPrefsRepository prefs;
    private final JdbcTemplate jdbc;

    public NotificationService(NotificationRepository notifications, NotificationPrefsRepository prefs,
                               JdbcTemplate jdbc) {
        this.notifications = notifications;
        this.prefs = prefs;
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------ leitura

    @Transactional(readOnly = true)
    public NotificationListDto list(UUID userId, int limit) {
        int size = Math.max(1, Math.min(limit, 50));
        List<NotificationDto> items = notifications.findLatest(userId, PageRequest.of(0, size)).stream()
                .map(NotificationDto::from)
                .toList();
        return new NotificationListDto(items, notifications.countByUserIdAndReadFalse(userId));
    }

    @Transactional
    public void markRead(UUID userId, UUID notificationId) {
        Notification n = notifications.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> ApiException.notFound("Notificação não encontrada."));
        n.markRead();
    }

    @Transactional
    public void markAllRead(UUID userId) {
        notifications.markAllRead(userId);
    }

    // ------------------------------------------------------------ preferências

    @Transactional(readOnly = true)
    public NotificationPrefsDto getPrefs(UUID userId) {
        return NotificationPrefsDto.from(prefs.findById(userId).orElseGet(() -> new NotificationPrefs(userId)));
    }

    @Transactional
    public NotificationPrefsDto updatePrefs(UUID userId, NotificationPrefsDto dto) {
        NotificationPrefs p = prefs.findById(userId).orElseGet(() -> new NotificationPrefs(userId));
        p.setCommunity(dto.community());
        p.setReplies(dto.replies());
        p.setNewContent(dto.newContent());
        return NotificationPrefsDto.from(prefs.save(p));
    }

    // ------------------------------------------------------------ geração

    /** Curtida/comentário no post de alguém: respeita a preferência "replies" e nunca notifica a si mesmo. */
    @Transactional
    public void notifyReply(UUID recipientId, UUID actorId, NotificationType type, String title, String body,
                            String link) {
        if (recipientId.equals(actorId)) {
            return;
        }
        boolean wants = prefs.findById(recipientId).map(NotificationPrefs::isReplies).orElse(true);
        if (wants) {
            notifications.save(new Notification(recipientId, type, title, body, link, TimeUtils.now()));
        }
    }

    /** Novo módulo liberado: todos os usuários ativos (exceto quem liberou) com "newContent" ligado. */
    @Transactional
    public int notifyNewContent(UUID actorId, String title, String body, String link) {
        return insertBatch(prefs.findNewContentRecipients(actorId), NotificationType.NEW_CONTENT, title, body, link);
    }

    /** Post de admin na comunidade: usuários ativos (exceto o autor) com "community" ligado. */
    @Transactional
    public int notifyCommunity(UUID actorId, String title, String body, String link) {
        return insertBatch(prefs.findCommunityRecipients(actorId), NotificationType.COMMUNITY, title, body, link);
    }

    private int insertBatch(List<UUID> recipients, NotificationType type, String title, String body, String link) {
        if (recipients.isEmpty()) {
            return 0;
        }
        OffsetDateTime createdAt = OffsetDateTime.ofInstant(TimeUtils.now(), ZoneOffset.UTC);
        String safeTitle = truncate(title, 200);
        String safeBody = truncate(body, 500);
        jdbc.batchUpdate(INSERT_SQL, recipients, BATCH_SIZE, (ps, recipient) -> {
            ps.setObject(1, UUID.randomUUID());
            ps.setObject(2, recipient);
            ps.setString(3, type.name());
            ps.setString(4, safeTitle);
            ps.setString(5, safeBody);
            ps.setString(6, link);
            ps.setObject(7, createdAt);
        });
        return recipients.size();
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
