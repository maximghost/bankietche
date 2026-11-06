-- =====================================================================
-- Bankiétché — Migration 002 : conservation limitée des tentatives.
-- La Politique de confidentialité annonce 30 jours de conservation pour
-- les tentatives d'activation : ce déclencheur purge automatiquement
-- les entrées plus anciennes à chaque nouvelle tentative.
-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.
-- =====================================================================

create index if not exists activation_attempts_created_idx
  on public.activation_attempts (created_at);

create or replace function public.purge_old_activation_attempts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.activation_attempts where created_at < now() - interval '30 days';
  return null;
end;
$$;

revoke execute on function public.purge_old_activation_attempts() from public, anon, authenticated;

drop trigger if exists purge_old_activation_attempts on public.activation_attempts;
create trigger purge_old_activation_attempts
  after insert on public.activation_attempts
  for each statement
  execute function public.purge_old_activation_attempts();
