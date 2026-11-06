import type { ComponentType } from 'preact';
import {
  Baby, BookOpen, Briefcase, Bus, Cake, Car, Church, Coffee, Coins, Dumbbell, Footprints, Fuel, Gamepad2, Gem,
  Gift, GraduationCap, HandCoins, HandHeart, Handshake, HeartPulse, House, Landmark, Laptop, Lightbulb, Motorbike,
  Music, PartyPopper, PawPrint, PiggyBank, Plane, Printer, Receipt, Scissors, Shield, Shirt, Smartphone, Store,
  Tag, Target, Trophy, Users, Utensils, Wallet, Wifi, Wrench, Droplet, Moon,
} from 'lucide-preact';

type Icon = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' }>;

/**
 * Registre des icônes (Lucide, licence ISC). Les catégories et objectifs
 * stockent une clé ; une clé inconnue retombe sur « tag ».
 * Pour ajouter une icône : l'importer ci-dessus et l'ajouter ici. Ne jamais
 * renommer une clé existante (elle est enregistrée dans les données).
 */
export const ICONS: Record<string, { C: Icon; label: string }> = {
  food: { C: Utensils, label: 'Repas' },
  moto: { C: Motorbike, label: 'Moto / zém' },
  bus: { C: Bus, label: 'Bus / taxi' },
  car: { C: Car, label: 'Voiture' },
  fuel: { C: Fuel, label: 'Carburant' },
  wifi: { C: Wifi, label: 'Internet' },
  phone: { C: Smartphone, label: 'Téléphone' },
  laptop: { C: Laptop, label: 'Ordinateur' },
  book: { C: BookOpen, label: 'Études' },
  graduation: { C: GraduationCap, label: 'Diplôme' },
  printer: { C: Printer, label: 'Impressions' },
  party: { C: PartyPopper, label: 'Sorties' },
  music: { C: Music, label: 'Musique' },
  game: { C: Gamepad2, label: 'Jeux' },
  sport: { C: Dumbbell, label: 'Sport' },
  family: { C: Users, label: 'Famille' },
  baby: { C: Baby, label: 'Enfant' },
  shirt: { C: Shirt, label: 'Habits' },
  shoe: { C: Footprints, label: 'Chaussures' },
  scissors: { C: Scissors, label: 'Coiffure' },
  health: { C: HeartPulse, label: 'Santé' },
  home: { C: House, label: 'Logement' },
  bulb: { C: Lightbulb, label: 'Électricité' },
  water: { C: Droplet, label: 'Eau' },
  tools: { C: Wrench, label: 'Réparations' },
  coffee: { C: Coffee, label: 'Café / snack' },
  church: { C: Church, label: 'Église' },
  mosque: { C: Moon, label: 'Mosquée' },
  paw: { C: PawPrint, label: 'Animaux' },
  handshake: { C: Handshake, label: 'Tontine' },
  'heart-hand': { C: HandHeart, label: 'Soutien' },
  briefcase: { C: Briefcase, label: 'Travail' },
  store: { C: Store, label: 'Commerce' },
  gift: { C: Gift, label: 'Cadeau' },
  coins: { C: Coins, label: 'Argent' },
  'hand-coins': { C: HandCoins, label: 'Prêt' },
  wallet: { C: Wallet, label: 'Portefeuille' },
  bank: { C: Landmark, label: 'Banque' },
  receipt: { C: Receipt, label: 'Divers' },
  tag: { C: Tag, label: 'Autre' },
  target: { C: Target, label: 'Objectif' },
  piggy: { C: PiggyBank, label: 'Épargne' },
  plane: { C: Plane, label: 'Voyage' },
  gem: { C: Gem, label: 'Bijou' },
  cake: { C: Cake, label: 'Fête' },
  trophy: { C: Trophy, label: 'Récompense' },
  shield: { C: Shield, label: 'Urgence' },
};

export const CATEGORY_ICON_KEYS = [
  'food', 'moto', 'bus', 'car', 'fuel', 'wifi', 'phone', 'laptop', 'book', 'graduation', 'printer', 'party',
  'music', 'game', 'sport', 'family', 'baby', 'shirt', 'shoe', 'scissors', 'health', 'home', 'bulb', 'water',
  'tools', 'coffee', 'church', 'mosque', 'paw', 'heart-hand', 'briefcase', 'store', 'gift', 'coins',
  'hand-coins', 'wallet', 'bank', 'receipt', 'tag',
];

export const GOAL_ICON_KEYS = [
  'target', 'phone', 'laptop', 'graduation', 'moto', 'car', 'shoe', 'plane', 'home', 'gem', 'cake', 'shield',
  'store', 'trophy', 'piggy', 'baby',
];

/** Teintes douces (fond / icône) qui passent le contraste 3:1 pour l'icône, en clair comme en sombre. */
const TINTS = ['violet', 'blue', 'teal', 'amber', 'rose', 'green', 'indigo', 'orange'] as const;

function tintFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function IconOf(props: { name: string; size?: number }) {
  const { C } = ICONS[props.name] ?? ICONS.tag;
  return <C size={props.size ?? 20} strokeWidth={2} aria-hidden="true" />;
}

/** Pastille colorée avec icône (catégories, objectifs). */
export function IconBadge(props: { name: string; size?: 'sm' | 'md' | 'lg'; tint?: string }) {
  const s = props.size ?? 'md';
  const px = s === 'sm' ? 16 : s === 'lg' ? 26 : 20;
  return (
    <span class={`icon-badge ib-${s} tint-${props.tint ?? tintFor(props.name)}`} aria-hidden="true">
      <IconOf name={props.name} size={px} />
    </span>
  );
}
