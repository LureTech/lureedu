package br.com.lure.growth.catalog;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.catalog.CatalogDtos.CertificateDto;
import br.com.lure.growth.catalog.CatalogDtos.QuestionResultDto;
import br.com.lure.growth.catalog.CatalogDtos.QuizDto;
import br.com.lure.growth.catalog.CatalogDtos.QuizQuestionDto;
import br.com.lure.growth.catalog.CatalogDtos.QuizResultDto;
import br.com.lure.growth.catalog.CatalogDtos.QuizSummaryDto;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.TimeUtils;
import br.com.lure.growth.common.UserLocks;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Prova final: liberada quando todas as aulas estão concluídas; aprovação com 70%. */
@Service
public class QuizService {

    public static final int PASSING_SCORE = 70;

    private final CourseAccess access;
    private final LessonRepository lessons;
    private final LessonProgressRepository progress;
    private final QuizQuestionRepository questions;
    private final QuizAttemptRepository attempts;
    private final CertificateService certificates;
    private final UserLocks userLocks;
    private final ObjectMapper objectMapper;

    public QuizService(CourseAccess access, LessonRepository lessons, LessonProgressRepository progress,
                       QuizQuestionRepository questions, QuizAttemptRepository attempts,
                       CertificateService certificates, UserLocks userLocks, ObjectMapper objectMapper) {
        this.access = access;
        this.lessons = lessons;
        this.progress = progress;
        this.questions = questions;
        this.attempts = attempts;
        this.certificates = certificates;
        this.userLocks = userLocks;
        this.objectMapper = objectMapper;
    }

    /** Resumo usado na página do módulo. */
    @Transactional(readOnly = true)
    public QuizSummaryDto summary(Course course, UUID userId, boolean unlocked) {
        long count = questions.countByCourseId(course.getId());
        QuizAttemptRepository.AttemptStats stats = attempts.stats(userId, course.getId());
        return new QuizSummaryDto((int) count, unlocked, passed(stats), stats.getBestScore(), attemptsOf(stats));
    }

    @Transactional(readOnly = true)
    public QuizDto getQuiz(String slug, AuthUser me) {
        Course course = access.requireBySlug(slug, me);
        boolean unlocked = isUnlocked(me.id(), course.getId());
        QuizAttemptRepository.AttemptStats stats = attempts.stats(me.id(), course.getId());
        List<QuizQuestionDto> list = unlocked
                ? questions.findByCourseIdOrderByPositionAsc(course.getId()).stream()
                .map(q -> new QuizQuestionDto(q.getId(), q.getText(), List.copyOf(q.getOptions())))
                .toList()
                : List.of();
        return new QuizDto(unlocked, PASSING_SCORE, attemptsOf(stats), stats.getBestScore(), passed(stats), list);
    }

    public QuizResultDto attempt(String slug, Map<String, Integer> answers, AuthUser me) {
        return userLocks.inTransaction(me.id(), () -> {
            Course course = access.requireBySlug(slug, me);
            List<QuizQuestion> list = questions.findByCourseIdOrderByPositionAsc(course.getId());
            if (list.isEmpty()) {
                throw ApiException.conflict("Este módulo não tem prova final.");
            }
            if (!isUnlocked(me.id(), course.getId())) {
                throw ApiException.conflict("Conclua todas as aulas para liberar a prova.");
            }
            List<QuestionResultDto> results = new ArrayList<>();
            Map<String, Integer> recorded = new LinkedHashMap<>();
            int correct = 0;
            for (QuizQuestion q : list) {
                Integer chosen = answers.get(q.getId().toString());
                boolean ok = chosen != null && chosen == q.getCorrectIndex();
                if (ok) {
                    correct++;
                }
                recorded.put(q.getId().toString(), chosen);
                results.add(new QuestionResultDto(q.getId(), ok, q.getCorrectIndex()));
            }
            int score = (int) Math.round(correct * 100.0 / list.size());
            boolean passed = score >= PASSING_SCORE;
            attempts.saveAndFlush(new QuizAttempt(course.getId(), me.id(), score, passed, toJson(recorded),
                    TimeUtils.now()));
            CertificateDto certificate = passed
                    ? certificates.issueIfEligible(me.id(), course).orElse(null)
                    : null;
            return new QuizResultDto(score, correct, list.size(), passed, results, certificate);
        });
    }

    private boolean isUnlocked(UUID userId, UUID courseId) {
        long lessonCount = lessons.countByCourseId(courseId);
        return lessonCount > 0 && progress.countCompletedInCourse(userId, courseId) >= lessonCount;
    }

    private static boolean passed(QuizAttemptRepository.AttemptStats stats) {
        return stats.getPassedCount() != null && stats.getPassedCount() > 0;
    }

    private static int attemptsOf(QuizAttemptRepository.AttemptStats stats) {
        return stats.getAttempts() == null ? 0 : stats.getAttempts().intValue();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
