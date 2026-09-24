// Outils partagés par les formulaires du compte : états de chargement, messages d'erreur en français,
// et redirection sûre après connexion.

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-mail ou mot de passe incorrect.',
  INVALID_PASSWORD: 'Mot de passe incorrect.',
  INVALID_EMAIL: 'Adresse e-mail invalide.',
  USER_ALREADY_EXISTS: 'Un compte existe déjà avec cette adresse e-mail.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Un compte existe déjà avec cette adresse e-mail.',
  PASSWORD_TOO_SHORT: 'Le mot de passe doit contenir au moins 10 caractères.',
  PASSWORD_TOO_LONG: 'Le mot de passe est trop long.',
  INVALID_TOKEN: 'Ce lien n’est plus valide. Demandez-en un nouveau.',
  TOKEN_EXPIRED: 'Ce lien a expiré. Demandez-en un nouveau.',
  INVALID_CODE: 'Code incorrect. Vérifiez l’heure de votre téléphone et réessayez.',
  INVALID_BACKUP_CODE: 'Code de secours incorrect ou déjà utilisé.',
  INVALID_TWO_FACTOR_COOKIE: 'La vérification a expiré. Reconnectez-vous.',
  ACCOUNT_TEMPORARILY_LOCKED: 'Trop d’essais : compte bloqué 15 minutes.',
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: 'Trop d’essais. Reconnectez-vous.',
  SESSION_EXPIRED: 'Votre session a expiré. Reconnectez-vous.',
  SESSION_NOT_FRESH: 'Pour cette action, reconnectez-vous d’abord.',
};

export function errorMessage(error: { code?: string; status?: number; message?: string } | null | undefined): string {
  if (!error) return 'Une erreur est survenue.';
  if (error.status === 429) return 'Trop de tentatives. Patientez une minute avant de réessayer.';
  return (error.code && MESSAGES[error.code]) || 'Une erreur est survenue. Réessayez.';
}

/** Adresse de retour après connexion : uniquement un chemin interne (pas de redirection vers un autre site). */
export function safeReturn(fallback = '/compte'): string {
  const value = new URLSearchParams(location.search).get('retour');
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback;
}

export function showStatus(form: HTMLElement, kind: 'error' | 'success', message: string) {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  if (!status) return;
  status.className = `alert alert-${kind}`;
  status.textContent = message;
  status.hidden = false;
  if (kind === 'error') status.focus();
}

/**
 * Branche un formulaire : désactive le bouton pendant l'envoi et affiche l'erreur éventuelle.
 * Le gestionnaire renvoie un message d'erreur, ou rien en cas de succès.
 */
export function bindForm(form: HTMLFormElement, handler: (data: FormData) => Promise<string | void>) {
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = form.querySelector<HTMLElement>('[data-form-status]');
    if (status) status.hidden = true;
    const label = submit?.textContent;
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Patientez…';
    }
    try {
      const error = await handler(new FormData(form));
      if (error) showStatus(form, 'error', error);
    } catch {
      showStatus(form, 'error', 'Connexion impossible. Vérifiez votre réseau et réessayez.');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = label ?? 'Valider';
      }
    }
  });
}
