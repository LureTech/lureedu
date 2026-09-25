package br.com.lure.growth.catalog;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.catalog.CatalogDtos.CatalogSectionDto;
import br.com.lure.growth.catalog.CatalogDtos.ContinueWatchingDto;
import br.com.lure.growth.catalog.CatalogDtos.ModuleCardDto;
import br.com.lure.growth.catalog.CatalogDtos.ProgressSummaryDto;
import br.com.lure.growth.catalog.CatalogDtos.SectionDto;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.Messages;
import br.com.lure.growth.storage.StorageService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Catálogo, seções e resumo de progresso. Cada endpoint faz um número fixo de consultas
 * (contagens agregadas por módulo), independente de quantos módulos existem.
 */
@Service
public class CatalogService {

    private final SectionRepository sections;
    private final CourseRepository courses;
    private final LessonRepository lessons;
    private final LessonProgressRepository progress;

    public CatalogService(SectionRepository sections, CourseRepository courses, LessonRepository lessons,
                          LessonProgressRepository progress) {
        this.sections = sections;
        this.courses = courses;
        this.lessons = lessons;
        this.progress = progress;
    }

    @Transactional(readOnly = true)
    public List<SectionDto> sections() {
        return sections.findAllByOrderBySortOrderAscTitleAsc().stream().map(SectionDto::from).toList();
    }

    /** Todas as seções (com ao menos um módulo) e seus módulos, com o progresso do usuário. */
    @Transactional(readOnly = true)
    public List<CatalogSectionDto> catalog(AuthUser me) {
        CardContext ctx = cardContext(me.id());
        Map<String, List<ModuleCardDto>> bySection = courses.findAllOrdered().stream()
                .collect(Collectors.groupingBy(Course::getSectionId, LinkedHashMap::new,
                        Collectors.mapping(ctx::card, Collectors.toList())));
        return sections.findAllByOrderBySortOrderAscTitleAsc().stream()
                .filter(s -> bySection.containsKey(s.getId()))
                .map(s -> new CatalogSectionDto(SectionDto.from(s), bySection.get(s.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public CatalogSectionDto section(String id, AuthUser me) {
        Section section = sections.findById(id).orElseThrow(() -> ApiException.notFound(Messages.SECTION_NOT_FOUND));
        CardContext ctx = cardContext(me.id());
        List<ModuleCardDto> cards = courses.findBySectionOrdered(id).stream().map(ctx::card).toList();
        return new CatalogSectionDto(SectionDto.from(section), cards);
    }

    /** Resumo "Meus cursos": considera só módulos liberados. */
    @Transactional(readOnly = true)
    public ProgressSummaryDto summary(AuthUser me) {
        CardContext ctx = cardContext(me.id());
        Map<UUID, Instant> activity = progress.activityPerCourse(me.id()).stream()
                .collect(Collectors.toMap(LessonProgressRepository.CourseActivity::getCourseId,
                        LessonProgressRepository.CourseActivity::getLastActivity));

        int totalLessons = 0;
        int completedLessons = 0;
        List<ModuleCardDto> inProgress = new ArrayList<>();
        List<ModuleCardDto> completed = new ArrayList<>();
        for (Course course : courses.findAllOrdered()) {
            if (course.isLocked()) {
                continue;
            }
            ModuleCardDto card = ctx.card(course);
            totalLessons += card.lessonCount();
            completedLessons += card.completedLessons();
            if (card.progress() >= 100) {
                completed.add(card);
            } else if (card.progress() > 0) {
                inProgress.add(card);
            }
        }
        // Mais recentes primeiro (ordem estável para empates).
        Comparator<ModuleCardDto> recentFirst = Comparator.comparing(
                (ModuleCardDto c) -> activity.getOrDefault(c.id(), Instant.EPOCH)).reversed();
        inProgress.sort(recentFirst);
        completed.sort(recentFirst);

        return new ProgressSummaryDto(totalLessons, completedLessons,
                CatalogDtos.percent(completedLessons, totalLessons), inProgress, completed, continueWatching(me.id()));
    }

    private ContinueWatchingDto continueWatching(UUID userId) {
        List<LessonProgress> candidates = progress.findContinueCandidates(userId, PageRequest.of(0, 1));
        if (candidates.isEmpty()) {
            return null;
        }
        LessonProgress p = candidates.get(0);
        Lesson lesson = lessons.findById(p.getLessonId()).orElse(null);
        if (lesson == null) {
            return null;
        }
        Course course = courses.findById(lesson.getCourseId()).orElse(null);
        if (course == null) {
            return null;
        }
        return new ContinueWatchingDto(course.getSlug(), course.getTitle(), StorageService.urlOf(course.getCoverPath()),
                lesson.getId(), lesson.getTitle(), lesson.getPosition(), p.getLastPosition());
    }

    private CardContext cardContext(UUID userId) {
        Map<UUID, Long> lessonCounts = lessons.countsPerCourse().stream()
                .collect(Collectors.toMap(LessonRepository.CourseLessonCounts::getCourseId,
                        LessonRepository.CourseLessonCounts::getLessons));
        Map<UUID, Long> completed = progress.completedPerCourse(userId).stream()
                .collect(Collectors.toMap(LessonProgressRepository.CourseCompletion::getCourseId,
                        LessonProgressRepository.CourseCompletion::getCompleted));
        return new CardContext(lessonCounts, completed);
    }

    /** Contagens pré-carregadas para montar cartões sem consultas extras. */
    record CardContext(Map<UUID, Long> lessonCounts, Map<UUID, Long> completed) {

        ModuleCardDto card(Course c) {
            long total = lessonCounts.getOrDefault(c.getId(), 0L);
            long done = Math.min(completed.getOrDefault(c.getId(), 0L), total);
            return new ModuleCardDto(c.getId(), c.getSlug(), c.getSectionId(), c.getTitle(), c.getAuthor(),
                    StorageService.urlOf(c.getCoverPath()), c.isLocked(), (int) total, (int) done,
                    CatalogDtos.percent(done, total));
        }
    }
}
