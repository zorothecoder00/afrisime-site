// Crée (ou promeut) un compte de l'équipe AfriSime. Aucun rôle d'équipe ne peut être obtenu
// depuis le site : c'est ce script qui crée le premier super administrateur.
//
//   npm run admin:create -- <email> "<Nom complet>" [rôle]
//
// Le mot de passe est demandé dans le terminal (10 caractères minimum). À la première
// connexion, la double authentification devra être activée avant d'accéder au back-office.
import 'dotenv/config';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { createInterface } from 'node:readline/promises';
import { createDb } from '../src/db/client';
import { account, auditLog, user } from '../src/db/schema';

const STAFF_ROLES = ['super-admin', 'admin-web', 'ecommerce', 'commercial', 'service-client', 'editeur', 'analyste'];

const [email, name, role = 'super-admin'] = process.argv.slice(2);
if (!email || !name || !STAFF_ROLES.includes(role)) {
  console.error(`Usage : npm run admin:create -- <email> "<Nom complet>" [${STAFF_ROLES.join(' | ')}]`);
  process.exit(1);
}

const db = createDb(process.env.DATABASE_URL!);
const normalizedEmail = email.trim().toLowerCase();
const [existing] = await db.select().from(user).where(eq(user.email, normalizedEmail));

if (existing) {
  await db.update(user).set({ role }).where(eq(user.id, existing.id));
  await db.insert(auditLog).values({ action: 'role-modifie', target: existing.id, details: { role, source: 'script' } });
  console.log(`Compte existant : rôle « ${role} » attribué à ${normalizedEmail}.`);
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question('Mot de passe (10 caractères minimum) : ');
  rl.close();
  if (password.length < 10) {
    console.error('Mot de passe trop court.');
    process.exit(1);
  }
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(user).values({ id, name, email: normalizedEmail, emailVerified: true, role });
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: 'credential',
      userId: id,
      password: await hashPassword(password),
    });
    await tx.insert(auditLog).values({ action: 'compte-equipe-cree', target: id, details: { role, source: 'script' } });
  });
  console.log(`Compte « ${role} » créé pour ${normalizedEmail}.`);
}
process.exit(0);
