// Rendu Markdown des contenus du CMS. Le HTML brut est désactivé et les liens
// dangereux (javascript:, data:…) sont refusés : un éditeur ne peut pas injecter de script.
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false });

// Liens externes : nouvel onglet, sans transmettre la page d'origine.
const defaultLink = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = String(tokens[idx].attrGet('href') ?? '');
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return defaultLink(tokens, idx, options, env, self);
};

// Images : chargement différé.
const defaultImage = md.renderer.rules.image!;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('loading', 'lazy');
  tokens[idx].attrSet('decoding', 'async');
  return defaultImage(tokens, idx, options, env, self);
};

export function renderMarkdown(source: string): string {
  return md.render(source ?? '');
}

/** Texte brut (pour les extraits et les données structurées). */
export function plainText(source: string, max = 300): string {
  const text = md
    .render(source ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
