import { createHandler } from '../server/app.js';

/**
 * Função única da Vercel: o vercel.json encaminha /api/* e /files/* para cá,
 * e o Hono decide a rota pelo caminho original.
 */
const handler = createHandler();

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
