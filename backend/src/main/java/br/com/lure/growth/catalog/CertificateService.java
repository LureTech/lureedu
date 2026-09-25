package br.com.lure.growth.catalog;

import br.com.lure.growth.catalog.CatalogDtos.CertificateDto;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.TimeUtils;
import br.com.lure.growth.user.User;
import br.com.lure.growth.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CertificateService {

    private static final char[] ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CertificateRepository certificates;
    private final LessonRepository lessons;
    private final LessonProgressRepository progress;
    private final QuizQuestionRepository quizQuestions;
    private final QuizAttemptRepository quizAttempts;
    private final SectionRepository sections;
    private final CourseRepository courses;
    private final UserRepository users;

    public CertificateService(CertificateRepository certificates, LessonRepository lessons,
                              LessonProgressRepository progress, QuizQuestionRepository quizQuestions,
                              QuizAttemptRepository quizAttempts, SectionRepository sections,
                              CourseRepository courses, UserRepository users) {
        this.certificates = certificates;
        this.lessons = lessons;
        this.progress = progress;
        this.quizQuestions = quizQuestions;
        this.quizAttempts = quizAttempts;
        this.sections = sections;
        this.courses = courses;
        this.users = users;
    }

    /**
     * Emite o certificado se: todas as aulas (≥ 1) concluídas E (sem prova OU prova aprovada) E ainda não emitido.
     * Deve rodar dentro da transação/lock do usuário ({@code UserLocks}).
     *
     * @return o certificado recém-emitido, ou vazio se nada foi emitido agora
     */
    @Transactional
    public Optional<CertificateDto> issueIfEligible(UUID userId, Course course) {
        long lessonCount = lessons.countByCourseId(course.getId());
        if (lessonCount == 0 || progress.countCompletedInCourse(userId, course.getId()) < lessonCount) {
            return Optional.empty();
        }
        if (quizQuestions.countByCourseId(course.getId()) > 0
                && !quizAttempts.existsByUserIdAndCourseIdAndPassedTrue(userId, course.getId())) {
            return Optional.empty();
        }
        if (certificates.findByUserIdAndCourseId(userId, course.getId()).isPresent()) {
            return Optional.empty();
        }
        User user = users.findById(userId).orElseThrow();
        String sectionTitle = sections.findById(course.getSectionId()).map(Section::getTitle).orElse("");
        Certificate certificate = new Certificate(newUniqueCode(), userId, course.getId(), user.displayName(),
                course.getTitle(), sectionTitle, course.getAuthor(), (int) lessonCount, TimeUtils.now());
        certificates.saveAndFlush(certificate);
        return Optional.of(toDto(certificate, course.getSlug()));
    }

    @Transactional(readOnly = true)
    public Optional<CertificateDto> findForUser(UUID userId, Course course) {
        return certificates.findByUserIdAndCourseId(userId, course.getId()).map(c -> toDto(c, course.getSlug()));
    }

    @Transactional(readOnly = true)
    public List<CertificateDto> listForUser(UUID userId) {
        List<Certificate> list = certificates.findByUserIdOrderByIssuedAtDesc(userId);
        Map<UUID, String> slugs = slugsOf(list);
        return list.stream().map(c -> toDto(c, slugs.get(c.getCourseId()))).toList();
    }

    @Transactional(readOnly = true)
    public CertificateDto verify(String code) {
        String normalized = code == null ? "" : code.strip().toUpperCase(Locale.ROOT);
        Certificate c = certificates.findByCode(normalized)
                .orElseThrow(() -> ApiException.notFound("Certificado não encontrado. Confira o código."));
        String slug = c.getCourseId() == null ? null
                : courses.findById(c.getCourseId()).map(Course::getSlug).orElse(null);
        return toDto(c, slug);
    }

    public static CertificateDto toDto(Certificate c, String moduleSlug) {
        return new CertificateDto(c.getId(), c.getCode(), c.getStudentName(), c.getModuleTitle(), c.getSectionTitle(),
                c.getAuthor(), c.getLessonCount(), c.getIssuedAt(), moduleSlug);
    }

    private Map<UUID, String> slugsOf(List<Certificate> list) {
        Set<UUID> ids = list.stream().map(Certificate::getCourseId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return courses.findAllById(ids).stream().collect(Collectors.toMap(Course::getId, Course::getSlug,
                (a, b) -> a));
    }

    /** {@code LURE-XXXXX-XXXXX} (A–Z, 0–9), gerado com SecureRandom e conferido no banco. */
    private String newUniqueCode() {
        String code;
        do {
            code = "LURE-" + randomBlock() + "-" + randomBlock();
        } while (certificates.existsByCode(code));
        return code;
    }

    private static String randomBlock() {
        char[] block = new char[5];
        for (int i = 0; i < block.length; i++) {
            block[i] = ALPHABET[RANDOM.nextInt(ALPHABET.length)];
        }
        return new String(block);
    }
}
