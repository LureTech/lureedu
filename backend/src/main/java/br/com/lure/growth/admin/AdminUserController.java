package br.com.lure.growth.admin;

import br.com.lure.growth.admin.AdminDtos.AdminResetPasswordRequest;
import br.com.lure.growth.admin.AdminDtos.AdminStatsDto;
import br.com.lure.growth.admin.AdminDtos.CreateUserRequest;
import br.com.lure.growth.admin.AdminDtos.UpdateUserRequest;
import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.user.UserDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService service;

    public AdminUserController(AdminUserService service) {
        this.service = service;
    }

    @GetMapping("/stats")
    public AdminStatsDto stats() {
        return service.stats();
    }

    @GetMapping("/users")
    public List<UserDto> users(@RequestParam(required = false) String q) {
        return service.list(q);
    }

    @PostMapping("/users")
    public ResponseEntity<UserDto> create(@Valid @RequestBody CreateUserRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(body));
    }

    @PostMapping(path = "/users/{id}/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserDto avatar(@PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        return service.uploadAvatar(id, file);
    }

    @PatchMapping("/users/{id}")
    public UserDto update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest body,
                          @AuthenticationPrincipal AuthUser me) {
        return service.update(id, body, me);
    }

    @PostMapping("/users/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(@PathVariable UUID id,
                                              @Valid @RequestBody AdminResetPasswordRequest body) {
        service.resetPassword(id, body.newPassword());
        return ResponseEntity.noContent().build();
    }
}
