// Fonction Edge « send-daily-push » : appelée chaque heure par pg_cron.
// Déploiement : voir README, section « Notifications ».
import { handle } from './handler.ts';

function dbKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const k = JSON.parse(keys).default;
      if (k) return k;
    } catch { /* format inattendu : on se rabat sur l'ancienne clé */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

Deno.serve((req) =>
  handle(req, {
    supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
    dbKey: dbKey(),
    vapidPublic: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    vapidPrivate: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    vapidSubject: Deno.env.get('VAPID_SUBJECT') ?? '',
    cronSecret: Deno.env.get('PUSH_CRON_SECRET') ?? '',
  }).catch((e) => new Response(JSON.stringify({ error: String(e) }), { status: 500 })),
);
