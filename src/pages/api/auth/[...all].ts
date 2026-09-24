import type { APIRoute } from 'astro';
import { auth } from '../../../lib/auth';

export const prerender = false;

/** Toutes les routes d'authentification (/api/auth/sign-in/email, /api/auth/two-factor/…). */
export const ALL: APIRoute = ({ request }) => auth.handler(request);
