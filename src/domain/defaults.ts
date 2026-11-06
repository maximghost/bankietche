import { DEFAULT_PERIOD } from './period';
import type { Category, Settings } from './types';

/** Identifiants réservés, utilisés par la logique des tontines. */
export const CAT_TONTINE_COTISATION = 'sys-tontine-cotisation';
export const CAT_TONTINE_RAMASSAGE = 'sys-tontine-ramassage';
/** Catégorie utilisée par l'assistant pour le solde de départ. */
export const CAT_SOLDE_DEPART = 'rev-solde-depart';

type Seed = Pick<Category, 'id' | 'name' | 'icon' | 'kind'> & { system?: boolean };

const EXPENSES: Seed[] = [
  { id: 'dep-nourriture', name: 'Nourriture', icon: 'food', kind: 'depense' },
  { id: 'dep-transport', name: 'Transport', icon: 'moto', kind: 'depense' },
  { id: 'dep-forfait', name: 'Forfait & appels', icon: 'wifi', kind: 'depense' },
  { id: 'dep-etudes', name: 'Études', icon: 'book', kind: 'depense' },
  { id: 'dep-sorties', name: 'Sorties & loisirs', icon: 'party', kind: 'depense' },
  { id: 'dep-famille', name: 'Famille & entraide', icon: 'family', kind: 'depense' },
  { id: 'dep-habits', name: 'Habits & beauté', icon: 'shirt', kind: 'depense' },
  { id: 'dep-sante', name: 'Santé', icon: 'health', kind: 'depense' },
  { id: 'dep-logement', name: 'Logement & factures', icon: 'home', kind: 'depense' },
  { id: CAT_TONTINE_COTISATION, name: 'Tontine (cotisation)', icon: 'handshake', kind: 'depense', system: true },
  { id: 'dep-autre', name: 'Autres dépenses', icon: 'receipt', kind: 'depense' },
];

const INCOMES: Seed[] = [
  { id: CAT_SOLDE_DEPART, name: 'Solde de départ', icon: 'wallet', kind: 'revenu' },
  { id: 'rev-parents', name: 'Argent des parents', icon: 'heart-hand', kind: 'revenu' },
  { id: 'rev-salaire', name: 'Salaire / paie', icon: 'briefcase', kind: 'revenu' },
  { id: 'rev-business', name: 'Business & petits jobs', icon: 'store', kind: 'revenu' },
  { id: 'rev-bourse', name: 'Bourse', icon: 'graduation', kind: 'revenu' },
  { id: CAT_TONTINE_RAMASSAGE, name: 'Tontine (ramassage)', icon: 'handshake', kind: 'revenu', system: true },
  { id: 'rev-cadeau', name: 'Cadeaux', icon: 'gift', kind: 'revenu' },
  { id: 'rev-autre', name: 'Autres revenus', icon: 'coins', kind: 'revenu' },
];

export function defaultCategories(): Category[] {
  return [...EXPENSES, ...INCOMES].map((c, i) => ({
    ...c,
    budget: 0,
    archived: false,
    system: c.system ?? false,
    order: i,
  }));
}

export function defaultSettings(): Settings {
  return {
    name: '', period: { ...DEFAULT_PERIOD }, theme: 'system', discreet: false, onboarded: false,
    notifications: { enabled: false, hour: 20, detailed: false },
  };
}

/** Conversion des anciens émojis (v1.0) vers les clés d'icônes (v1.1). */
export const EMOJI_TO_ICON: Record<string, string> = {
  '🍛': 'food', '🛵': 'moto', '📶': 'wifi', '📚': 'book', '🎉': 'party', '👨‍👩‍👧': 'family',
  '👕': 'shirt', '💊': 'health', '🏠': 'home', '🧾': 'receipt', '💝': 'heart-hand', '💼': 'briefcase',
  '🛒': 'store', '🎓': 'graduation', '🎁': 'gift', '💰': 'coins', '🤝': 'handshake', '⛽': 'fuel',
  '💡': 'bulb', '💧': 'water', '⚽': 'sport', '🎮': 'game', '☕': 'coffee', '✂️': 'scissors',
  '⛪': 'church', '🕌': 'mosque', '🐾': 'paw', '🔧': 'tools', '🖨️': 'printer', '🎯': 'target',
  '📱': 'phone', '💻': 'laptop', '👟': 'shoe', '✈️': 'plane', '💍': 'gem', '🎂': 'cake',
  '🏥': 'health', '🚨': 'shield',
};

export function iconFromEmoji(emoji: unknown, fallback: string): string {
  return typeof emoji === 'string' ? (EMOJI_TO_ICON[emoji] ?? fallback) : fallback;
}
