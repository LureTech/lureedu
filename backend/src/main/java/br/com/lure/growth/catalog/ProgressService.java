package br.com.lure.growth.catalog;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.catalog.CatalogDtos.CertificateDto;
import br.com.lure.growth.catalog.CatalogDtos.ProgressUpdateDto;
import br.com.lure.growth.catalog.CatalogDtos.ProgressUpdateRequest;
import br.com.lure.growth.common.TimeUtils;
import br.com.lure.growth.common.UserLocks;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class ProgressService {

    private final CourseAccess access;
    private final LessonRepository lessons;
    private final LessonProgressRepository progress;
    private final CertificateService certificates;
    private final UserLocks userLocks;

    public ProgressService(CourseAccess access, LessonRepository lessons, LessonProgressRepository progress,
                           CertificateService certificates, UserLocks userLocks) {
        this.access = access;
        this.lessons = lessons;
        this.progress = progress;
        this.certificates = certificates;
        this.userLocks = userLocks;
    }

    /**
     * Upsert do progresso: campos ausentes não mudam; {@code watchedSeconds} nunca diminui.
     * Se esta chamada completar o módulo (e não houver prova pendente), emite o certificado.
     */
    public ProgressUpdateDto update(UUID lessonId, ProgressUpdateRequest req, AuthUser me) {
        return userLocks.inTransaction(me.id(), () -> {
            Lesson lesson = access.requireLesson(lessonId);
            Course course = access.requireById(lesson.getCourseId(), me);
            Instant now = TimeUtils.now();

            LessonProgress p = progress.findByUserIdAndLessonId(me.id(), lessonId)
                    .orElseGet(() -> new LessonProgress(me.id(), lessonId));
            if (req.watchedSeconds() != null) {
                p.addWatchedSeconds(req.watchedSeconds());
            }
            if (req.lastPosition() != null) {
                p.setLastPosition(req.lastPosition());
            }
            if (req.completed() != null) {
                p.setCompleted(req.completed(), now);
            }
            p.touch(now);
            progress.saveAndFlush(p);

            long lessonCount = lessons.countByCourseId(course.getId());
            long completed = progress.countCompletedInCourse(me.id(), course.getId());
            CertificateDto certificate = null;
            if (lessonCount > 0 && completed >= lessonCount) {
                certificate = certificates.issueIfEligible(me.id(), course).orElse(null);
            }
            return new ProgressUpdateDto(lessonId, p.isCompleted(), p.getWatchedSeconds(), p.getLastPosition(),
                    CatalogDtos.percent(completed, lessonCount), (int) Math.min(completed, lessonCount), certificate);
        });
    }

    /** Grava a duração detectada pelo player — só se ainda não houver (admins sempre podem sobrescrever). */
    @Transactional
    public void setDuration(UUID lessonId, int durationSeconds, AuthUser me) {
        Lesson lesson = access.requireLesson(lessonId);
        access.requireById(lesson.getCourseId(), me);
        if (lesson.getDurationSeconds() == null || me.isAdmin()) {
            lesson.setDurationSeconds(durationSeconds);
        }
    }
}
