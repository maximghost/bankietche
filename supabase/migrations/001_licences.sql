-- =====================================================================
-- Bankiétché — Système de licences (Ghost.Technologies)
-- Migration 001 : tables, sécurité (RLS), fonctions d'activation.
--
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.
--
-- Principe de sécurité :
--   * Les tables sont fermées (RLS activée, AUCUNE policy) : la clé "anon"
--     embarquée dans l'appli ne peut ni lire ni écrire directement.
--   * L'appli ne peut appeler que deux fonctions : activate_licence et
--     verify_licence. Elles s'exécutent avec les droits du propriétaire
--     (SECURITY DEFINER) et ne renvoient qu'un statut, jamais de liste.
--   * La génération de codes et la révocation ne sont accessibles que
--     depuis le tableau de bord Supabase (rôle postgres / service_role).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.licences (
  code             text primary key,
  batch            text        not null default 'default',
  status           text        not null default 'active'
                     check (status in ('active', 'revoked')),
  max_activations  int         not null default 2 check (max_activations >= 1),
  note             text,
  created_at       timestamptz not null default now()
);

create table if not exists public.activations (
  id            bigint generated always as identity primary key,
  code          text        not null references public.licences(code) on delete cascade,
  device_id     uuid        not null,
  activated_at  timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  app_version   text,
  unique (code, device_id)
);

create table if not exists public.activation_attempts (
  id          bigint generated always as identity primary key,
  device_id   uuid        not null,
  code_tried  text        not null,
  success     boolean     not null,
  created_at  timestamptz not null default now()
);

create index if not exists activation_attempts_device_time_idx
  on public.activation_attempts (device_id, created_at desc);

-- ---------------------------------------------------------------------
-- Verrouillage : RLS activée sans policy = aucun accès direct via l'API.
-- ---------------------------------------------------------------------

alter table public.licences            enable row level security;
alter table public.activations         enable row level security;
alter table public.activation_attempts enable row level security;

revoke all on public.licences, public.activations, public.activation_attempts
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- Utilitaire : normalisation d'un code saisi par l'utilisateur
-- "bkt 7k2m-qx9p" -> "BKT-7K2M-QX9P"
-- ---------------------------------------------------------------------

create or replace function public.normalize_licence_code(p_code text)
returns text
language sql
immutable
as $$
  select case
    when length(c) = 11 and left(c, 3) = 'BKT'
      then 'BKT-' || substr(c, 4, 4) || '-' || substr(c, 8, 4)
    else c
  end
  from (select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) as c) s;
$$;

-- ---------------------------------------------------------------------
-- activate_licence : appelée par l'appli à la première ouverture.
-- Retour : { "status": "ok" | "invalid" | "revoked" | "limit" | "rate_limited",
--            "activations_left": int }
-- ---------------------------------------------------------------------

