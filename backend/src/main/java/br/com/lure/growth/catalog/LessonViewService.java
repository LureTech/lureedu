package br.com.lure.growth.catalog;

import br.com.lure.growth.catalog.CatalogDtos.LessonDto;
import br.com.lure.growth.catalog.CatalogDtos.MaterialDto;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Monta {@link LessonDto} (com materiais e progresso do usuário) em lote: 2 consultas para N aulas.
 */
@Service
public class LessonViewService {

    private final LessonMaterialRepository materials;
    private final LessonProgressRepository progress;

    public LessonViewService(LessonMaterialRepository materials, LessonProgressRepository progress) {
        this.materials = materials;
        this.progress = progress;
    }

    public List<LessonDto> toDtos(List<Lesson> lessons, UUID userId) {
        if (lessons.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = lessons.stream().map(Lesson::getId).toList();
        Map<UUID, List<MaterialDto>> materialsByLesson = materials.findByLessonIds(ids).stream()
                .collect(Collectors.groupingBy(LessonMaterial::getLessonId,
                        Collectors.mapping(MaterialDto::from, Collectors.toList())));
        Map<UUID, LessonProgress> progressByLesson = progress.findByUserAndLessons(userId, ids).stream()
                .collect(Collectors.toMap(LessonProgress::getLessonId, Function.identity()));
        return lessons.stream()
                .map(l -> toDto(l, progressByLesson.get(l.getId()), materialsByLesson.getOrDefault(l.getId(), List.of())))
                .toList();
    }

    public LessonDto toDto(Lesson lesson, UUID userId) {
        return toDtos(List.of(lesson), userId).get(0);
    }

    private static LessonDto toDto(Lesson l, LessonProgress p, List<MaterialDto> mats) {
        return new LessonDto(l.getId(), l.getPosition(), l.getTitle(), l.getDescription(), l.getVideoUrl(),
                l.getDurationSeconds(),
                p != null && p.isCompleted(),
                p != null ? p.getLastPosition() : 0,
                p != null ? p.getWatchedSeconds() : 0,
                mats);
    }
}
