-- Functions for RLS context, system-task leases, audit probes and event partitions
-- (docs/06 §2.3, §2.8, §2.12). Re-applied after every migration run, so everything is
-- CREATE OR REPLACE. Owned by cc_migrator; the runtime account cc_app only gets EXECUTE on the
-- app_* / sys_* entry points listed at the end.

-- ---------- triggers ----------

create or replace function cc_reject_change() returns trigger
language plpgsql as $$
begin
  raise exception 'table % is append-only', tg_table_name using errcode = '42501';
end $$;

-- tg_argv[0]: column holding the workspace id
create or replace function cc_audit_probe() returns trigger
language plpgsql as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into audit_probe (workspace_id, table_name, row_id, actor_user_id)
  values ((r ->> tg_argv[0])::uuid, tg_table_name, (r ->> 'id')::uuid,
          nullif(current_setting('app.current_user_id', true), '')::uuid);
  return null;
end $$;

-- ---------- entering a workspace ----------

-- Projects the user may see in the workspace. P1: every active member sees every live project;
-- P2 narrows this with role_bindings without changing callers.
create or replace function app_resolve_visibility(p_user uuid, p_workspace uuid) returns uuid[]
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(array_agg(p.id order by p.id), '{}')
  from projects p
  where p.workspace_id = p_workspace and p.deleted_at is null
$$;

-- Start of every user transaction: check membership, then pin workspace, user and visible projects
-- for this transaction only (set_config(..., true)).
create or replace function app_enter(p_user uuid, p_workspace uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from workspace_members m
    where m.workspace_id = p_workspace and m.user_id = p_user and m.status = 'active'
      and m.deleted_at is null and (m.expires_at is null or m.expires_at > now())
  ) then
    raise exception 'not an active member of this workspace' using errcode = '42501';
  end if;
  perform set_config('app.current_workspace_id', p_workspace::text, true);
  perform set_config('app.current_user_id', p_user::text, true);
  perform set_config('app.visible_project_ids', app_resolve_visibility(p_user, p_workspace)::text, true);
end $$;

-- Creates a workspace with its creator as the first member and enters it.
create or replace function app_create_workspace(p_user uuid, p_kind text, p_slug text, p_name text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ws uuid;
begin
  insert into workspaces (kind, slug, name) values (p_kind, p_slug, p_name) returning id into ws;
  perform set_config('app.current_workspace_id', ws::text, true);
  perform set_config('app.current_user_id', p_user::text, true);
  perform set_config('app.visible_project_ids', '{}', true);
  insert into workspace_members (workspace_id, user_id) values (ws, p_user);
  return ws;
end $$;

-- ---------- system tasks: claim with a committed lease, then work inside one workspace ----------

-- Called as a single statement (autocommit), so the lease is committed before any work starts.
-- Returns ids and tokens only, never business content.
create or replace function sys_claim_work(p_kinds text[], p_limit int, p_owner text, p_lease_seconds int)
returns table (workspace_id uuid, work_item_id uuid, lease_token uuid, fence int)
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select w.id from work_items w
    where w.status = 'queued' and w.run_after <= now() and w.kind = any(p_kinds)
    order by w.run_after
    limit p_limit
    for update skip locked
  )
  update work_items w
  set status = 'leased', lease_token = gen_random_uuid(), lease_owner = p_owner,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      fence = w.fence + 1, attempts = w.attempts + 1, updated_at = now()
  from due
  where w.id = due.id
  returning w.workspace_id, w.id, w.lease_token, w.fence;
end $$;

-- false means the lease is gone: the worker must stop.
create or replace function sys_renew_lease(p_item uuid, p_token uuid, p_seconds int) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update work_items
  set lease_expires_at = now() + make_interval(secs => p_seconds), updated_at = now()
  where id = p_item and lease_token = p_token and status = 'leased' and lease_expires_at > now();
  return found;
end $$;

-- Start of a system transaction for a claimed item: the lease decides the workspace.
create or replace function app_enter_lease(p_item uuid, p_token uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ws uuid;
begin
  select w.workspace_id into ws from work_items w
  where w.id = p_item and w.lease_token = p_token and w.status = 'leased' and w.lease_expires_at > now();
  if ws is null then
    raise exception 'lease lost' using errcode = 'CC001';
  end if;
  perform set_config('app.current_workspace_id', ws::text, true);
  perform set_config('app.current_user_id', '', true);
  perform set_config('app.visible_project_ids',
    (select coalesce(array_agg(p.id), '{}') from projects p where p.workspace_id = ws)::text, true);
  return ws;
end $$;

-- ---------- event partitions ----------

-- Monthly partitions from last month to p_months ahead; the runtime account never touches them directly.
create or replace function cc_events_ensure_partitions(p_months int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  m date;
  name text;
begin
  for i in -1 .. p_months loop
    m := (date_trunc('month', now()) + make_interval(months => i))::date;
    name := format('events_y%sm%s', to_char(m, 'YYYY'), to_char(m, 'MM'));
    execute format('create table if not exists %I partition of events for values from (%L) to (%L)',
                   name, m, (m + interval '1 month')::date);
    execute format('revoke all on %I from cc_app', name);
  end loop;
end $$;

-- ---------- privileges ----------

revoke all on function app_resolve_visibility(uuid, uuid) from public;
revoke all on function app_enter(uuid, uuid) from public;
revoke all on function app_create_workspace(uuid, text, text, text) from public;
revoke all on function sys_claim_work(text[], int, text, int) from public;
revoke all on function sys_renew_lease(uuid, uuid, int) from public;
revoke all on function app_enter_lease(uuid, uuid) from public;
revoke all on function cc_events_ensure_partitions(int) from public;
grant execute on function app_enter(uuid, uuid) to cc_app;
grant execute on function app_create_workspace(uuid, text, text, text) to cc_app;
grant execute on function sys_claim_work(text[], int, text, int) to cc_app;
grant execute on function sys_renew_lease(uuid, uuid, int) to cc_app;
grant execute on function app_enter_lease(uuid, uuid) to cc_app;
grant execute on function cc_events_ensure_partitions(int) to cc_app;
