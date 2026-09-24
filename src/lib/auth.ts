// Authentification (Better Auth) : comptes clients et comptes de l'équipe.
// Les routes HTTP sont exposées par src/pages/api/auth/[...all].ts.
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from 'astro:env/server';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor } from 'better-auth/plugins';
import * as schema from '../db/schema';
import { audit } from './audit';
import { db } from './db';
import { sendPasswordResetLink } from './integrations';
import { ac, roles } from './roles';
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
    sendResetPassword: async ({ user, url }) => sendPasswordResetLink(user.email, url),
  },

  user: {
    additionalFields: {
      phone: { type: 'string', required: false },
      accountType: { type: 'string', required: false, defaultValue: 'particulier' },
      company: { type: 'string', required: false },
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

  plugins: [
    twoFactor({ issuer: SITE.name }),
    admin({ ac, roles, defaultRole: 'client', adminRoles: ['super-admin'] }),
  ],

  databaseHooks: {
    user: {
      create: {
        // Le type de compte vient du formulaire d'inscription : on n'accepte que les valeurs connues.
        before: async (data) => ({
          data: { ...data, accountType: data.accountType === 'pro' ? 'pro' : 'particulier' },
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
