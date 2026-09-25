package br.com.lure.growth.user;

import br.com.lure.growth.auth.PasswordRules;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.Messages;
import br.com.lure.growth.common.TextUtils;
import br.com.lure.growth.storage.StorageService;
import br.com.lure.growth.storage.StorageService.Folder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/** Perfil do usuário (nome, foto, senha). Também usado pelo admin para trocar a foto de alguém. */
@Service
public class UserService {

    public static final long AVATAR_MAX_BYTES = 5L * 1024 * 1024;

    private final UserRepository users;
    private final StorageService storage;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository users, StorageService storage, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.storage = storage;
        this.passwordEncoder = passwordEncoder;
    }

    public User require(UUID id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound(Messages.USER_NOT_FOUND));
    }

    @Transactional
    public UserDto updateName(UUID userId, String fullName) {
        User user = require(userId);
        user.setFullName(TextUtils.trimToNull(fullName));
        return UserDto.from(user);
    }

    @Transactional
    public UserDto updateAvatar(UUID userId, MultipartFile file) {
        User user = require(userId);
        var stored = storage.storeImage(file, Folder.AVATARS, AVATAR_MAX_BYTES, "A foto deve ter no máximo 5 MB.");
        storage.deleteAfterCommit(user.getAvatarPath());
        user.setAvatarPath(stored.path());
        return UserDto.from(user);
    }

    @Transactional
    public UserDto removeAvatar(UUID userId) {
        User user = require(userId);
        storage.deleteAfterCommit(user.getAvatarPath());
        user.setAvatarPath(null);
        return UserDto.from(user);
    }

    @Transactional
    public void changePassword(UUID userId, String currentPassword, String newPassword) {
        User user = require(userId);
        if (!PasswordRules.fitsBcrypt(currentPassword)
                || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw ApiException.badRequest("Senha atual incorreta.");
        }
        PasswordRules.validate(newPassword);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
    }
}
