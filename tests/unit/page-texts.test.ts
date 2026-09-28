import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXTS, parseLinks, splitLines, TEXT_PAGES, textsFromForm } from '../../src/lib/page-texts';

describe('Textes du site', () => {
  it('lit les liens « Libellé | adresse » et ignore les adresses non sûres', () => {
    expect(parseLinks('Boutique | /boutique\nFacebook | https://facebook.com/afrisime\nPiège | javascript:alert(1)\n//evil.com\nSans lien')).toEqual([
      { label: 'Boutique', href: '/boutique' },
      { label: 'Facebook', href: 'https://facebook.com/afrisime' },
    ]);
    expect(parseLinks(['CGV | /legal/cgv', 'Autre site | //evil.com'])).toEqual([{ label: 'CGV', href: '/legal/cgv' }]);
  });

  it('découpe les puces une par ligne', () => {
    expect(splitLines(' Un \n\n Deux\r\n')).toEqual(['Un', 'Deux']);
  });

  it('les liens par défaut du pied de page sont tous valides', () => {
    for (const column of DEFAULT_TEXTS.pied.columns) expect(parseLinks(column.links).length).toBe(splitLines(column.links).length);
    expect(parseLinks(DEFAULT_TEXTS.pied.legalLinks).length).toBe(DEFAULT_TEXTS.pied.legalLinks.length);
  });

  it('chaque champ du back-office correspond à un texte par défaut', () => {
    for (const [page, def] of Object.entries(TEXT_PAGES)) {
      const defaults = DEFAULT_TEXTS[page as keyof typeof DEFAULT_TEXTS] as Record<string, unknown>;
      for (const field of def.sections.flatMap((s) => s.fields)) expect(defaults, `${page}.${field.key}`).toHaveProperty(field.key);
    }
  });

  it('lit le formulaire du back-office, cartes comprises', () => {
    const form = new FormData();
    form.set('heroTitle', '  Nouveau titre  ');
    form.set('activities.0.title', 'Gros');
    form.set('activities.0.points', 'A\nB');
    const value = textsFromForm('activites', form);
    expect(value.heroTitle).toBe('Nouveau titre');
    expect((value.activities as Record<string, string>[])[0]).toMatchObject({ title: 'Gros', points: 'A\nB' });
    expect(value.activities).toHaveLength(DEFAULT_TEXTS.activites.activities.length);
  });
});
