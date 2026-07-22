-- Inicio de la prueba real: elimina únicamente las instantáneas ad hoc y
-- conserva cuentas, pareja y roles. A partir de aquí cada sobrescritura queda
-- archivada para poder recuperar la memoria ante cambios futuros.

delete from public.private_snapshots;
delete from public.shared_snapshots;
delete from public.cycle_snapshots;

create table public.snapshot_history (
  id bigint generated always as identity primary key,
  snapshot_kind text not null check (snapshot_kind in ('private', 'shared', 'cycle')),
  owner_user_id uuid,
  couple_id uuid,
  payload jsonb not null,
  version bigint not null,
  archived_at timestamptz not null default now(),
  archived_by uuid default auth.uid()
);

create index snapshot_history_owner_idx
  on public.snapshot_history(owner_user_id, archived_at desc);
create index snapshot_history_couple_idx
  on public.snapshot_history(couple_id, archived_at desc);

alter table public.snapshot_history enable row level security;

create policy snapshot_history_read_own_or_couple
on public.snapshot_history for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  or (couple_id is not null and (select public.is_couple_member(couple_id)))
);

create or replace function public.archive_snapshot_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.snapshot_history (
    snapshot_kind,
    owner_user_id,
    couple_id,
    payload,
    version,
    archived_by
  ) values (
    case TG_TABLE_NAME
      when 'private_snapshots' then 'private'
      when 'shared_snapshots' then 'shared'
      else 'cycle'
    end,
    coalesce(
      (to_jsonb(OLD) ->> 'user_id')::uuid,
      (to_jsonb(OLD) ->> 'updated_by')::uuid
    ),
    (to_jsonb(OLD) ->> 'couple_id')::uuid,
    OLD.payload,
    OLD.version,
    auth.uid()
  );
  return OLD;
end;
$$;

revoke all on function public.archive_snapshot_revision() from public;

create trigger archive_private_snapshot
before update or delete on public.private_snapshots
for each row execute function public.archive_snapshot_revision();

create trigger archive_shared_snapshot
before update or delete on public.shared_snapshots
for each row execute function public.archive_snapshot_revision();

create trigger archive_cycle_snapshot
before update or delete on public.cycle_snapshots
for each row execute function public.archive_snapshot_revision();

comment on table public.snapshot_history is
  'Historial inmutable de instantáneas para recuperación; sin permisos de escritura directos del cliente.';
