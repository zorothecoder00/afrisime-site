// Désactive la double authentification d'un compte qui a perdu son application ET ses codes de
// secours. Aucun écran du site ne le permet : il faut un accès à la base, comme pour admin:create.
//
//   npm run admin:reset-2fa -- <email>
//
// Effets : clé 2FA supprimée, appareils de confiance oubliés, toutes les sessions fermées, action
// inscrite au journal. À la connexion suivante, un compte de l'équipe doit réactiver la 2FA
// (nouvelle clé) avant d'accéder au back-office.
import 'dotenv/config';
import { and, eq, like } from 'drizzle-orm';
import { createInterface } from 'node:readline/promises';
import { createDb } from '../src/db/client';
import { auditLog, session, twoFactor, user, verification } from '../src/db/schema';

const [email] = process.argv.slice(2);
if (!email) {
  console.error('Usage : npm run admin:reset-2fa -- <email>');
  process.exit(1);
}

const db = createDb(process.env.DATABASE_URL!);
const normalizedEmail = email.trim().toLowerCase();
const [account] = await db.select().from(user).where(eq(user.email, normalizedEmail));
if (!account) {
  console.error(`Aucun compte pour ${normalizedEmail}.`);
  process.exit(1);
}

const host = new URL(process.env.DATABASE_URL!).host;
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`Désactiver la double authentification de ${account.name} <${normalizedEmail}> (rôle ${account.role}) sur ${host} ? Tapez « oui » : `);
rl.close();
if (answer.trim().toLowerCase() !== 'oui') {
  console.log('Annulé.');
  process.exit(0);
}

await db.transaction(async (tx) => {
  await tx.delete(twoFactor).where(eq(twoFactor.userId, account.id));
  await tx.delete(verification).where(and(eq(verification.value, account.id), like(verification.identifier, 'trust-device-%')));
  await tx.delete(session).where(eq(session.userId, account.id));
  await tx.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, account.id));
  await tx.insert(auditLog).values({ action: 'double-auth-reinitialisee', target: account.id, details: { email: normalizedEmail, source: 'script' } });
});
console.log(`Double authentification désactivée pour ${normalizedEmail}, sessions fermées. Elle devra être réactivée à la prochaine connexion.`);
process.exit(0);
