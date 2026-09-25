package br.com.lure.growth.catalog;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.catalog.CatalogDtos.CatalogSectionDto;
import br.com.lure.growth.catalog.CatalogDtos.CertificateDto;
import br.com.lure.growth.catalog.CatalogDtos.ProgressSummaryDto;
import br.com.lure.growth.catalog.CatalogDtos.SectionDto;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class CatalogController {

    private final CatalogService catalog;
    private final CertificateService certificates;

    public CatalogController(CatalogService catalog, CertificateService certificates) {
        this.catalog = catalog;
        this.certificates = certificates;
    }

    @GetMapping("/api/catalog")
    public List<CatalogSectionDto> catalog(@AuthenticationPrincipal AuthUser me) {
        return catalog.catalog(me);
    }

    @GetMapping("/api/sections")
    public List<SectionDto> sections() {
        return catalog.sections();
    }

    @GetMapping("/api/sections/{id}")
    public CatalogSectionDto section(@PathVariable String id, @AuthenticationPrincipal AuthUser me) {
        return catalog.section(id, me);
    }

    @GetMapping("/api/progress/summary")
    public ProgressSummaryDto summary(@AuthenticationPrincipal AuthUser me) {
        return catalog.summary(me);
    }

    @GetMapping("/api/certificates")
    public List<CertificateDto> myCertificates(@AuthenticationPrincipal AuthUser me) {
        return certificates.listForUser(me.id());
    }

    /** Público: página de verificação {@code /certificado/{code}}. */
    @GetMapping("/api/public/certificates/{code}")
    public CertificateDto verify(@PathVariable String code) {
        return certificates.verify(code);
    }
}
