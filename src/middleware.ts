// 1. Lit la session là où elle sert (/compte, /admin, /api) et protège les espaces privés :
//    /compte (clients connectés) et /admin (équipe AfriSime, double authentification obligatoire).
// 2. Met en cache CDN les pages publiques : elles ne dépendent pas du visiteur. Une modification
//    faite dans le back-office est visible au plus tard après PUBLIC_CACHE_SECONDS.
import { defineMiddleware } from 'astro:middleware';
import { auth } from './lib/auth';
import { isStaff } from './lib/roles';

// Pages du compte accessibles sans être connecté.
const PUBLIC_ACCOUNT_PAGES = [
  '/compte/connexion',
  '/compte/inscription',
  '/compte/mot-de-passe-oublie',
  '/compte/nouveau-mot-de-passe',
  '/compte/verification',
];

const SESSION_PREFIXES = ['/compte', '/admin', '/api'];
// Pages propres à un visiteur ou à une commande : jamais en cache partagé.
const UNCACHED_PREFIXES = [...SESSION_PREFIXES, '/panier', '/commande', '/suivi', '/img'];

export const PUBLIC_CACHE_SECONDS = 60;

const startsWithAny = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;
  if (context.isPrerendered) return next();

  const path = context.url.pathname.replace(/\/$/, '') || '/';

  if (startsWithAny(path, SESSION_PREFIXES)) {
    const result = await auth.api.getSession({ headers: context.request.headers });
    context.locals.user = result?.user ?? null;
    context.locals.session = result?.session ?? null;
  }
  const user = context.locals.user;
  const loginUrl = `/compte/connexion?retour=${encodeURIComponent(context.url.pathname + context.url.search)}`;

  if (path.startsWith('/compte') && !PUBLIC_ACCOUNT_PAGES.includes(path) && !user) {
    return context.redirect(loginUrl);
  }

  if (path.startsWith('/admin')) {
    if (!user) return context.redirect(loginUrl);
    if (!isStaff(user.role)) return new Response('Accès réservé à l’équipe AfriSime.', { status: 403 });
    // La double authentification est obligatoire pour l'équipe avant tout accès au back-office.
    if (!user.twoFactorEnabled) return context.redirect('/compte/securite?obligatoire=1');
  }

  const response = await next();

  if (path.startsWith('/compte') || path.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store');
  } else if (
    context.request.method === 'GET' &&
    response.status === 200 &&
    !startsWithAny(path, UNCACHED_PREFIXES) &&
    !response.headers.has('Cache-Control') &&
    !response.headers.has('Set-Cookie') &&
    (response.headers.get('Content-Type') ?? '').includes('text/html')
  ) {
    response.headers.set('Cache-Control', `public, max-age=0, s-maxage=${PUBLIC_CACHE_SECONDS}, stale-while-revalidate=600`);
  } else if (startsWithAny(path, ['/panier', '/commande', '/suivi']) && !response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
});
