// Envoi des formulaires de lead (<form data-lead-form>) vers /api/leads,
// avec affichage des erreurs champ par champ et des états chargement / succès / erreur.
import { track } from './analytics';

function setFieldError(form: HTMLFormElement, name: string, message: string | null) {
  const input = form.elements.namedItem(name) as HTMLInputElement | null;
  const slot = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
  if (input && 'setAttribute' in input) {
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  if (slot) {
    slot.textContent = message ?? '';
    slot.hidden = !message;
  }
}

document.querySelectorAll<HTMLFormElement>('form[data-lead-form]').forEach((form) => {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => setFieldError(form, el.dataset.errorFor!, null));

    const formData = new FormData(form);
    const consent = (form.elements.namedItem('consent') as HTMLInputElement | null)?.checked ?? false;
    // Avec des documents joints, envoi en multipart ; sinon en JSON.
    const hasFiles = [...formData.values()].some((v) => typeof v !== 'string' && v.size > 0);
    const data: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (typeof value !== 'string') return;
      data[key] = data[key] ? `${data[key]}, ${value}` : value;
    });
    data.consent = consent;
    formData.set('consent', String(consent));

    const label = submit?.textContent;
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Envoi en cours…';
    }
    if (status) status.hidden = true;

    try {
      const res = await fetch(
        '/api/leads',
        hasFiles
          ? { method: 'POST', body: formData }
          : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        for (const [name, message] of Object.entries<string>(payload.errors ?? {})) setFieldError(form, name, message);
        throw new Error(payload.error ?? 'Une erreur est survenue.');
      }
      track('generate_lead', { lead_type: data.type });
      form.reset();
      if (status) {
        status.className = 'alert alert-success';
        status.textContent = form.dataset.successMessage ?? 'Merci ! Votre demande a bien été envoyée.';
        status.hidden = false;
      }
    } catch (err) {
      if (status) {
        status.className = 'alert alert-error';
        status.textContent =
          err instanceof TypeError ? 'Connexion impossible. Vérifiez votre réseau et réessayez.' : (err as Error).message;
        status.hidden = false;
      }
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = label ?? 'Envoyer';
      }
    }
  });
});
