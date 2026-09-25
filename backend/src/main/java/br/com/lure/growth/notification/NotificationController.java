package br.com.lure.growth.notification;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.notification.NotificationDtos.NotificationListDto;
import br.com.lure.growth.notification.NotificationDtos.NotificationPrefsDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping("/api/notifications")
    public NotificationListDto list(@AuthenticationPrincipal AuthUser me,
                                    @RequestParam(defaultValue = "20") int limit) {
        return service.list(me.id(), limit);
    }

    @PostMapping("/api/notifications/{id}/read")
    public ResponseEntity<Void> markRead(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        service.markRead(me.id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/notifications/read-all")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal AuthUser me) {
        service.markAllRead(me.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/me/notification-prefs")
    public NotificationPrefsDto getPrefs(@AuthenticationPrincipal AuthUser me) {
        return service.getPrefs(me.id());
    }

    @PutMapping("/api/me/notification-prefs")
    public NotificationPrefsDto updatePrefs(@AuthenticationPrincipal AuthUser me,
                                            @Valid @RequestBody NotificationPrefsDto body) {
        return service.updatePrefs(me.id(), body);
    }
}
