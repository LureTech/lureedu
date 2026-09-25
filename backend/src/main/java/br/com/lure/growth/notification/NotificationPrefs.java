package br.com.lure.growth.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/** Preferências de notificação (linha criada sob demanda; ausência = tudo ligado). */
@Entity
@Table(name = "notification_prefs")
public class NotificationPrefs {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false)
    private boolean community = true;

    @Column(nullable = false)
    private boolean replies = true;

    @Column(name = "new_content", nullable = false)
    private boolean newContent = true;

    protected NotificationPrefs() {
    }

    public NotificationPrefs(UUID userId) {
        this.userId = userId;
    }

    public UUID getUserId() {
        return userId;
    }

    public boolean isCommunity() {
        return community;
    }

    public void setCommunity(boolean community) {
        this.community = community;
    }

    public boolean isReplies() {
        return replies;
    }

    public void setReplies(boolean replies) {
        this.replies = replies;
    }

    public boolean isNewContent() {
        return newContent;
    }

    public void setNewContent(boolean newContent) {
        this.newContent = newContent;
    }
}
