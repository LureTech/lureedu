package br.com.lure.growth.search;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.catalog.CatalogDtos.SearchLessonDto;
import br.com.lure.growth.catalog.CatalogDtos.SearchModuleDto;
import br.com.lure.growth.catalog.CatalogDtos.SearchResultDto;
import br.com.lure.growth.catalog.Course;
import br.com.lure.growth.catalog.CourseRepository;
import br.com.lure.growth.catalog.Lesson;
import br.com.lure.growth.catalog.LessonRepository;
import br.com.lure.growth.catalog.Section;
import br.com.lure.growth.catalog.SectionRepository;
import br.com.lure.growth.common.TextUtils;
import br.com.lure.growth.storage.StorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Busca sem acento e sem diferenciar maiúsculas, feita em memória (o catálogo é pequeno).
 * Ranking: título que começa com o termo → título que contém → descrição/autor. Até 8 de cada.
 * Membros não recebem módulos trancados (nem as aulas deles).
 */
@Service
public class SearchService {

    static final int MAX_RESULTS = 8;

    private final SectionRepository sections;
    private final CourseRepository courses;
    private final LessonRepository lessons;

    public SearchService(SectionRepository sections, CourseRepository courses, LessonRepository lessons) {
        this.sections = sections;
        this.courses = courses;
        this.lessons = lessons;
    }

    @Transactional(readOnly = true)
    public SearchResultDto search(String rawQuery, AuthUser me) {
        String q = TextUtils.normalize(rawQuery == null ? "" : rawQuery.strip());
        if (q.length() < 2) {
            return SearchResultDto.empty();
        }
        Map<String, Section> sectionById = sections.findAll().stream()
                .collect(Collectors.toMap(Section::getId, Function.identity()));
        List<Course> visible = courses.findAllOrdered().stream()
                .filter(c -> me.isAdmin() || !c.isLocked())
                .sorted(Comparator.comparing((Course c) -> sectionOrder(sectionById, c)))
                .toList();
        Map<UUID, Integer> catalogOrder = new HashMap<>();
        for (int i = 0; i < visible.size(); i++) {
            catalogOrder.put(visible.get(i).getId(), i);
        }
        Map<UUID, Course> courseById = visible.stream().collect(Collectors.toMap(Course::getId, Function.identity()));

        List<SearchModuleDto> moduleHits = visible.stream()
                .map(c -> new Scored<>(c, score(q, c.getTitle(), c.getDescription(), c.getAuthor()),
                        catalogOrder.get(c.getId())))
                .filter(s -> s.score() > 0)
                .sorted(Scored.ORDER)
                .limit(MAX_RESULTS)
                .map(s -> {
                    Course c = s.item();
                    Section section = sectionById.get(c.getSectionId());
                    return new SearchModuleDto(c.getSlug(), c.getTitle(), section != null ? section.getTitle() : "",
                            StorageService.urlOf(c.getCoverPath()), c.isLocked());
                })
                .toList();

        List<SearchLessonDto> lessonHits = lessons.findAll().stream()
                .filter(l -> courseById.containsKey(l.getCourseId()))
                .map(l -> new Scored<>(l, score(q, l.getTitle(), l.getDescription(), null),
                        catalogOrder.get(l.getCourseId()) * 10_000 + l.getPosition()))
                .filter(s -> s.score() > 0)
                .sorted(Scored.ORDER)
                .limit(MAX_RESULTS)
                .map(s -> {
                    Lesson l = s.item();
                    Course c = courseById.get(l.getCourseId());
                    return new SearchLessonDto(c.getSlug(), c.getTitle(), l.getId(), l.getTitle(), l.getPosition());
                })
                .toList();

        return new SearchResultDto(moduleHits, lessonHits);
    }

    private static int sectionOrder(Map<String, Section> sectionById, Course c) {
        Section s = sectionById.get(c.getSectionId());
        return s == null ? Integer.MAX_VALUE : s.getSortOrder();
    }

    /** 3 = título começa com o termo, 2 = título contém, 1 = descrição/autor contém, 0 = não casa. */
    static int score(String q, String title, String description, String author) {
        String t = TextUtils.normalize(title);
        if (t.startsWith(q)) {
            return 3;
        }
        if (t.contains(q)) {
            return 2;
        }
        if (TextUtils.normalize(description).contains(q) || TextUtils.normalize(author).contains(q)) {
            return 1;
        }
        return 0;
    }

    private record Scored<T>(T item, int score, int order) {
        static final Comparator<Scored<?>> ORDER = Comparator.comparingInt((Scored<?> s) -> -s.score())
                .thenComparingInt(Scored::order);
    }
}
