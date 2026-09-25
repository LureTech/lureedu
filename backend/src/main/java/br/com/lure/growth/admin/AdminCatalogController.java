package br.com.lure.growth.admin;

import br.com.lure.growth.admin.AdminDtos.AdminModuleDetailDto;
import br.com.lure.growth.admin.AdminDtos.AdminModuleDto;
import br.com.lure.growth.admin.AdminDtos.AdminQuizQuestionDto;
import br.com.lure.growth.admin.AdminDtos.LessonInput;
import br.com.lure.growth.admin.AdminDtos.LessonOrderRequest;
import br.com.lure.growth.admin.AdminDtos.LockRequest;
import br.com.lure.growth.admin.AdminDtos.ModuleInput;
import br.com.lure.growth.admin.AdminDtos.QuizReplaceRequest;
import br.com.lure.growth.admin.AdminDtos.SectionCreateRequest;
import br.com.lure.growth.admin.AdminDtos.SectionUpdateRequest;
import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.catalog.CatalogDtos.LessonDto;
import br.com.lure.growth.catalog.CatalogDtos.MaterialDto;
import br.com.lure.growth.catalog.CatalogDtos.SectionDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminCatalogController {

    private final AdminCatalogService service;

    public AdminCatalogController(AdminCatalogService service) {
        this.service = service;
    }

    // ------------------------------------------------------------------ seções

    @PostMapping("/sections")
    public ResponseEntity<SectionDto> createSection(@Valid @RequestBody SectionCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createSection(body));
    }

    @PutMapping("/sections/{id}")
    public SectionDto updateSection(@PathVariable String id, @Valid @RequestBody SectionUpdateRequest body) {
        return service.updateSection(id, body);
    }

    @DeleteMapping("/sections/{id}")
    public ResponseEntity<Void> deleteSection(@PathVariable String id) {
        service.deleteSection(id);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ módulos

    @GetMapping("/modules")
    public List<AdminModuleDto> modules() {
        return service.listModules();
    }

    @GetMapping("/modules/{id}")
    public AdminModuleDetailDto module(@PathVariable UUID id, @AuthenticationPrincipal AuthUser me) {
        return service.getModule(id, me);
    }

    @PostMapping("/modules")
    public ResponseEntity<AdminModuleDto> createModule(@Valid @RequestBody ModuleInput body,
                                                       @AuthenticationPrincipal AuthUser me) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createModule(body, me));
    }

    @PutMapping("/modules/{id}")
    public AdminModuleDto updateModule(@PathVariable UUID id, @Valid @RequestBody ModuleInput body,
                                       @AuthenticationPrincipal AuthUser me) {
        return service.updateModule(id, body, me);
    }

    @PatchMapping("/modules/{id}/lock")
    public AdminModuleDto lock(@PathVariable UUID id, @Valid @RequestBody LockRequest body,
                               @AuthenticationPrincipal AuthUser me) {
        return service.setLocked(id, body.locked(), me);
    }

    @PostMapping(path = "/modules/{id}/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AdminModuleDto uploadCover(@PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        return service.uploadCover(id, file);
    }

    @DeleteMapping("/modules/{id}/cover")
    public AdminModuleDto removeCover(@PathVariable UUID id) {
        return service.removeCover(id);
    }

    @DeleteMapping("/modules/{id}")
    public ResponseEntity<Void> deleteModule(@PathVariable UUID id) {
        service.deleteModule(id);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ aulas

    @PostMapping("/modules/{moduleId}/lessons")
    public ResponseEntity<LessonDto> createLesson(@PathVariable UUID moduleId, @Valid @RequestBody LessonInput body,
                                                  @AuthenticationPrincipal AuthUser me) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createLesson(moduleId, body, me));
    }

    @PutMapping("/lessons/{id}")
    public LessonDto updateLesson(@PathVariable UUID id, @Valid @RequestBody LessonInput body,
                                  @AuthenticationPrincipal AuthUser me) {
        return service.updateLesson(id, body, me);
    }

    @DeleteMapping("/lessons/{id}")
    public ResponseEntity<Void> deleteLesson(@PathVariable UUID id) {
        service.deleteLesson(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/modules/{moduleId}/lessons/order")
    public ResponseEntity<Void> reorder(@PathVariable UUID moduleId, @Valid @RequestBody LessonOrderRequest body) {
        service.reorderLessons(moduleId, body.lessonIds());
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ materiais

    @PostMapping(path = "/lessons/{lessonId}/materials", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MaterialDto> uploadMaterial(@PathVariable UUID lessonId,
                                                      @RequestPart("file") MultipartFile file,
                                                      @RequestParam(required = false) String label) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.uploadMaterial(lessonId, file, label));
    }

    @DeleteMapping("/materials/{id}")
    public ResponseEntity<Void> deleteMaterial(@PathVariable UUID id) {
        service.deleteMaterial(id);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ prova

    @PutMapping("/modules/{moduleId}/quiz")
    public List<AdminQuizQuestionDto> replaceQuiz(@PathVariable UUID moduleId,
                                                  @Valid @RequestBody QuizReplaceRequest body) {
        return service.replaceQuiz(moduleId, body.questions());
    }
}
