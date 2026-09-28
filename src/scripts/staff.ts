// Raccourci « Back-office » dans l'en-tête du site pour l'équipe. Les pages publiques sont en cache
// CDN (identiques pour tous) : le back-office laisse un repère sur l'appareil, l'en-tête l'affiche.
// Simple commodité : /admin reste protégé par la connexion et la double authentification.
const KEY = 'afs-staff';

export function rememberStaff() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {}
}

export function forgetStaff() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function showStaffLinks() {
  let staff = false;
  try {
    staff = localStorage.getItem(KEY) === '1';
  } catch {}
  if (!staff || location.pathname.startsWith('/admin')) return;
  document.querySelectorAll<HTMLElement>('[data-staff-link]').forEach((el) => (el.hidden = false));
}
