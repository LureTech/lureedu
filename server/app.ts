import { Hono } from 'hono';
import { authentication } from './lib/auth.js';
import { ApiException, errorBody, Messages } from './lib/errors.js';
import type { AppEnv } from './lib/http.js';
import { registerAdminCatalog } from './routes/admin-catalog.js';
import { registerAdminUsers } from './routes/admin-users.js';
import { registerAuth } from './routes/auth.js';
import { registerCatalog } from './routes/catalog.js';
import { registerCommunity } from './routes/community.js';
import { registerDiagnostic } from './routes/diagnostic.js';
import { registerFiles } from './routes/files.js';
import { registerModules } from './routes/modules.js';
import { registerNotifications } from './routes/notifications.js';
import { registerProfile } from './routes/profile.js';
import { registerWebAuthn } from './routes/webauthn.js';

/**
 * API do AssessoriaLure (substitui o backend Java). Mesmo contrato de docs/API.md:
 * rotas em /api, arquivos em /files, erros no formato { status, error, message, fields? }.
 */
export function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', authentication);

  registerAuth(app);
  registerWebAuthn(app);
  registerProfile(app);
  registerCatalog(app);
  registerModules(app);
  registerCommunity(app);
  registerNotifications(app);
  registerDiagnostic(app);
  registerAdminUsers(app);
  registerAdminCatalog(app);
  registerFiles(app);

  app.notFound((c) => c.json(errorBody(404, 'Recurso não encontrado.'), 404));

  app.onError((err, c) => {
    if (err instanceof ApiException) {
      return c.json(err.body(), err.status as 400);
    }
    const code = (err as { code?: string }).code;
    // Violação de UNIQUE / FK: conflito com dados existentes (igual ao DataIntegrityViolation do Java).
    if (code === '23505' || code === '23503') {
      console.warn('Violação de integridade:', err.message);
      return c.json(errorBody(409, 'Não foi possível salvar: conflito com dados existentes.'), 409);
    }
    console.error('Erro inesperado', err);
    return c.json(errorBody(500, Messages.UNEXPECTED), 500);
  });

  return app;
}
