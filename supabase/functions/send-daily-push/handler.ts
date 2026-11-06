// Logique d'envoi des rappels quotidiens, séparée du serveur HTTP pour être testable.
import webpush from 'npm:web-push@3.6.7';

export interface Config {
  supabaseUrl: string;
  /** Clé secrète (sb_secret_…) ou ancienne clé service_role (eyJ…). */
  dbKey: string;
  vapidPublic: string;
  vapidPrivate: string;
  vapidSubject: string;
  cronSecret: string;
}

interface Sub { id: number; endpoint: string; p256dh: string; auth: string }

/** Contenu volontairement vide de toute donnée : c'est le téléphone qui rédige le message. */
const PAYLOAD = JSON.stringify({ t: 'daily' });

async function rpc<T>(cfg: Config, fn: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: cfg.dbKey };
  if (cfg.dbKey.startsWith('eyJ')) headers.Authorization = `Bearer ${cfg.dbKey}`;
  const res = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${fn}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

export async function handle(req: Request, cfg: Config): Promise<Response> {
  if (!cfg.cronSecret || req.headers.get('x-cron-secret') !== cfg.cronSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  webpush.setVapidDetails(cfg.vapidSubject, cfg.vapidPublic, cfg.vapidPrivate);

  const subs = await rpc<Sub[]>(cfg, 'push_claim_due', {});
  const gone: number[] = [];
  let sent = 0;
  let failed = 0;

  // Envoi par lots de 50 pour rester dans les limites de la fonction.
  for (let i = 0; i < subs.length; i += 50) {
    await Promise.all(subs.slice(i, i + 50).map(async (s) => {
      try {
        const d = webpush.generateRequestDetails(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          PAYLOAD,
          { TTL: 4 * 3600, urgency: 'normal' },
        );
        const res = await fetch(d.endpoint, { method: d.method, headers: d.headers as Record<string, string>, body: d.body });
        if (res.status === 404 || res.status === 410) gone.push(s.id);
        else if (res.ok) sent++;
        else failed++;
      } catch {
        failed++;
      }
    }));
  }
  if (gone.length) await rpc<number>(cfg, 'push_forget', { p_ids: gone });

  return new Response(JSON.stringify({ due: subs.length, sent, gone: gone.length, failed }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