create or replace function public.activate_licence(
  p_code        text,
  p_device_id   uuid,
  p_app_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code      text := public.normalize_licence_code(p_code);
  v_licence   public.licences%rowtype;
  v_used      int;
  v_failures  int;
begin
  if p_device_id is null or length(v_code) = 0 or length(v_code) > 64 then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Anti force brute : 10 échecs max par appareil et par heure.
  select count(*) into v_failures
  from public.activation_attempts
  where device_id = p_device_id
    and success = false
    and created_at > now() - interval '1 hour';

  if v_failures >= 10 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  -- Verrou sur la ligne pour éviter deux activations simultanées.
  select * into v_licence
  from public.licences
  where code = v_code
  for update;

  if not found then
    insert into public.activation_attempts (device_id, code_tried, success)
    values (p_device_id, left(v_code, 64), false);
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_licence.status = 'revoked' then
    insert into public.activation_attempts (device_id, code_tried, success)
    values (p_device_id, v_code, false);
    return jsonb_build_object('status', 'revoked');
  end if;

  -- Appareil déjà activé avec ce code : on confirme (réinstallation).
  if exists (select 1 from public.activations
             where code = v_code and device_id = p_device_id) then
    update public.activations
       set last_seen_at = now(), app_version = coalesce(p_app_version, app_version)
     where code = v_code and device_id = p_device_id;
  else
    select count(*) into v_used from public.activations where code = v_code;
    if v_used >= v_licence.max_activations then
      insert into public.activation_attempts (device_id, code_tried, success)
      values (p_device_id, v_code, false);
      return jsonb_build_object('status', 'limit');
    end if;

    insert into public.activations (code, device_id, app_version)
    values (v_code, p_device_id, p_app_version);
  end if;

  insert into public.activation_attempts (device_id, code_tried, success)
  values (p_device_id, v_code, true);

  select count(*) into v_used from public.activations where code = v_code;

  return jsonb_build_object(
    'status', 'ok',
    'code', v_code,
    'activations_left', greatest(v_licence.max_activations - v_used, 0)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- verify_licence : vérification périodique (quand l'appli est en ligne).
-- Permet de révoquer un code (ex. remboursement, partage abusif).
-- Retour : { "status": "ok" | "revoked" | "unknown" }
-- ---------------------------------------------------------------------

create or replace function public.verify_licence(
  p_code        text,
  p_device_id   uuid,
  p_app_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text := public.normalize_licence_code(p_code);
  v_status text;
begin
  select l.status into v_status
  from public.licences l
  join public.activations a on a.code = l.code
  where l.code = v_code and a.device_id = p_device_id;

  if not found then
    return jsonb_build_object('status', 'unknown');
  end if;

  update public.activations
     set last_seen_at = now(), app_version = coalesce(p_app_version, app_version)
   where code = v_code and device_id = p_device_id;

  return jsonb_build_object('status', case when v_status = 'revoked' then 'revoked' else 'ok' end);
end;
$$;

-- ---------------------------------------------------------------------
-- generate_licences : ADMIN uniquement (SQL Editor).
-- Génère p_count codes uniques au format BKT-XXXX-XXXX.
-- Alphabet sans caractères ambigus (pas de 0/O, 1/I/L).
-- Exemple : select * from public.generate_licences(200, 'lot-2026-11');
-- ---------------------------------------------------------------------

create or replace function public.generate_licences(
  p_count            int,
  p_batch            text default 'default',
  p_max_activations  int  default 2
)
returns table (code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes    bytea;
  v_raw      text;
  v_new      text;
  v_created  int := 0;
  i          int;
begin
  if p_count is null or p_count < 1 or p_count > 10000 then
    raise exception 'p_count doit être compris entre 1 et 10000';
  end if;

  while v_created < p_count loop
    -- Tirage sans biais : on rejette les octets >= 248 (= 31 * 8).
    v_raw := '';
    while length(v_raw) < 8 loop
      v_bytes := gen_random_bytes(16);
      for i in 0..15 loop
        exit when length(v_raw) = 8;
        if get_byte(v_bytes, i) < 248 then
          v_raw := v_raw || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
        end if;
      end loop;
    end loop;
    v_new := 'BKT-' || substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4);

    insert into public.licences (code, batch, max_activations)
    values (v_new, p_batch, p_max_activations)
    on conflict do nothing;

    if found then
      v_created := v_created + 1;
      code := v_new;
      return next;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Vue de suivi (ADMIN). security_invoker : la clé anon n'y voit rien.
-- Exemple : select * from public.licence_overview order by created_at desc;
-- ---------------------------------------------------------------------

create or replace view public.licence_overview
with (security_invoker = true) as
select
  l.code,
  l.batch,
  l.status,
  l.max_activations,
  count(a.id)          as activations,
  max(a.last_seen_at)  as last_seen_at,
  l.note,
  l.created_at
from public.licences l
left join public.activations a on a.code = l.code
group by l.code;

revoke all on public.licence_overview from anon, authenticated;

-- ---------------------------------------------------------------------
-- Droits d'exécution : seules activate/verify sont publiques.
-- ---------------------------------------------------------------------

revoke execute on function public.activate_licence(text, uuid, text)  from public;
revoke execute on function public.verify_licence(text, uuid, text)    from public;
revoke execute on function public.generate_licences(int, text, int)   from public, anon, authenticated;

grant execute on function public.activate_licence(text, uuid, text) to anon, authenticated;
grant execute on function public.verify_licence(text, uuid, text)   to anon, authenticated;
