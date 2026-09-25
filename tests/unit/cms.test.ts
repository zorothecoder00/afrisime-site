import { describe, expect, it } from 'vitest';
import { int, rows, safeHref, slugify } from '../../src/lib/admin';
import { keptImages, parseProductForm } from '../../src/lib/catalog-admin';
import { unitPriceFor } from '../../src/lib/catalog';
import { isValidatedPro } from '../../src/lib/checkout';
import { isPublished, videoEmbedUrl } from '../../src/lib/content';
import { plainText, renderMarkdown } from '../../src/lib/markdown';
import { normalizePath } from '../../src/lib/redirects';

function form(entries: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [key, value] of Object.entries(entries)) for (const v of [value].flat()) f.append(key, v);
  return f;
}

describe('Markdown des contenus (protection XSS, REC-11)', () => {
  it('neutralise le HTML brut', () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
  });
  it('refuse les liens javascript:', () => {
    expect(renderMarkdown('[clic](javascript:alert(1))')).not.toContain('href="javascript:');
  });
  it('ouvre les liens externes dans un nouvel onglet sans transmettre la page', () => {
    expect(renderMarkdown('[site](https://exemple.tg)')).toContain('rel="noopener noreferrer"');
    expect(renderMarkdown('[boutique](/boutique)')).not.toContain('target=');
  });
  it('charge les images en différé', () => {
    expect(renderMarkdown('![riz](/img/abc.webp)')).toContain('loading="lazy"');
  });
  it('extrait un texte brut', () => {
    expect(plainText('## Titre\n\nUn **texte** long', 12)).toBe('Titre Un te…');
  });
});

describe('vidéos', () => {
  it('YouTube et Vimeo', () => {
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe('https://www.youtube-nocookie.com/embed/abc123');
    expect(videoEmbedUrl('https://youtu.be/abc123')).toBe('https://www.youtube-nocookie.com/embed/abc123');
    expect(videoEmbedUrl('https://vimeo.com/12345')).toBe('https://player.vimeo.com/video/12345');
  });
  it('refuse les autres sites', () => {
    expect(videoEmbedUrl('https://exemple.com/video')).toBeNull();
    expect(videoEmbedUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('publication programmée', () => {
  it('publié seulement une fois la date passée', () => {
    expect(isPublished({ status: 'publie', publishedAt: new Date(Date.now() - 1000) })).toBe(true);
    expect(isPublished({ status: 'publie', publishedAt: new Date(Date.now() + 60_000) })).toBe(false);
    expect(isPublished({ status: 'brouillon', publishedAt: new Date(0) })).toBe(false);
  });
});

describe('formulaires du back-office', () => {
  it('slugify', () => {
    expect(slugify('Huile de palme « rouge » 5 L')).toBe('huile-de-palme-rouge-5-l');
  });
  it('liens sûrs uniquement', () => {
    expect(safeHref('/boutique')).toBe('/boutique');
    expect(safeHref('https://exemple.tg/a')).toBe('https://exemple.tg/a');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('//exemple.tg')).toBeNull();
  });
  it('lit les lignes répétées dans l’ordre', () => {
    const f = form({ 'v[1][label]': 'B', 'v[0][label]': 'A', 'v[0][price]': '10' });
    expect(rows(f, 'v')).toEqual([{ label: 'A', price: '10' }, { label: 'B' }]);
  });
  it('lit les montants saisis avec espaces', () => {
    expect(int(form({ p: '22 500' }), 'p')).toBe(22500);
    expect(int(form({ p: '' }), 'p')).toBeNull();
    expect(int(form({ p: '-3' }), 'p')).toBeNull();
  });
  it('valide un produit complet', () => {
    const { values, errors } = parseProductForm(
      form({
        name: 'Riz parfumé',
        sku: 'afs-cer-001',
        categoryId: 'cereales',
        brandId: 'savana',
        status: 'disponible',
        published: 'on',
        'variants[0][label]': 'Sac 25 kg',
        'variants[0][price]': '22500',
        'variants[0][proPrice]': '21000',
        'variants[0][unit]': 'sac',
        'variants[0][weightKg]': '25',
        badges: ['populaire', 'inconnu'],
      }),
    );
    expect(errors).toEqual({});
    expect(values.slug).toBe('riz-parfume');
    expect(values.sku).toBe('AFS-CER-001');
    expect(values.variants).toEqual([{ id: 'sac-25-kg', label: 'Sac 25 kg', price: 22500, proPrice: 21000, unit: 'sac', weightKg: 25 }]);
    expect(values.badges).toEqual(['populaire']);
  });
  it('refuse un prix pro supérieur au prix public et un produit sans format', () => {
    expect(parseProductForm(form({ name: 'X', sku: 'ABC', categoryId: 'c', brandId: 'b', status: 'disponible' })).errors.variants).toBeTruthy();
    const bad = parseProductForm(
      form({ name: 'Riz', sku: 'ABC', categoryId: 'c', brandId: 'b', status: 'disponible', 'variants[0][label]': 'Sac', 'variants[0][price]': '100', 'variants[0][proPrice]': '150' }),
    );
    expect(bad.errors.variants).toMatch(/prix pro/);
  });
  it('conserve et réordonne les photos', () => {
    const f = form({ 'images[0][id]': 'a', 'images[0][position]': '2', 'images[1][id]': 'b', 'images[1][position]': '1', 'images[2][id]': 'c', 'images[2][remove]': 'on', 'images[3][id]': 'intrus' });
    expect(keptImages(f, ['a', 'b', 'c'])).toEqual(['b', 'a']);
  });
  it('normalise les adresses de redirection', () => {
    expect(normalizePath('https://site.tg/ancienne-page/')).toBe('/ancienne-page');
    expect(normalizePath('promo#haut')).toBe('/promo');
  });
});

describe('prix professionnels', () => {
  const variant = { id: 'v', label: 'Sac', price: 1000, proPrice: 900, unit: 'sac', weightKg: 1 };
  it('seulement pour un compte pro validé', () => {
    expect(isValidatedPro({ accountType: 'pro', proStatus: 'valide' })).toBe(true);
    expect(isValidatedPro({ accountType: 'pro', proStatus: 'en-attente' })).toBe(false);
    expect(isValidatedPro({ accountType: 'particulier', proStatus: 'valide' })).toBe(false);
    expect(isValidatedPro(null)).toBe(false);
  });
  it('prix appliqué', () => {
    expect(unitPriceFor(variant, true)).toBe(900);
    expect(unitPriceFor(variant, false)).toBe(1000);
    expect(unitPriceFor({ ...variant, proPrice: 1200 }, true)).toBe(1000);
  });
});
