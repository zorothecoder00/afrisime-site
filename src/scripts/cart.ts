// Panier visiteur, stocké dans le navigateur. Quand les comptes clients seront en place,
// le panier d'un client connecté sera synchronisé côté serveur.
import { track } from './analytics';

export type CartItem = {
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  price: number;
  quantity: number;
  slug: string;
  color: string;
};

const KEY = 'afs-cart-v1';
let memoryCart: CartItem[] = [];

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : memoryCart;
  } catch {
    return memoryCart;
  }
}

function write(items: CartItem[]) {
  memoryCart = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* navigation privée ou stockage bloqué : le panier reste en mémoire */
  }
  document.dispatchEvent(new CustomEvent('afs:cart', { detail: items }));
}

export const cart = {
  items: read,
  count: () => read().reduce((n, i) => n + i.quantity, 0),
  subtotal: () => read().reduce((n, i) => n + i.price * i.quantity, 0),
  add(item: Omit<CartItem, 'quantity'>, quantity = 1) {
    const items = read();
    const existing = items.find((i) => i.productId === item.productId && i.variantId === item.variantId);
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, 999);
    else items.push({ ...item, quantity });
    write(items);
    track('add_to_cart', { item_id: item.productId, variant: item.variantId, value: item.price * quantity });
  },
  setQuantity(productId: string, variantId: string, quantity: number) {
    const items = read()
      .map((i) => (i.productId === productId && i.variantId === variantId ? { ...i, quantity: Math.min(quantity, 999) } : i))
      .filter((i) => i.quantity > 0);
    write(items);
  },
  remove(productId: string, variantId: string) {
    write(read().filter((i) => !(i.productId === productId && i.variantId === variantId)));
  },
  replace(items: CartItem[]) {
    write(items);
  },
  clear() {
    write([]);
  },
};

function renderCount() {
  const n = cart.count();
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((el) => {
    el.textContent = String(n);
    el.hidden = n === 0;
  });
}

function toast(message: string) {
  let el = document.getElementById('afs-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'afs-toast';
    el.setAttribute('role', 'status');
    el.className =
      'fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-brand-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-opacity';
    document.body.appendChild(el);
  }
  const link = document.createElement('a');
  link.href = '/panier';
  link.className = 'underline';
  link.textContent = 'Voir le panier';
  el.replaceChildren(`${message} · `, link);
  el.style.opacity = '1';
  clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(setTimeout(() => (el!.style.opacity = '0'), 3200));
}

// Boutons « Ajouter » : <button data-add-to-cart='{"productId":…}'> ; un bouton peut aussi
// désigner un sélecteur de variante (data-variant-select) et un champ quantité (data-qty-input).
document.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-add-to-cart]');
  if (!button) return;
  const base = JSON.parse(button.dataset.addToCart!);
  const variants: { id: string; label: string; price: number }[] = base.variants;
  const select = button.dataset.variantSelect
    ? document.querySelector<HTMLInputElement>(`input[name="${button.dataset.variantSelect}"]:checked`)
    : null;
  const variant = variants.find((v) => v.id === (select?.value ?? base.defaultVariant)) ?? variants[0];
  const qtyInput = button.dataset.qtyInput ? document.getElementById(button.dataset.qtyInput) as HTMLInputElement | null : null;
  const quantity = Math.max(1, Math.floor(Number(qtyInput?.value ?? 1)) || 1);

  cart.add(
    {
      productId: base.productId,
      variantId: variant.id,
      name: base.name,
      variantLabel: variant.label,
      price: variant.price,
      slug: base.slug,
      color: base.color,
    },
    quantity,
  );
  toast(`${quantity} × ${base.name} ajouté${quantity > 1 ? 's' : ''}`);
});

document.addEventListener('afs:cart', renderCount);
window.addEventListener('storage', (e) => e.key === KEY && renderCount());
renderCount();
