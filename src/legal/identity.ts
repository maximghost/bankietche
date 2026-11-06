export const LEGAL_IDENTITY = {
  editor: 'Ghost.Technologies',
  representative: 'Yaovi Joel Maxim TOKINLO',
  /** Ex. « Entreprise individuelle », « SARL »… ou « Projet en cours d'immatriculation ». */
  legalStatus: 'Activité exercée à titre personnel par Yaovi Joel Maxim TOKINLO, en cours d’immatriculation',
  /** N° RCCM et IFU si disponibles, sinon « En cours d'immatriculation ». */
  registration: 'RCCM et IFU : immatriculation en cours',
  address: 'Abomey-Calavi - Bénin',
  email: 'yaovitokinlo13@gmail.com',
  /** Numéro WhatsApp au format international. */
  whatsapp: '+229 01 40 96 32 42',
  /** Région choisie pour le projet Supabase (serveur de licences). */
  licenceServerRegion: 'Union européenne (Francfort)',
  store: 'Ghost.Store (boutique Chariow)',
};

/** Version des textes : à changer quand les CGU évoluent (les utilisateurs devront les réaccepter). */
export const LEGAL_VERSION = '2026-11-06';
export const LEGAL_UPDATED = '6 novembre 2026';

export const isFilled = (v: string) => !v.startsWith('[À COMPLÉTER');
