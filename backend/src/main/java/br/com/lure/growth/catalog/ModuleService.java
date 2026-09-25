package br.com.lure.growth.catalog;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.catalog.CatalogDtos.LessonDto;
import br.com.lure.growth.catalog.CatalogDtos.ModuleDetailDto;
import br.com.lure.growth.catalog.CatalogDtos.QuizSummaryDto;
import br.com.lure.growth.storage.StorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Página do módulo (curso) com aulas, progresso, prova e certificado. */
@Service
public class ModuleService {

    private final CourseAccess access;
    private final SectionRepository sections;
    private final LessonRepository lessons;
    private final LessonViewService lessonViews;
    private final QuizService quizService;
    private final CertificateService certificates;

    public ModuleService(CourseAccess access, SectionRepository sections, LessonRepository lessons,
                         LessonViewService lessonViews, QuizService quizService, CertificateService certificates) {
        this.access = access;
        this.sections = sections;
        this.lessons = lessons;
        this.lessonViews = lessonViews;
        this.quizService = quizService;
        this.certificates = certificates;
    }

    @Transactional(readOnly = true)
    public ModuleDetailDto detail(String slug, AuthUser me) {
        Course course = access.requireBySlug(slug, me);
        String sectionTitle = sections.findById(course.getSectionId()).map(Section::getTitle).orElse("");
        List<LessonDto> lessonDtos = lessonViews.toDtos(lessons.findByCourseIdOrderByPositionAsc(course.getId()), me.id());
        int completed = (int) lessonDtos.stream().filter(LessonDto::completed).count();
        boolean allDone = !lessonDtos.isEmpty() && completed == lessonDtos.size();
        QuizSummaryDto quiz = quizService.summary(course, me.id(), allDone);
        return new ModuleDetailDto(course.getId(), course.getSlug(), course.getSectionId(), sectionTitle,
                course.getTitle(), course.getDescription(), course.getAuthor(),
                StorageService.urlOf(course.getCoverPath()), course.isLocked(), lessonDtos,
                CatalogDtos.percent(completed, lessonDtos.size()), completed, quiz,
                certificates.findForUser(me.id(), course).orElse(null));
    }
}
