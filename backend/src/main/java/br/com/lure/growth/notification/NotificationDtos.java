package br.com.lure.growth.notification;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class NotificationDtos {

    private NotificationDtos() {
    }

    public record NotificationDto(UUID id, NotificationType type, String title, String body, String link,
                                  boolean read, Instant createdAt) {

        public static NotificationDto from(Notification n) {
            return new NotificationDto(n.getId(), n.getType(), n.getTitle(), n.getBody(), n.getLink(), n.isRead(),
                    n.getCreatedAt());
        }
    }

    public record NotificationListDto(List<NotificationDto> items, long unread) {
    }

    public record NotificationPrefsDto(
            @NotNull(message = "Campo obrigatório.") Boolean community,
            @NotNull(message = "Campo obrigatório.") Boolean replies,
            @NotNull(message = "Campo obrigatório.") Boolean newContent
    ) {
        public static NotificationPrefsDto from(NotificationPrefs p) {
            return new NotificationPrefsDto(p.isCommunity(), p.isReplies(), p.isNewContent());
        }
    }
}
