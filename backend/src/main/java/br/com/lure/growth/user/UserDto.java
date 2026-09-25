package br.com.lure.growth.user;

import br.com.lure.growth.storage.StorageService;

import java.time.Instant;
import java.util.UUID;

public record UserDto(
        UUID id,
        String email,
        String fullName,
        String avatarUrl,
        Role role,
        boolean active,
        Instant createdAt,
        Instant lastLoginAt
) {

    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), StorageService.urlOf(u.getAvatarPath()),
                u.getRole(), u.isActive(), u.getCreatedAt(), u.getLastLoginAt());
    }
}
