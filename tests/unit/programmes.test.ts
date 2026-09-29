import { describe, expect, it } from 'vitest';
import { NAV } from '../../src/data/site';
import { denyApi } from '../../src/lib/admin';
import { FAQ_GROUPS } from '../../src/lib/content';
import { DEFAULT_TEXTS, parseLinks } from '../../src/lib/page-texts';
import { parseProjectFields, PROJECT_STATUSES } from '../../src/lib/projects';
import { SLIDESHOW_PLACEMENTS } from '../../src/lib/slideshows';

describe('Programmes & projets : champs (back-office et API)', () => {
  it('accepte une fiche complète', () => {
    const { values, error } = parseProjectFields({
      kind: 'programme',
      title: '  Appui aux coopératives  ',
      status: 'termine',
      place: 'Plateaux',
      period: '2025 – 2027',
      position: '3',
      published: true,
    });
    expect(error).toBeUndefined();
    expect(values).toEqual({ kind: 'programme', title: 'Appui aux coopératives', status: 'termine', place: 'Plateaux', period: '2025 – 2027', position: 3, published: true });
  });

  it('ne renvoie que les champs envoyés (modification partielle)', () => {
    expect(parseProjectFields({ status: 'en-cours' })).toEqual({ values: { status: 'en-cours' } });
  });

  it('refuse un type, un statut ou un titre invalide', () => {
    expect(parseProjectFields({ kind: 'evenement' }).error).toMatch(/Type invalide/);
    expect(parseProjectFields({ status: 'fini' }).error).toMatch(/Statut invalide/);
    expect(parseProjectFields({ title: 'AB' }).error).toMatch(/titre/);
    expect(parseProjectFields({ title: 42 }).error).toMatch(/titre/);
  });

  it('tronque les textes, borne l’ordre et lit la case « Publié »', () => {
    const { values } = parseProjectFields({ title: 'x'.repeat(200), summary: 'y'.repeat(400), position: -4, published: 'on' });
    expect(values.title).toHaveLength(140);
    expect(values.summary).toHaveLength(300);
    expect(values.position).toBe(0);
    expect(values.published).toBe(true);
    expect(parseProjectFields({ position: 'abc', published: 'non' }).values).toEqual({ position: 0, published: false });
  });
});

describe('Programmes & projets : accès à l’API du back-office', () => {
  const request = (origin?: string) => new Request('https://afrisime.test/api/admin/programmes', { headers: origin ? { origin } : {} });
  const staff = (role: string, twoFactorEnabled = true) => ({ role, twoFactorEnabled });

  it('autorise les rôles qui modifient les contenus', () => {
    for (const role of ['super-admin', 'admin-web', 'editeur', 'service-client']) expect(denyApi(request(), staff(role), { content: ['update'] }), role).toBeNull();
  });

  it('refuse visiteur, client, double authentification absente, rôle insuffisant et autre origine', async () => {
    expect(denyApi(request(), null, { content: ['read'] })?.status).toBe(401);
    expect(denyApi(request(), staff('client'), { content: ['read'] })?.status).toBe(403);
    expect(denyApi(request(), staff('admin-web', false), { content: ['read'] })?.status).toBe(403);
    expect(denyApi(request(), staff('analyste'), { content: ['update'] })?.status).toBe(403);
    expect(denyApi(request(), staff('analyste'), { content: ['read'] })).toBeNull();
    const crossOrigin = denyApi(request('https://evil.test'), staff('super-admin'), { content: ['update'] });
    expect(crossOrigin?.status).toBe(403);
    expect(await crossOrigin?.json()).toEqual({ error: 'Origine non autorisée.' });
  });
});

describe('Programmes & projets : intégration au site', () => {
  it('onglet du menu entre Solutions B2B et Partenaires', () => {
    const hrefs = NAV.map((item) => item.href);
    expect(hrefs.indexOf('/programmes')).toBe(hrefs.indexOf('/b2b') + 1);
    expect(hrefs.indexOf('/partenaires')).toBe(hrefs.indexOf('/programmes') + 1);
  });

  it('lien dans le pied de page', () => {
    const links = DEFAULT_TEXTS.pied.columns.flatMap((c) => parseLinks(c.links));
    expect(links.some((l) => l.href === '/programmes')).toBe(true);
  });

  it('un libellé de statut par statut', () => {
    const t = DEFAULT_TEXTS.programmes;
    expect([t.statusUpcoming, t.statusOngoing, t.statusDone]).toEqual(Object.values(PROJECT_STATUSES));
  });

  it('emplacements de diaporama et rubrique FAQ', () => {
    const placements = SLIDESHOW_PLACEMENTS.filter((p) => p.path === '/programmes');
    expect(placements.map((p) => p.hero).sort()).toEqual([false, true]);
    expect(FAQ_GROUPS.some((g) => g.id === 'programmes')).toBe(true);
  });
});
