// Client d'authentification pour les scripts navigateur (appelle /api/auth/*).
import { createAuthClient } from 'better-auth/client';
import { adminClient, inferAdditionalFields, twoFactorClient } from 'better-auth/client/plugins';
import type { auth } from './auth';

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), twoFactorClient(), adminClient()],
});
