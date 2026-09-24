// Suivi des événements clés (recherche, vue produit, panier, checkout, achat, formulaire B2B).
// Les événements sont poussés dans window.dataLayer, que l'outil retenu (GA4, Matomo…)
// lira via Google Tag Manager. Rien n'est envoyé sans consentement.

const CONSENT_KEY = 'afs-consent';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function getConsent(): 'accepted' | 'refused' | null {
  try {
    return (localStorage.getItem(CONSENT_KEY) as 'accepted' | 'refused' | null) ?? null;
  } catch {
    return null;
  }
}

export function setConsent(value: 'accepted' | 'refused') {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* stockage indisponible : le bandeau réapparaîtra à la prochaine visite */
  }
}

export function track(event: string, params: Record<string, unknown> = {}) {
  if (getConsent() !== 'accepted') return;
  (window.dataLayer ??= []).push({ event, ...params });
}
