import { describe, expect, it } from 'vitest';
import { normalize, searchScore } from '../../src/lib/search';
import { clean, isValidEmail, isValidPhone } from '../../src/lib/validation';

describe('recherche tolérante (REC-02)', () => {
  const riz = 'Riz parfumé long grain Savana Céréales AFS-CER-001 Sac 25 kg';
  const huile = 'Huile végétale raffinée Golfe d’Or Huiles AFS-HUI-001 Bidon 5 L';

  it('ignore accents et majuscules', () => {
    expect(normalize('Céréales PARFUMÉ')).toBe('cereales parfume');
    expect(searchScore('cereales', riz)).toBeGreaterThan(0);
  });
  it('tolère une faute de frappe courante', () => {
    expect(searchScore('parfume', riz)).toBeGreaterThan(0);
    expect(searchScore('hulie', huile)).toBeGreaterThan(0); // lettres inversées
    expect(searchScore('vegetal', huile)).toBeGreaterThan(0);
  });
  it('accepte singulier et pluriel', () => {
    expect(searchScore('huiles', huile)).toBeGreaterThan(0);
  });
  it('trouve par référence', () => {
    expect(searchScore('AFS-CER-001', riz)).toBeGreaterThan(0);
  });
  it('exige que tous les mots correspondent', () => {
    expect(searchScore('riz huile', riz)).toBe(0);
  });
  it('classe une correspondance exacte avant une correspondance approchée', () => {
    expect(searchScore('riz', riz)).toBeGreaterThan(searchScore('rix', riz));
  });
  it('ne renvoie rien pour un mot sans rapport', () => {
    expect(searchScore('ordinateur', riz)).toBe(0);
  });
});

describe('validation', () => {
  it('numéros togolais et internationaux', () => {
    expect(isValidPhone('90 11 22 33')).toBe(true);
    expect(isValidPhone('+228 90 11 22 33')).toBe(true);
    expect(isValidPhone('0022870112233')).toBe(true);
    expect(isValidPhone('+33 6 12 34 56 78')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('80 11 22 33')).toBe(false);
  });
  it('adresses e-mail', () => {
    expect(isValidEmail('client@exemple.tg')).toBe(true);
    expect(isValidEmail('client@exemple')).toBe(false);
    expect(isValidEmail('client exemple.com')).toBe(false);
  });
  it('clean coupe et nettoie', () => {
    expect(clean('  abc  ')).toBe('abc');
    expect(clean('abcdef', 3)).toBe('abc');
    expect(clean(42)).toBe('');
  });
});
