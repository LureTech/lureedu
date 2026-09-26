import { handle } from 'hono/vercel';
import { createApp } from '../server/app.js';

/**
 * Função única da Vercel: o vercel.json encaminha /api/* e /files/* para cá,
 * e o Hono decide a rota pelo caminho original.
 */
const handler = handle(createApp());

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
