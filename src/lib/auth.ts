// Authentification (Better Auth) : comptes clients et comptes de l'équipe.
// Les routes HTTP sont exposées par src/pages/api/auth/[...all].ts.
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from 'astro:env/server';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware, getIP, isAPIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor } from 'better-auth/plugins';
import * as schema from '../db/schema';
import { audit } from './audit';
import { db } from './db';
import { notifyPasswordReset } from './notifications';
import { ac, roles } from './roles';
import { recordAuthFailure } from './security';
import { SITE } from '../data/site';

export const auth = betterAuth({
  appName: SITE.name,
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: 'pg', schema }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => notifyPasswordReset(user.email, url),
  },

  user: {
    additionalFields: {
      phone: { type: 'string', required: false },
      accountType: { type: 'string', required: false, defaultValue: 'particulier' },
      company: { type: 'string', required: false },
      // Attribué par un commercial dans le back-office, jamais par le client lui-même.
      proStatus: { type: 'string', required: false, defaultValue: 'aucun', input: false },
    },
  },

  // Limitation partagée entre toutes les instances (stockée en base), plus stricte
  // sur la connexion, la double authentification et la réinitialisation.
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 3 },
      '/two-factor/*': { window: 60, max: 5 },
      '/request-password-reset': { window: 300, max: 3 },
    },
  },

  // Échecs de connexion et de double authentification : journalisés, et signalés à l'équipe
  // quand ils se répètent sur un compte de l'équipe (§15, voir src/lib/security.ts).
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const returned = ctx.context.returned;
      if (!isAPIError(returned)) return;
      const code = (returned.body as { code?: string } | undefined)?.code;
      const ipAddress = ctx.request ? getIP(ctx.request, ctx.context.options) : null;

      if (ctx.path === '/sign-in/email' && code === 'INVALID_EMAIL_OR_PASSWORD') {
        const email = String(ctx.body?.email ?? '').trim().toLowerCase();
        const found = email ? await ctx.context.internalAdapter.findUserByEmail(email) : null;
        if (found) await recordAuthFailure('connexion-echouee', found.user as { id: string; email: string; role?: string | null }, ipAddress);
        return;
      }

      if (ctx.path.startsWith('/two-factor/verify-') && (code === 'INVALID_CODE' || code === 'INVALID_BACKUP_CODE')) {
        // Étape de connexion : le compte est identifié par le cookie signé posé après le mot de passe.
        // (Sans ce cookie, il s'agit de l'activation depuis un compte déjà connecté : rien à signaler.)
        const token = await ctx.getSignedCookie(ctx.context.createAuthCookie('two_factor').name, ctx.context.secret);
        const pending = token ? await ctx.context.internalAdapter.findVerificationValue(token) : null;
        const found = pending ? await ctx.context.internalAdapter.findUserById(pending.value) : null;
        if (found) await recordAuthFailure('double-auth-echouee', found as { id: string; email: string; role?: string | null }, ipAddress);
      }
    }),
  },

  plugins: [
    twoFactor({ issuer: SITE.name }),
    admin({ ac, roles, defaultRole: 'client', adminRoles: ['super-admin'] }),
  ],

  databaseHooks: {
    user: {
      create: {
        // Le type de compte vient du formulaire d'inscription : on n'accepte que les valeurs connues.
        before: async (data) => ({
          data: {
            ...data,
            accountType: data.accountType === 'pro' ? 'pro' : 'particulier',
            // Un compte pro est validé par un commercial avant d'accéder aux prix professionnels.
            proStatus: data.accountType === 'pro' ? 'en-attente' : 'aucun',
          },
        }),
      },
    },
    session: {
      create: {
        after: async (session) => {
          await audit({ actorId: session.userId, action: 'connexion', ipAddress: session.ipAddress });
        },
      },
    },
  },
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;
