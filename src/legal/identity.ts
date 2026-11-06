/**
 * Identité de l'éditeur, affichée dans les pages légales.
 * ⚠️ À COMPLÉTER AVANT LA MISE EN VENTE : chaque valeur entre crochets.
 * `npm run check:legal` échoue tant qu'il reste un « [À COMPLÉTER ».
 */
export const LEGAL_IDENTITY = {
  editor: 'Ghost.Technologies',
  representative: 'Yaovi Joel Maxim TOKINLO',
  /** Ex. « Entreprise individuelle », « SARL »… ou « Projet en cours d'immatriculation ». */
  legalStatus: '[À COMPLÉTER : statut juridique]',
  /** N° RCCM et IFU si disponibles, sinon « En cours d'immatriculation ». */
  registration: '[À COMPLÉTER : RCCM / IFU]',
  address: '[À COMPLÉTER : ville, quartier — Bénin]',
  email: '[À COMPLÉTER : e-mail de support]',
  /** Numéro WhatsApp au format international, chiffres uniquement, ex. 22990000000. */
  whatsapp: '[À COMPLÉTER : WhatsApp]',
  /** Région choisie pour le projet Supabase (serveur de licences). */
  licenceServerRegion: '[À COMPLÉTER : ex. Union européenne (Paris)]',
  store: 'Ghost.Store (boutique Chariow)',
};

/** Version des textes : à changer quand les CGU évoluent (les utilisateurs devront les réaccepter). */
export const LEGAL_VERSION = '2026-11-06';
export const LEGAL_UPDATED = '6 novembre 2026';

export const isFilled = (v: string) => !v.startsWith('[À COMPLÉTER');
