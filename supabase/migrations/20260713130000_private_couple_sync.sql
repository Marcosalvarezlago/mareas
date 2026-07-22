-- Mareas: sincronización privada para una pareja.
-- Las claves internas her/him son persistentes y no deben renombrarse.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code_hash bytea not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.couple_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  role text not null check (role in ('her', 'him')),
  joined_at timestamptz not null default now(),
  unique (couple_id, role),
  unique (user_id, couple_id)
);

-- El contenido privado nunca comparte fila con contenido visible por la pareja.
create table public.private_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 1048576),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

-- Esta tabla contiene solo una proyección previamente filtrada en el cliente.
create table public.shared_snapshots (
  user_id uuid primary key,
  couple_id uuid not null,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 1048576),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  foreign key (user_id, couple_id)
    references public.couple_members(user_id, couple_id) on delete cascade
);

-- El ciclo es compartido para lectura, pero solo el rol her puede escribirlo.
create table public.cycle_snapshots (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 1048576),
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index couple_members_couple_idx on public.couple_members(couple_id);
create index shared_snapshots_couple_idx on public.shared_snapshots(couple_id);

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.private_snapshots enable row level security;
alter table public.shared_snapshots enable row level security;
alter table public.cycle_snapshots enable row level security;

-- SECURITY DEFINER evita recursión de RLS al consultar couple_members desde
-- sus propias políticas. El search_path vacío evita sustitución de objetos.
create or replace function public.is_couple_member(target_couple uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members member
    where member.couple_id = target_couple
      and member.user_id = (select auth.uid())
  );
$$;

create or replace function public.my_couple_role(target_couple uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select member.role
  from public.couple_members member
  where member.couple_id = target_couple
    and member.user_id = (select auth.uid());
$$;

revoke all on function public.is_couple_member(uuid) from public;
revoke all on function public.my_couple_role(uuid) from public;
grant execute on function public.is_couple_member(uuid) to authenticated;
grant execute on function public.my_couple_role(uuid) to authenticated;

create policy couples_read_by_members
on public.couples for select
to authenticated
using ((select public.is_couple_member(id)));

create policy members_read_same_couple
on public.couple_members for select
to authenticated
using ((select public.is_couple_member(couple_id)));

create policy private_snapshot_read_own
on public.private_snapshots for select
to authenticated
using ((select auth.uid()) = user_id);

create policy private_snapshot_insert_own
on public.private_snapshots for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy private_snapshot_update_own
on public.private_snapshots for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy private_snapshot_delete_own
on public.private_snapshots for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy shared_snapshot_read_couple
on public.shared_snapshots for select
to authenticated
using ((select public.is_couple_member(couple_id)));

create policy shared_snapshot_insert_own
on public.shared_snapshots for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (select public.is_couple_member(couple_id))
);

create policy shared_snapshot_update_own
on public.shared_snapshots for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (select public.is_couple_member(couple_id))
);

create policy shared_snapshot_delete_own
on public.shared_snapshots for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy cycle_snapshot_read_couple
on public.cycle_snapshots for select
to authenticated
using ((select public.is_couple_member(couple_id)));

create policy cycle_snapshot_insert_her
on public.cycle_snapshots for insert
to authenticated
with check (
  (select public.my_couple_role(couple_id)) = 'her'
  and (select auth.uid()) = updated_by
);

create policy cycle_snapshot_update_her
on public.cycle_snapshots for update
to authenticated
using ((select public.my_couple_role(couple_id)) = 'her')
with check (
  (select public.my_couple_role(couple_id)) = 'her'
  and (select auth.uid()) = updated_by
);

create policy cycle_snapshot_delete_her
on public.cycle_snapshots for delete
to authenticated
using ((select public.my_couple_role(couple_id)) = 'her');

-- Crea el espacio de pareja y devuelve el código una única vez. Solo se
-- conserva su hash, por lo que ni la base de datos puede recuperar el código.
create or replace function public.create_couple(requested_role text)
returns table (couple_id uuid, invite_code text, member_role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized_role text := lower(trim(requested_role));
  raw_code text;
  new_couple uuid;
begin
  if actor is null then
    raise exception 'authentication_required';
  end if;
  if normalized_role not in ('her', 'him') then
    raise exception 'invalid_role';
  end if;
  if exists (select 1 from public.couple_members where user_id = actor) then
    raise exception 'already_in_couple';
  end if;

  loop
    raw_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12));
    begin
      insert into public.couples (invite_code_hash, created_by)
      values (extensions.digest(raw_code, 'sha256'), actor)
      returning id into new_couple;
      exit;
    exception when unique_violation then
      -- Colisión criptográficamente improbable; se genera otro código.
    end;
  end loop;

  insert into public.couple_members (user_id, couple_id, role)
  values (actor, new_couple, normalized_role);

  return query select
    new_couple,
    substr(raw_code, 1, 4) || '-' || substr(raw_code, 5, 4) || '-' || substr(raw_code, 9, 4),
    normalized_role;
end;
$$;

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
  if exists (select 1 from public.couple_members where user_id = actor) then
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
      select 1 from public.couple_members as member
      where member.couple_id = target and member.role = 'her'
    ) then 'him'
    else 'her'
  end;

  insert into public.couple_members (user_id, couple_id, role)
  values (actor, target, assigned_role);

  return query select target, assigned_role;
end;
$$;

create or replace function public.rotate_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target uuid;
  raw_code text;
begin
  select member.couple_id into target
  from public.couple_members as member
  where member.user_id = actor;

  if target is null then
    raise exception 'couple_required';
  end if;

  loop
    raw_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12));
    begin
      update public.couples
      set invite_code_hash = extensions.digest(raw_code, 'sha256')
      where id = target;
      exit;
    exception when unique_violation then
      -- Se genera un código distinto.
    end;
  end loop;

  return substr(raw_code, 1, 4) || '-' || substr(raw_code, 5, 4) || '-' || substr(raw_code, 9, 4);
end;
$$;

revoke all on function public.create_couple(text) from public;
revoke all on function public.join_couple(text) from public;
revoke all on function public.rotate_invite_code() from public;
grant execute on function public.create_couple(text) to authenticated;
grant execute on function public.join_couple(text) to authenticated;
grant execute on function public.rotate_invite_code() to authenticated;

-- Realtime solo para las tres instantáneas; las políticas RLS siguen aplicando.
alter publication supabase_realtime add table public.private_snapshots;
alter publication supabase_realtime add table public.shared_snapshots;
alter publication supabase_realtime add table public.cycle_snapshots;
