package br.com.lure.growth.user;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.user.ProfileDtos.ChangePasswordRequest;
import br.com.lure.growth.user.ProfileDtos.UpdateProfileRequest;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/me")
public class ProfileController {

    private final UserService userService;

    public ProfileController(UserService userService) {
        this.userService = userService;
    }

    @PutMapping
    public UserDto update(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody UpdateProfileRequest body) {
        return userService.updateName(me.id(), body.fullName());
    }

    @PostMapping(path = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserDto uploadAvatar(@AuthenticationPrincipal AuthUser me, @RequestPart("file") MultipartFile file) {
        return userService.updateAvatar(me.id(), file);
    }

    @DeleteMapping("/avatar")
    public UserDto removeAvatar(@AuthenticationPrincipal AuthUser me) {
        return userService.removeAvatar(me.id());
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal AuthUser me,
                                               @Valid @RequestBody ChangePasswordRequest body) {
        userService.changePassword(me.id(), body.currentPassword(), body.newPassword());
        return ResponseEntity.noContent().build();
    }
}
