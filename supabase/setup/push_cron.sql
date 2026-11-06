-- =====================================================================
-- Bankiétché — Planification des rappels quotidiens.
-- À exécuter UNE FOIS dans le SQL Editor, APRÈS avoir déployé la fonction
-- send-daily-push et défini ses secrets (voir README, « Notifications »).
--
-- Remplace les deux valeurs entre chevrons avant d'exécuter :
--   <PROJECT_URL>      ex. https://abcdxyz.supabase.co
--   <PUSH_CRON_SECRET> la même valeur que le secret PUSH_CRON_SECRET de la fonction
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Valeurs sensibles rangées dans le coffre-fort de Supabase (Vault).
select vault.create_secret('<PROJECT_URL>', 'project_url');
select vault.create_secret('<PUSH_CRON_SECRET>', 'push_cron_secret');

-- Toutes les heures (à la 2e minute). La base choisit elle-même, selon le
-- fuseau horaire de chaque abonné, qui doit recevoir son rappel.
select cron.schedule(
  'bankietche-rappels',
  '2 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-daily-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Vérifications utiles :
--   select * from cron.job;                                                -- la tâche existe
--   select status_code, content, created from net._http_response order by created desc limit 5;  -- résultats des envois
-- Pour arrêter : select cron.unschedule('bankietche-rappels');
