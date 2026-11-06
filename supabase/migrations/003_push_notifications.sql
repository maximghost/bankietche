-- =====================================================================
-- Bankiétché — Migration 003 : rappels quotidiens (notifications push).
--
-- Principe de confidentialité : le serveur ne stocke QUE l'adresse
-- technique de notification fournie par le navigateur, l'heure du rappel
-- et le fuseau horaire. Aucune donnée financière, aucun nom. Le message
-- est rédigé par le téléphone à partir de ses données locales.
--
-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.
-- =====================================================================

create table if not exists public.push_subscriptions (
  id            bigint generated always as identity primary key,
  code          text        not null references public.licences(code) on delete cascade,
  device_id     uuid        not null,
  endpoint      text        not null unique,
  p256dh        text        not null,
  auth          text        not null,
  hour          smallint    not null check (hour between 0 and 23),
  tz            text        not null,
  last_sent_on  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists push_subscriptions_device_idx on public.push_subscriptions (device_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- ---------------------------------------------------------------------
-- push_subscribe : appelée par l'appli (clé publique).
-- Exige une licence active ET un appareil activé avec ce code.
-- Retour : { "status": "ok" | "licence" | "invalid" | "limit" }
-- ---------------------------------------------------------------------
create or replace function public.push_subscribe(
  p_code      text,
  p_device_id uuid,
  p_endpoint  text,
  p_p256dh    text,
  p_auth      text,
  p_hour      int,
  p_tz        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code  text := public.normalize_licence_code(p_code);
  v_count int;
  v_skip  date;
begin
  if p_device_id is null
     or p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or p_p256dh is null or length(p_p256dh) not between 60 and 200
     or p_auth is null or length(p_auth) not between 16 and 64
     or p_hour is null or p_hour not between 0 and 23
     or p_tz is null or not exists (select 1 from pg_timezone_names where name = p_tz) then
    return jsonb_build_object('status', 'invalid');
  end if;

  if not exists (
    select 1 from public.licences l
    join public.activations a on a.code = l.code
    where l.code = v_code and l.status = 'active' and a.device_id = p_device_id
  ) then
    return jsonb_build_object('status', 'licence');
  end if;

  -- Si l'heure du rappel est déjà passée aujourd'hui, le premier arrive demain.
  v_skip := case when extract(hour from (now() at time zone p_tz))::int >= p_hour
                 then (now() at time zone p_tz)::date end;

  -- Une adresse déjà connue est mise à jour (changement d'heure, de fuseau).
  update public.push_subscriptions
     set code = v_code, device_id = p_device_id, p256dh = p_p256dh, auth = p_auth,
         hour = p_hour, tz = p_tz, updated_at = now(),
         last_sent_on = greatest(last_sent_on, v_skip)
   where endpoint = p_endpoint;
  if found then
    return jsonb_build_object('status', 'ok');
  end if;

  select count(*) into v_count from public.push_subscriptions where device_id = p_device_id;
  if v_count >= 3 then
    -- On remplace la plus ancienne (navigateur réinstallé, etc.).
    delete from public.push_subscriptions
     where id = (select id from public.push_subscriptions where device_id = p_device_id order by updated_at asc limit 1);
  end if;

  insert into public.push_subscriptions (code, device_id, endpoint, p256dh, auth, hour, tz, last_sent_on)
  values (v_code, p_device_id, p_endpoint, p_p256dh, p_auth, p_hour, p_tz, v_skip);
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------
-- push_unsubscribe : l'appli désactive les rappels.
-- ---------------------------------------------------------------------
create or replace function public.push_unsubscribe(p_device_id uuid, p_endpoint text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_subscriptions where device_id = p_device_id and endpoint = p_endpoint;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------
-- push_claim_due : SERVEUR uniquement (fonction d'envoi).
-- Sélectionne les abonnements dont c'est l'heure locale et qui n'ont
-- pas encore reçu leur rappel aujourd'hui (heure locale), et les marque
-- immédiatement : pas de double envoi même si l'envoi est relancé.
-- Les licences révoquées ne reçoivent plus rien.
-- ---------------------------------------------------------------------
create or replace function public.push_claim_due(p_now timestamptz default now())
returns table (id bigint, endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select s.id, (p_now at time zone s.tz)::date as local_day
      from public.push_subscriptions s
      join public.licences l on l.code = s.code and l.status = 'active'
     where extract(hour from (p_now at time zone s.tz))::int >= s.hour
       and (s.last_sent_on is null or s.last_sent_on < (p_now at time zone s.tz)::date)
     for update of s skip locked
  )
  update public.push_subscriptions s
     set last_sent_on = due.local_day
    from due
   where s.id = due.id
  returning s.id, s.endpoint, s.p256dh, s.auth;
end;
$$;

-- ---------------------------------------------------------------------
-- push_forget : SERVEUR uniquement. Supprime les adresses expirées
-- (le service de notification a répondu 404 ou 410).
-- ---------------------------------------------------------------------
create or replace function public.push_forget(p_ids bigint[])
returns int
language sql
security definer
set search_path = public
as $$
  with d as (delete from public.push_subscriptions where id = any(p_ids) returning 1)
  select count(*)::int from d;
$$;

-- ---------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------
revoke execute on function public.push_subscribe(text, uuid, text, text, text, int, text) from public;
revoke execute on function public.push_unsubscribe(uuid, text) from public;
revoke execute on function public.push_claim_due(timestamptz) from public, anon, authenticated;
revoke execute on function public.push_forget(bigint[]) from public, anon, authenticated;

grant execute on function public.push_subscribe(text, uuid, text, text, text, int, text) to anon, authenticated;
grant execute on function public.push_unsubscribe(uuid, text) to anon, authenticated;
grant execute on function public.push_claim_due(timestamptz) to service_role;
grant execute on function public.push_forget(bigint[]) to service_role;
