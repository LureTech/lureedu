package br.com.lure.growth.admin;

import br.com.lure.growth.admin.AdminDtos.AdminStatsDto;
import br.com.lure.growth.admin.AdminDtos.CreateUserRequest;
import br.com.lure.growth.admin.AdminDtos.UpdateUserRequest;
import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.auth.PasswordRules;
import br.com.lure.growth.auth.RefreshTokenRepository;
import br.com.lure.growth.catalog.CertificateRepository;
import br.com.lure.growth.catalog.CourseRepository;
import br.com.lure.growth.catalog.LessonProgressRepository;
import br.com.lure.growth.catalog.LessonRepository;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.TextUtils;
import br.com.lure.growth.common.TimeUtils;
import br.com.lure.growth.community.PostRepository;
import br.com.lure.growth.diagnostic.DiagnosticSubmissionRepository;
import br.com.lure.growth.user.Role;
import br.com.lure.growth.user.User;
import br.com.lure.growth.user.UserDto;
import br.com.lure.growth.user.UserRepository;
import br.com.lure.growth.user.UserService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Visão geral e gestão de contas (somente ADMIN). */
@Service
public class AdminUserService {

    private final UserRepository users;
    private final UserService userService;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final CourseRepository courses;
    private final LessonRepository lessons;
    private final LessonProgressRepository progress;
    private final CertificateRepository certificates;
    private final PostRepository posts;
    private final DiagnosticSubmissionRepository diagnostics;

    public AdminUserService(UserRepository users, UserService userService, RefreshTokenRepository refreshTokens,
                            PasswordEncoder passwordEncoder, CourseRepository courses, LessonRepository lessons,
                            LessonProgressRepository progress, CertificateRepository certificates,
                            PostRepository posts, DiagnosticSubmissionRepository diagnostics) {
        this.users = users;
        this.userService = userService;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.courses = courses;
        this.lessons = lessons;
        this.progress = progress;
        this.certificates = certificates;
        this.posts = posts;
        this.diagnostics = diagnostics;
    }

    @Transactional(readOnly = true)
    public AdminStatsDto stats() {
        return new AdminStatsDto(
                users.count(),
                users.countByActiveTrue(),
                users.countByRole(Role.ADMIN),
                courses.count(),
                lessons.count(),
                progress.countByCompletedTrue(),
                certificates.count(),
                posts.count(),
                posts.countByCreatedAtGreaterThanEqual(TimeUtils.startOfTodaySaoPaulo()),
                diagnostics.count());
    }

    /** Admins primeiro, depois por data de criação; {@code q} filtra por nome ou e-mail. */
    @Transactional(readOnly = true)
    public List<UserDto> list(String q) {
        String filter = q == null ? "" : q.strip().toLowerCase(Locale.ROOT);
        return users.searchForAdmin(filter).stream().map(UserDto::from).toList();
    }

    @Transactional
    public UserDto create(CreateUserRequest req) {
        String email = PasswordRules.normalizeEmail(req.email());
        PasswordRules.validate(req.password());
        if (users.existsByEmail(email)) {
            throw ApiException.conflict("Já existe uma conta com esse e-mail.");
        }
        User user = new User(email, passwordEncoder.encode(req.password()), TextUtils.trimToNull(req.fullName()),
                req.role());
        return UserDto.from(users.save(user));
    }

    @Transactional
    public UserDto uploadAvatar(UUID userId, MultipartFile file) {
        return userService.updateAvatar(userId, file);
    }

    /**
     * Não é permitido alterar o próprio papel nem se bloquear. O bloqueio vale na hora (o filtro de segurança
     * recusa qualquer requisição e o refresh responde 403); as sessões não são revogadas, então voltam a
     * funcionar se a conta for liberada de novo.
     */
    @Transactional
    public UserDto update(UUID userId, UpdateUserRequest req, AuthUser me) {
        User user = userService.require(userId);
        boolean changesRole = req.role() != null && req.role() != user.getRole();
        boolean changesActive = req.active() != null && req.active() != user.isActive();
        if (user.getId().equals(me.id()) && (changesRole || changesActive)) {
            throw ApiException.badRequest("Você não pode alterar o próprio acesso.");
        }
        if (req.fullName() != null) {
            user.setFullName(TextUtils.trimToNull(req.fullName()));
        }
        if (changesRole) {
            user.setRole(req.role());
        }
        if (changesActive) {
            user.setActive(req.active());
        }
        return UserDto.from(user);
    }

    @Transactional
    public void resetPassword(UUID userId, String newPassword) {
        User user = userService.require(userId);
        PasswordRules.validate(newPassword);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        refreshTokens.revokeAllForUser(user.getId());
    }
}
