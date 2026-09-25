package br.com.lure.growth.admin;

import br.com.lure.growth.admin.AdminDtos.AdminModuleDetailDto;
import br.com.lure.growth.admin.AdminDtos.AdminModuleDto;
import br.com.lure.growth.admin.AdminDtos.AdminQuizQuestionDto;
import br.com.lure.growth.admin.AdminDtos.LessonInput;
import br.com.lure.growth.admin.AdminDtos.ModuleInput;
import br.com.lure.growth.admin.AdminDtos.QuizQuestionInput;
import br.com.lure.growth.admin.AdminDtos.SectionCreateRequest;
import br.com.lure.growth.admin.AdminDtos.SectionUpdateRequest;
import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.catalog.CatalogDtos.LessonDto;
import br.com.lure.growth.catalog.CatalogDtos.MaterialDto;
import br.com.lure.growth.catalog.CatalogDtos.SectionDto;
import br.com.lure.growth.catalog.Course;
import br.com.lure.growth.catalog.CourseRepository;
import br.com.lure.growth.catalog.Lesson;
import br.com.lure.growth.catalog.LessonMaterial;
import br.com.lure.growth.catalog.LessonMaterialRepository;
import br.com.lure.growth.catalog.LessonRepository;
import br.com.lure.growth.catalog.LessonViewService;
import br.com.lure.growth.catalog.QuizQuestion;
import br.com.lure.growth.catalog.QuizQuestionRepository;
import br.com.lure.growth.catalog.Section;
import br.com.lure.growth.catalog.SectionRepository;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.Messages;
import br.com.lure.growth.common.TextUtils;
import br.com.lure.growth.notification.NotificationService;
import br.com.lure.growth.storage.StorageService;
import br.com.lure.growth.storage.StorageService.Folder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** CRUD de seções, módulos, aulas, materiais e prova (somente ADMIN). */
@Service
public class AdminCatalogService {

    public static final long COVER_MAX_BYTES = 10L * 1024 * 1024;
    public static final long MATERIAL_MAX_BYTES = 50L * 1024 * 1024;
    private static final int MAX_QUIZ_QUESTIONS = 50;

    private final SectionRepository sections;
    private final CourseRepository courses;
    private final LessonRepository lessons;
    private final LessonMaterialRepository materials;
    private final QuizQuestionRepository quizQuestions;
    private final LessonViewService lessonViews;
    private final StorageService storage;
    private final NotificationService notifications;

    public AdminCatalogService(SectionRepository sections, CourseRepository courses, LessonRepository lessons,
                               LessonMaterialRepository materials, QuizQuestionRepository quizQuestions,
                               LessonViewService lessonViews, StorageService storage,
                               NotificationService notifications) {
        this.sections = sections;
        this.courses = courses;
        this.lessons = lessons;
        this.materials = materials;
        this.quizQuestions = quizQuestions;
        this.lessonViews = lessonViews;
        this.storage = storage;
        this.notifications = notifications;
    }

    // ================================================================== seções

    @Transactional
    public SectionDto createSection(SectionCreateRequest req) {
        String title = req.title().strip();
        String id;
        if (req.id() != null && !req.id().isBlank()) {
            id = TextUtils.slugify(req.id(), 60);
            if (id.isEmpty()) {
                throw ApiException.badRequest("Identificador inválido. Use letras, números e hífens.");
            }
            if (sections.existsById(id)) {
                throw ApiException.conflict("Já existe uma seção com esse identificador.");
            }
        } else {
            id = TextUtils.uniqueSlug(title, 60, "secao", sections::existsById);
        }
        Section section = new Section(id, title, TextUtils.trimToEmpty(req.subtitle()), sections.maxSortOrder() + 1);
        return SectionDto.from(sections.save(section));
    }

    @Transactional
    public SectionDto updateSection(String id, SectionUpdateRequest req) {
        Section section = requireSection(id);
        section.setTitle(req.title().strip());
        section.setSubtitle(TextUtils.trimToEmpty(req.subtitle()));
        if (req.sortOrder() != null) {
            section.setSortOrder(req.sortOrder());
        }
        return SectionDto.from(section);
    }

    @Transactional
    public void deleteSection(String id) {
        Section section = requireSection(id);
        if (courses.existsBySectionId(id)) {
            throw ApiException.conflict("Esta seção tem módulos. Mova ou apague os módulos antes.");
        }
        sections.delete(section);
    }

    // ================================================================== módulos

