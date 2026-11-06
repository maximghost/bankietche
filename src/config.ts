/** Configuration lue au moment du build (fichier .env.local ou secrets GitHub). */

export const APP_VERSION = '1.2.0';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
/** Clé publique Supabase : publishable (sb_publishable_…) ou ancienne clé anon (eyJ…). */
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const CHARIOW_URL = import.meta.env.VITE_CHARIOW_URL ?? '';

/** Clé publique VAPID des notifications (publique par conception). */
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

export const SUPPORT_LABEL = 'Ghost.Technologies';

/** Fréquence de la vérification de licence quand l'appli est en ligne. */
export const LICENCE_RECHECK_DAYS = 7;

/** Rappel de sauvegarde si aucune sauvegarde depuis N jours. */
export const BACKUP_REMINDER_DAYS = 14;
