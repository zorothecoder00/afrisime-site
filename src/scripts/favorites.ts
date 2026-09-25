// Favoris d'un client connecté (§18 Compte client). Un visiteur non connecté est
// invité à se connecter ; aucune requête n'est faite tant qu'aucun bouton n'est présent.
import { SYNC_STATE_KEY } from './cart';

const buttons = () => document.querySelectorAll<HTMLButtonElement>('[data-favorite]');

function render(ids: Set<string>) {
  buttons().forEach((b) => {
    const on = ids.has(b.dataset.favorite!);
    b.setAttribute('aria-pressed', String(on));
    const label = b.querySelector('[data-favorite-label]');
    if (label) label.textContent = on ? 'Dans mes favoris' : 'Ajouter aux favoris';
  });
}

function isKnownVisitor() {
  try {
    return sessionStorage.getItem(SYNC_STATE_KEY) === 'visiteur';
  } catch {
    return false;
  }
}

let favorites: Set<string> | null = null;

async function load() {
  if (!buttons().length || isKnownVisitor()) return;
  const res = await fetch('/api/favorites').catch(() => null);
  if (!res?.ok) return;
  favorites = new Set(((await res.json()) as { ids: string[] }).ids);
  render(favorites);
}

document.addEventListener('click', async (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-favorite]');
  if (!button) return;
  event.preventDefault();
  const productId = button.dataset.favorite!;
  const on = button.getAttribute('aria-pressed') !== 'true';
  const res = await fetch('/api/favorites', {
    method: on ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId }),
  }).catch(() => null);
  if (res?.status === 401) {
    location.href = `/compte/connexion?retour=${encodeURIComponent(location.pathname + location.search)}`;
    return;
  }
  if (!res?.ok) return;
  favorites ??= new Set();
  if (on) favorites.add(productId);
  else favorites.delete(productId);
  render(favorites);
});

load();
