// Récupère la session sur chaque requête rendue côté serveur et protège
// les espaces privés : /compte (clients connectés) et /admin (équipe AfriSime).
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

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;
  // Les pages statiques sont générées au build : pas de session à lire.
  if (context.isPrerendered) return next();

  const result = await auth.api.getSession({ headers: context.request.headers });
  context.locals.user = result?.user ?? null;
  context.locals.session = result?.session ?? null;

  const path = context.url.pathname.replace(/\/$/, '') || '/';
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
  if (path.startsWith('/compte') || path.startsWith('/admin')) response.headers.set('Cache-Control', 'no-store');
  return response;
});
