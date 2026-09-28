// Fonds colorés des cartes (Partenaires, B2B, Activités, chiffres de Qui sommes-nous) :
// une teinte par carte, dans l'ordre, pour distinguer les blocs voisins.
const CARD_TINTS = [
  '!border-green-200 !bg-green-100',
  '!border-blue-200 !bg-blue-100',
  '!border-violet-200 !bg-violet-100',
  '!border-amber-200 !bg-amber-100',
  '!border-rose-200 !bg-rose-100',
];

export const cardTint = (index: number) => CARD_TINTS[index % CARD_TINTS.length];
