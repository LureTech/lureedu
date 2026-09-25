package br.com.lure.growth.catalog;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.Messages;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Carrega um módulo e aplica a regra de acesso: módulos trancados ("Em gravação") só para admins.
 */
@Component
public class CourseAccess {

    private final CourseRepository courses;
    private final LessonRepository lessons;

    public CourseAccess(CourseRepository courses, LessonRepository lessons) {
        this.courses = courses;
        this.lessons = lessons;
    }

    public Course requireBySlug(String slug, AuthUser me) {
        Course course = courses.findBySlug(slug).orElseThrow(() -> ApiException.notFound(Messages.MODULE_NOT_FOUND));
        return checkAccess(course, me);
    }

    public Course requireById(UUID courseId, AuthUser me) {
        Course course = courses.findById(courseId).orElseThrow(() -> ApiException.notFound(Messages.MODULE_NOT_FOUND));
        return checkAccess(course, me);
    }

    public Lesson requireLesson(UUID lessonId) {
        return lessons.findById(lessonId).orElseThrow(() -> ApiException.notFound(Messages.LESSON_NOT_FOUND));
    }

    public static Course checkAccess(Course course, AuthUser me) {
        if (course.isLocked() && !me.isAdmin()) {
            throw ApiException.forbidden(Messages.MODULE_LOCKED);
        }
        return course;
    }
}