    @Transactional(readOnly = true)
    public List<AdminModuleDto> listModules() {
        Map<String, Section> sectionById = sectionsById();
        Counts counts = counts();
        return courses.findAllOrdered().stream()
                .sorted(Comparator.comparingInt((Course c) -> {
                    Section s = sectionById.get(c.getSectionId());
                    return s == null ? Integer.MAX_VALUE : s.getSortOrder();
                }))
                .map(c -> toDto(c, sectionById.get(c.getSectionId()), counts))
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminModuleDetailDto getModule(UUID id, AuthUser me) {
        Course course = requireCourse(id);
        AdminModuleDto base = toDto(course);
        List<LessonDto> lessonDtos = lessonViews.toDtos(lessons.findByCourseIdOrderByPositionAsc(id), me.id());
        List<AdminQuizQuestionDto> quiz = quizQuestions.findByCourseIdOrderByPositionAsc(id).stream()
                .map(AdminCatalogService::toQuizDto).toList();
        return new AdminModuleDetailDto(base.id(), base.slug(), base.sectionId(), base.sectionTitle(), base.title(),
                base.description(), base.author(), base.coverUrl(), base.locked(), base.sortOrder(),
                base.lessonCount(), base.lessonsWithVideo(), base.quizQuestionCount(), base.createdAt(), lessonDtos,
                quiz);
    }

    @Transactional
    public AdminModuleDto createModule(ModuleInput in, AuthUser me) {
        Section section = sectionForInput(in.sectionId());
        String title = in.title().strip();
        String slug = TextUtils.uniqueSlug(title, 160, "modulo", courses::existsBySlug);
        Course course = new Course(slug, section.getId(), title, courses.maxSortOrderInSection(section.getId()) + 1,
                me.id());
        course.setDescription(TextUtils.trimToNull(in.description()));
        course.setAuthor(TextUtils.trimToNull(in.author()));
        course.setLocked(Boolean.TRUE.equals(in.locked()));
        courses.save(course);
        if (!course.isLocked()) {
            notifyNewContent(course, section, me);
        }
        return toDto(course);
    }

    /** Atualiza dados do módulo (o slug nunca muda). Trancado → liberado dispara NEW_CONTENT. */
    @Transactional
    public AdminModuleDto updateModule(UUID id, ModuleInput in, AuthUser me) {
        Course course = requireCourse(id);
        Section section = sectionForInput(in.sectionId());
        boolean wasLocked = course.isLocked();
        if (!section.getId().equals(course.getSectionId())) {
            course.setSectionId(section.getId());
            if (in.sortOrder() == null) {
                course.setSortOrder(courses.maxSortOrderInSection(section.getId()) + 1);
            }
        }
        course.setTitle(in.title().strip());
        course.setDescription(TextUtils.trimToNull(in.description()));
        course.setAuthor(TextUtils.trimToNull(in.author()));
        if (in.locked() != null) {
            course.setLocked(in.locked());
        }
        if (in.sortOrder() != null) {
            course.setSortOrder(in.sortOrder());
        }
        if (wasLocked && !course.isLocked()) {
            notifyNewContent(course, section, me);
        }
        return toDto(course);
    }

    @Transactional
    public AdminModuleDto setLocked(UUID id, boolean locked, AuthUser me) {
        Course course = requireCourse(id);
        boolean wasLocked = course.isLocked();
        course.setLocked(locked);
        if (wasLocked && !locked) {
            notifyNewContent(course, sections.findById(course.getSectionId()).orElse(null), me);
        }
        return toDto(course);
    }

    @Transactional
    public AdminModuleDto uploadCover(UUID id, MultipartFile file) {
        Course course = requireCourse(id);
        var stored = storage.storeImage(file, Folder.COVERS, COVER_MAX_BYTES, "A capa deve ter no máximo 10 MB.");
        storage.deleteAfterCommit(course.getCoverPath());
        course.setCoverPath(stored.path());
        return toDto(course);
    }

    @Transactional
    public AdminModuleDto removeCover(UUID id) {
        Course course = requireCourse(id);
        storage.deleteAfterCommit(course.getCoverPath());
        course.setCoverPath(null);
        return toDto(course);
    }

    /** Apaga módulo, aulas, progresso, materiais, comentários e prova (CASCADE); certificados continuam válidos. */
    @Transactional
    public void deleteModule(UUID id) {
        Course course = requireCourse(id);
        materials.findPathsByCourse(id).forEach(storage::deleteAfterCommit);
        storage.deleteAfterCommit(course.getCoverPath());
        courses.delete(course);
    }

    // ================================================================== aulas

    @Transactional
    public LessonDto createLesson(UUID moduleId, LessonInput in, AuthUser me) {
        Course course = requireCourse(moduleId);
        Lesson lesson = new Lesson(course.getId(), lessons.maxPosition(course.getId()) + 1, in.title().strip());
        applyLessonInput(lesson, in);
        lessons.save(lesson);
        return lessonViews.toDto(lesson, me.id());
    }

    @Transactional
    public LessonDto updateLesson(UUID lessonId, LessonInput in, AuthUser me) {
        Lesson lesson = requireLesson(lessonId);
        lesson.setTitle(in.title().strip());
        applyLessonInput(lesson, in);
        lessons.flush();
        return lessonViews.toDto(lesson, me.id());
    }

    @Transactional
    public void deleteLesson(UUID lessonId) {
        Lesson lesson = requireLesson(lessonId);
        UUID courseId = lesson.getCourseId();
        materials.findPathsByLesson(lessonId).forEach(storage::deleteAfterCommit);
        lessons.delete(lesson);
        lessons.flush();
        // Renumera 1..n para não deixar buracos.
        List<Lesson> remaining = lessons.findByCourseIdOrderByPositionAsc(courseId);
        for (int i = 0; i < remaining.size(); i++) {
            remaining.get(i).setPosition(i + 1);
        }
    }

    @Transactional
    public void reorderLessons(UUID moduleId, List<UUID> lessonIds) {
        requireCourse(moduleId);
        List<Lesson> current = lessons.findByCourseIdOrderByPositionAsc(moduleId);
        Set<UUID> currentIds = current.stream().map(Lesson::getId).collect(Collectors.toSet());
        if (lessonIds.size() != current.size() || !currentIds.equals(new HashSet<>(lessonIds))) {
            throw ApiException.badRequest("A lista de aulas não corresponde às aulas do módulo.");
        }
        Map<UUID, Lesson> byId = current.stream().collect(Collectors.toMap(Lesson::getId, Function.identity()));
        for (int i = 0; i < lessonIds.size(); i++) {
            byId.get(lessonIds.get(i)).setPosition(i + 1);
        }
    }

    // ================================================================== materiais

    @Transactional
    public MaterialDto uploadMaterial(UUID lessonId, MultipartFile file, String label) {
        requireLesson(lessonId);
        var stored = storage.storeMaterial(file, MATERIAL_MAX_BYTES, "O material deve ter no máximo 50 MB.");
        String finalLabel = TextUtils.trimToNull(label);
        if (finalLabel == null) {
            finalLabel = TextUtils.trimToNull(stored.originalFilename());
        }
        if (finalLabel == null) {
            finalLabel = "Material";
        }
        if (finalLabel.length() > 255) {
            finalLabel = finalLabel.substring(0, 255);
        }
        LessonMaterial material = materials.save(new LessonMaterial(lessonId, finalLabel, stored.path(),
                stored.sizeBytes(), stored.contentType()));
        return MaterialDto.from(material);
    }

    @Transactional
    public void deleteMaterial(UUID materialId) {
        LessonMaterial material = materials.findById(materialId)
                .orElseThrow(() -> ApiException.notFound("Material não encontrado."));
        storage.deleteAfterCommit(material.getFilePath());
        materials.delete(material);
    }

    // ================================================================== prova

    /** Substitui todas as perguntas da prova do módulo (lista vazia remove a prova). */
    @Transactional
    public List<AdminQuizQuestionDto> replaceQuiz(UUID moduleId, List<QuizQuestionInput> input) {
        Course course = requireCourse(moduleId);
        if (input.size() > MAX_QUIZ_QUESTIONS) {
            throw ApiException.badRequest("A prova pode ter no máximo 50 perguntas.");
        }
        List<QuizQuestion> toSave = new ArrayList<>();
        for (int i = 0; i < input.size(); i++) {
            QuizQuestionInput q = input.get(i);
            String prefix = "Pergunta " + (i + 1) + ": ";
            if (q == null) {
                throw ApiException.badRequest(prefix + "dados inválidos.");
            }
            String text = TextUtils.trimToNull(q.text());
            if (text == null) {
                throw ApiException.badRequest(prefix + "escreva o enunciado.");
            }
            if (text.length() > 1000) {
                throw ApiException.badRequest(prefix + "o enunciado pode ter no máximo 1000 caracteres.");
            }
            List<String> options = q.options() == null ? List.of()
                    : q.options().stream().map(o -> o == null ? "" : o.strip()).toList();
            if (options.size() < 2 || options.size() > 6) {
                throw ApiException.badRequest(prefix + "informe de 2 a 6 alternativas.");
            }
            if (options.stream().anyMatch(String::isEmpty)) {
                throw ApiException.badRequest(prefix + "preencha todas as alternativas.");
            }
            if (options.stream().anyMatch(o -> o.length() > 300)) {
                throw ApiException.badRequest(prefix + "cada alternativa pode ter no máximo 300 caracteres.");
            }
            if (q.correctIndex() == null || q.correctIndex() < 0 || q.correctIndex() >= options.size()) {
                throw ApiException.badRequest(prefix + "marque a alternativa correta.");
            }
            toSave.add(new QuizQuestion(course.getId(), i + 1, text, options, q.correctIndex()));
        }
        quizQuestions.deleteByCourse(course.getId());
        return quizQuestions.saveAll(toSave).stream().map(AdminCatalogService::toQuizDto).toList();
    }

    // ================================================================== helpers

    private void applyLessonInput(Lesson lesson, LessonInput in) {
        lesson.setDescription(TextUtils.trimToNull(in.description()));
        lesson.setVideoUrl(VideoUrls.normalize(in.videoUrl()));
        lesson.setDurationSeconds(in.durationSeconds());
    }

    private void notifyNewContent(Course course, Section section, AuthUser me) {
        String where = section != null ? " já está disponível em " + section.getTitle() + "." : " já está disponível.";
        notifications.notifyNewContent(me.id(), "Novo conteúdo liberado", "\"" + course.getTitle() + "\"" + where,
                "/curso/" + course.getSlug());
    }

    private AdminModuleDto toDto(Course c) {
        long lessonCount = lessons.countByCourseId(c.getId());
        long withVideo = lessons.findByCourseIdOrderByPositionAsc(c.getId()).stream()
                .filter(l -> l.getVideoUrl() != null).count();
        long questions = quizQuestions.countByCourseId(c.getId());
        Section section = sections.findById(c.getSectionId()).orElse(null);
        return toDto(c, section, new Counts(Map.of(c.getId(), lessonCount), Map.of(c.getId(), withVideo),
                Map.of(c.getId(), questions)));
    }

    private static AdminModuleDto toDto(Course c, Section section, Counts counts) {
        return new AdminModuleDto(c.getId(), c.getSlug(), c.getSectionId(), section != null ? section.getTitle() : "",
                c.getTitle(), c.getDescription(), c.getAuthor(), StorageService.urlOf(c.getCoverPath()), c.isLocked(),
                c.getSortOrder(),
                counts.lessons().getOrDefault(c.getId(), 0L).intValue(),
                counts.withVideo().getOrDefault(c.getId(), 0L).intValue(),
                counts.questions().getOrDefault(c.getId(), 0L).intValue(),
                c.getCreatedAt());
    }

    private Counts counts() {
        List<LessonRepository.CourseLessonCounts> lessonCounts = lessons.countsPerCourse();
        return new Counts(
                lessonCounts.stream().collect(Collectors.toMap(LessonRepository.CourseLessonCounts::getCourseId,
                        LessonRepository.CourseLessonCounts::getLessons)),
                lessonCounts.stream().collect(Collectors.toMap(LessonRepository.CourseLessonCounts::getCourseId,
                        c -> c.getWithVideo() == null ? 0L : c.getWithVideo())),
                quizQuestions.countsPerCourse().stream().collect(Collectors.toMap(
                        QuizQuestionRepository.CourseQuestionCount::getCourseId,
                        QuizQuestionRepository.CourseQuestionCount::getQuestions)));
    }

    private static AdminQuizQuestionDto toQuizDto(QuizQuestion q) {
        return new AdminQuizQuestionDto(q.getId(), q.getText(), List.copyOf(q.getOptions()), q.getCorrectIndex());
    }

    private Map<String, Section> sectionsById() {
        return sections.findAll().stream().collect(Collectors.toMap(Section::getId, Function.identity()));
    }

    private Section sectionForInput(String sectionId) {
        return sections.findById(sectionId.strip())
                .orElseThrow(() -> ApiException.badRequest(Messages.SECTION_NOT_FOUND));
    }

    private Section requireSection(String id) {
        return sections.findById(id).orElseThrow(() -> ApiException.notFound(Messages.SECTION_NOT_FOUND));
    }

    private Course requireCourse(UUID id) {
        return courses.findById(id).orElseThrow(() -> ApiException.notFound(Messages.MODULE_NOT_FOUND));
    }

    private Lesson requireLesson(UUID id) {
        return lessons.findById(id).orElseThrow(() -> ApiException.notFound(Messages.LESSON_NOT_FOUND));
    }

    private record Counts(Map<UUID, Long> lessons, Map<UUID, Long> withVideo, Map<UUID, Long> questions) {
    }
}
