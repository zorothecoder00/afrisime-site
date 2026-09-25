// Petits comportements des formulaires du back-office : lignes répétées (formats, caractéristiques,
// liens de menu), confirmation des actions destructives, adresse (slug) déduite du titre.

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Renumérote les champs `prefix[i][champ]` d'un conteneur après ajout ou suppression. */
function renumber(container: HTMLElement) {
  const prefix = container.dataset.rows!;
  container.querySelectorAll<HTMLElement>('[data-row]').forEach((row, i) => {
    row.querySelectorAll<HTMLInputElement>('[name]').forEach((input) => {
      input.name = input.name.replace(new RegExp(`^${prefix}\\[\\d+\\]`), `${prefix}[${i}]`);
    });
  });
}

export function initAdminForms(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>('[data-add-row]').forEach((button) =>
    button.addEventListener('click', () => {
      const container = root.querySelector<HTMLElement>(`[data-rows="${button.dataset.addRow}"]`)!;
      const rows = container.querySelectorAll<HTMLElement>('[data-row]');
      const clone = rows[rows.length - 1].cloneNode(true) as HTMLElement;
      clone.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select, textarea').forEach((input) => {
        if (input instanceof HTMLInputElement && (input.type === 'checkbox' || input.type === 'radio')) input.checked = false;
        else input.value = '';
      });
      container.appendChild(clone);
      renumber(container);
      clone.querySelector<HTMLInputElement>('input')?.focus();
    }),
  );

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const remove = target.closest<HTMLButtonElement>('[data-remove-row]');
    if (remove) {
      const container = remove.closest<HTMLElement>('[data-rows]')!;
      const row = remove.closest<HTMLElement>('[data-row]')!;
      if (container.querySelectorAll('[data-row]').length > 1) row.remove();
      else row.querySelectorAll<HTMLInputElement>('input, textarea').forEach((i) => (i.value = ''));
      renumber(container);
    }
    const confirmButton = target.closest<HTMLElement>('[data-confirm]');
    if (confirmButton && !confirm(confirmButton.dataset.confirm)) event.preventDefault();
  });

  // Adresse déduite du titre tant qu'elle n'a pas été modifiée à la main (création uniquement).
  const source = root.querySelector<HTMLInputElement>('[data-slug-source]');
  const target = root.querySelector<HTMLInputElement>('[data-slug-target]');
  if (source && target) {
    let touched = !!target.value;
    target.addEventListener('input', () => (touched = true));
    source.addEventListener('input', () => {
      if (!touched) target.value = slugify(source.value);
    });
  }

  // Copie dans le presse-papiers (ex. code Markdown d'une image).
  root.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy!);
        const label = b.textContent;
        b.textContent = 'Copié ✓';
        setTimeout(() => (b.textContent = label), 1500);
      } catch {
        prompt('Copiez ce texte :', b.dataset.copy);
      }
    }),
  );
}
