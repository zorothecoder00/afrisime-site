// Recherche plein texte tolérante aux fautes courantes (accents, pluriels, 1-2 lettres).

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stem(word: string): string {
  return word.length > 3 ? word.replace(/(es|s|x)$/, '') : word;
}

/** Distance d'édition où l'inversion de deux lettres voisines (« hulie ») compte pour une faute. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

function tokenMatches(query: string, word: string): number {
  if (word.startsWith(query)) return 3;
  if (word.includes(query)) return 2;
  const tolerance = query.length >= 7 ? 2 : query.length >= 4 ? 1 : 0;
  if (tolerance === 0) return 0;
  // Compare aussi avec le début du mot pour tolérer une faute dans un mot tapé en partie.
  const candidate = word.length > query.length ? word.slice(0, query.length) : word;
  return Math.min(editDistance(query, word), editDistance(query, candidate)) <= tolerance ? 1 : 0;
}

/**
 * Score d'un texte pour une requête : 0 si un des mots de la requête ne correspond à rien,
 * sinon un score d'autant plus élevé que la correspondance est exacte.
 */
export function searchScore(query: string, haystack: string): number {
  const qTokens = normalize(query).split(' ').filter(Boolean).map(stem);
  if (qTokens.length === 0) return 1;
  const words = normalize(haystack).split(' ').filter(Boolean).map(stem);
  let score = 0;
  for (const q of qTokens) {
    let best = 0;
    for (const w of words) best = Math.max(best, tokenMatches(q, w));
    if (best === 0) return 0;
    score += best;
  }
  return score;
}
