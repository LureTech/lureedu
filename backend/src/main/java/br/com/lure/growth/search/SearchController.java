package br.com.lure.growth.search;

import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.catalog.CatalogDtos.SearchResultDto;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SearchController {

    private final SearchService search;

    public SearchController(SearchService search) {
        this.search = search;
    }

    /** {@code q} com menos de 2 caracteres devolve listas vazias. */
    @GetMapping("/api/search")
    public SearchResultDto search(@RequestParam(name = "q", required = false) String q,
                                  @AuthenticationPrincipal AuthUser me) {
        return search.search(q, me);
    }
}
