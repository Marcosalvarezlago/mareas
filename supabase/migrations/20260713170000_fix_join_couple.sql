-- Corrige referencias ambiguas entre las columnas y las variables de salida
-- de PL/pgSQL detectadas por `supabase db lint` en el proyecto remoto.
create or replace function public.join_couple(provided_code text)
returns table (couple_id uuid, member_role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  raw_code text := upper(regexp_replace(coalesce(provided_code, ''), '[^A-F0-9]', '', 'g'));
  target uuid;
  assigned_role text;
begin
  if actor is null then
    raise exception 'authentication_required';
  end if;
  if exists (
    select 1
    from public.couple_members as member
    where member.user_id = actor
  ) then
    raise exception 'already_in_couple';
  end if;
  if length(raw_code) <> 12 then
    raise exception 'invalid_invite_code';
  end if;

  select couples.id into target
  from public.couples as couples
  where couples.invite_code_hash = extensions.digest(raw_code, 'sha256')
  for update;

  if target is null then
    raise exception 'invalid_invite_code';
  end if;
  if (
    select count(*)
    from public.couple_members as member
    where member.couple_id = target
  ) >= 2 then
    raise exception 'couple_full';
  end if;

  assigned_role := case
    when exists (
      select 1
      from public.couple_members as member
      where member.couple_id = target and member.role = 'her'
    ) then 'him'
    else 'her'
  end;

  insert into public.couple_members (user_id, couple_id, role)
  values (actor, target, assigned_role);

  return query select target, assigned_role;
end;
$$;

revoke all on function public.join_couple(text) from public;
grant execute on function public.join_couple(text) to authenticated;
