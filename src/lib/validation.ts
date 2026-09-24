// Règles de validation partagées entre les formulaires (retour immédiat)
// et les endpoints API (contrôle de référence côté serveur).

/** Numéro togolais (8 chiffres, avec ou sans +228) ou international au format E.164. */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[\s.\-()]/g, '');
  return /^(\+228|00228)?[279]\d{7}$/.test(digits) || /^\+[1-9]\d{7,14}$/.test(digits);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function clean(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
