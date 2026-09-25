package br.com.lure.growth.diagnostic;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.diagnostic.DiagnosticDtos.DiagnosticResultDto;
import br.com.lure.growth.diagnostic.DiagnosticDtos.PillarDto;
import br.com.lure.growth.diagnostic.DiagnosticDtos.SubmissionSummaryDto;
import br.com.lure.growth.diagnostic.DiagnosticDtos.SubmitRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/diagnostic")
public class DiagnosticController {

    private final DiagnosticService diagnostic;

    public DiagnosticController(DiagnosticService diagnostic) {
        this.diagnostic = diagnostic;
    }

    @GetMapping("/pillars")
    public List<PillarDto> pillars() {
        return diagnostic.pillars();
    }

    @PostMapping("/submissions")
    public ResponseEntity<DiagnosticResultDto> submit(@Valid @RequestBody SubmitRequest body,
                                                      @AuthenticationPrincipal AuthUser me) {
        return ResponseEntity.status(HttpStatus.CREATED).body(diagnostic.submit(body.answers(), me));
    }

    @GetMapping("/submissions")
    public List<SubmissionSummaryDto> list(@AuthenticationPrincipal AuthUser me) {
        return diagnostic.list(me);
    }

    /** 204 se o usuário nunca fez o diagnóstico. */
    @GetMapping("/submissions/latest")
    public ResponseEntity<DiagnosticResultDto> latest(@AuthenticationPrincipal AuthUser me) {
        return diagnostic.latest(me).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/submissions/{id}")
    public DiagnosticResultDto get(@PathVariable UUID id, @AuthenticationPrincipal AuthUser me) {
        return diagnostic.get(id, me);
    }
}
