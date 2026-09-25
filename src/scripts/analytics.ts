// Suivi des événements clés (recherche, vue produit, panier, checkout, achat, formulaire B2B).
// Les événements sont poussés dans window.dataLayer, lu par Google Tag Manager (GA4, Matomo…).
// GTM n'est chargé, et rien n'est envoyé, qu'après consentement. L'identifiant GTM se règle
// dans le back-office (Paramètres › SEO & mesure).

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
  if (value === 'accepted') loadTagManager();
}

let loaded = false;

/** Charge Google Tag Manager si un identifiant est configuré et que le visiteur a accepté. */
export function loadTagManager() {
  const id = document.body.dataset.gtm;
  if (loaded || !id || !/^GTM-[A-Z0-9]+$/.test(id) || getConsent() !== 'accepted') return;
  loaded = true;
  (window.dataLayer ??= []).push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  document.head.appendChild(script);
}

export function track(event: string, params: Record<string, unknown> = {}) {
  if (getConsent() !== 'accepted') return;
  (window.dataLayer ??= []).push({ event, ...params });
}
