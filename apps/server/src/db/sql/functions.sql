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

-- Projects the user may see in the workspace (06 §2.3): every live project when a workspace-wide
-- allow binding grants core:* or core:projects:view_all, otherwise the projects bound to the user;
-- a deny binding on a project hides it either way (Deny-Overrides).
create or replace function app_resolve_visibility(p_user uuid, p_workspace uuid) returns uuid[]
language sql stable security definer set search_path = public, pg_temp as $$
  with b as (
    select b.scope_type, b.scope_id, b.effect,
           coalesce(r.permissions, array[b.permission_key]) as perms
    from role_bindings b
    left join roles r on r.id = b.role_id and r.workspace_id = b.workspace_id and r.deleted_at is null
    where b.workspace_id = p_workspace and b.user_id = p_user and b.deleted_at is null
      and (b.expires_at is null or b.expires_at > now())
  )
  select coalesce(array_agg(p.id order by p.id), '{}')
  from projects p
  where p.workspace_id = p_workspace and p.deleted_at is null
    and not exists (select 1 from b where b.effect = 'deny' and b.scope_type = 'project'
                    and b.scope_id = p.id)
    and (
      exists (select 1 from b where b.effect = 'allow' and b.scope_type = 'workspace'
              and (b.perms && array['core:*', 'core:projects:view_all']))
      or exists (select 1 from b where b.effect = 'allow' and b.scope_type = 'project'
                 and b.scope_id = p.id)
    )
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

-- ---------- executors (06 §2.3 B-class handshake, §5.3a) ----------

create or replace function cc_sha256_hex(p text) returns text
language sql immutable as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;

-- Enrollment: a valid one-time token (cc_run_live_*, 15 minutes) enters the runner's workspace and
-- locks its row; the caller then records the long-term secret and the public key in the same
-- transaction (with events) and clears the token, so a token works once.
create or replace function app_enroll_runner(p_token text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
begin
  select id, workspace_id into r from runners
  where enroll_token_hash = cc_sha256_hex(p_token) and status = 'pending'
    and enroll_expires_at > now() and deleted_at is null
  for update;
  if r.id is null then
    raise exception 'invalid or expired enrollment token' using errcode = '28000';
  end if;
  perform set_config('app.current_workspace_id', r.workspace_id::text, true);
  perform set_config('app.current_user_id', '', true);
  perform set_config('app.visible_project_ids', '{}', true);
  return r.id;
end $$;

-- Start of every runner request: the long-term secret decides the workspace. Runner writes go to
-- the project of the node run they hold, so every project of the workspace is visible here.
create or replace function app_enter_runner(p_runner uuid, p_secret text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ws uuid;
begin
  select workspace_id into ws from runners
  where id = p_runner and auth_token_hash = cc_sha256_hex(p_secret) and status = 'online'
    and deleted_at is null;
  if ws is null then
    raise exception 'runner not recognised' using errcode = '28000';
  end if;
  perform set_config('app.current_workspace_id', ws::text, true);
  perform set_config('app.current_user_id', '', true);
  perform set_config('app.visible_project_ids',
    (select coalesce(array_agg(p.id), '{}') from projects p where p.workspace_id = ws)::text, true);
  return ws;
end $$;

-- ---------- invitations (06 §2.3 B-class handshake, §10.1) ----------

-- What an invitation shows before it is accepted; null when it is unknown, used up or expired.
-- p_hash is the sha256 of the link token or of the normalised short code.
create or replace function app_preview_invitation(p_hash text)
returns table (workspace_name text, workspace_kind text, owner_name text, inviter_name text,
               role_key text, expires_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select w.name, w.kind,
         (select u.display_name from role_bindings b join roles r on r.id = b.role_id
            join users u on u.id = b.user_id
          where b.workspace_id = w.id and r.is_owner and b.deleted_at is null
          order by b.created_at limit 1),
         inv.display_name, r.key, i.expires_at
  from workspace_invitations i
  join workspaces w on w.id = i.workspace_id
  join users inv on inv.id = i.created_by
  join roles r on r.id = i.preset_role_id
  where (i.token_hash = p_hash or i.short_code_hash = p_hash)
    and i.accepted_at is null and i.revoked_at is null and i.deleted_at is null
    and i.expires_at > now()
$$;

-- Accepting: the user is not a member yet, so this definer function checks the invitation (and its
-- e-mail when bound), adds the membership and the preset role / project bindings, marks it used and
-- enters the workspace. The caller records the events in the same transaction.
create or replace function app_accept_invitation(p_user uuid, p_hash text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i record;
  email text;
  p uuid;
begin
  select * into i from workspace_invitations
  where (token_hash = p_hash or short_code_hash = p_hash)
    and accepted_at is null and revoked_at is null and deleted_at is null and expires_at > now()
  for update;
  if i.id is null then
    raise exception 'invitation unknown, used or expired' using errcode = 'P0002';
  end if;
  select u.email into email from users u where u.id = p_user;
  if i.invited_email is not null and lower(i.invited_email) <> lower(email) then
    raise exception 'invitation is for another address' using errcode = '42501';
  end if;
  perform set_config('app.current_workspace_id', i.workspace_id::text, true);
  perform set_config('app.current_user_id', p_user::text, true);
  insert into workspace_members (workspace_id, user_id) values (i.workspace_id, p_user)
  on conflict (workspace_id, user_id) do update
    set status = 'active', deleted_at = null, rev = workspace_members.rev + 1, updated_at = now();
  insert into role_bindings (workspace_id, user_id, role_id, scope_type)
  values (i.workspace_id, p_user, i.preset_role_id, 'workspace');
  foreach p in array i.preset_project_ids loop
    insert into role_bindings (workspace_id, user_id, role_id, scope_type, scope_id)
    values (i.workspace_id, p_user, i.preset_role_id, 'project', p);
  end loop;
  update workspace_invitations
    set accepted_at = now(), accepted_by = p_user, rev = rev + 1, updated_at = now()
  where id = i.id;
  perform set_config('app.visible_project_ids', app_resolve_visibility(p_user, i.workspace_id)::text, true);
  return i.workspace_id;
end $$;

-- The workspaces a user belongs to, with their unread notifications (the account menu, 06 §10.1).
create or replace function app_my_workspaces(p_user uuid)
returns table (id uuid, kind text, name text, slug text, unread int)
language sql stable security definer set search_path = public, pg_temp as $$
  select w.id, w.kind, w.name, w.slug,
         (select count(*)::int from notifications n
          where n.workspace_id = w.id and n.user_id = p_user and n.read_at is null
            and n.deleted_at is null)
  from workspace_members m join workspaces w on w.id = m.workspace_id
  where m.user_id = p_user and m.status = 'active' and m.deleted_at is null
    and (m.expires_at is null or m.expires_at > now())
  order by w.kind desc, w.created_at
$$;

-- ---------- change stream relay (06 §3.7, §2.13) ----------

-- After commit, gives pending changes their per-workspace sequence numbers in commit order of
-- discovery and returns the workspaces that got new ones (the caller NOTIFYs listeners). One
-- workspace at a time under its advisory lock, so two relays never hand out the same number.
create or replace function sys_assign_stream_seq(p_limit int) returns setof uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ws uuid;
  base bigint;
begin
  for ws in select distinct c.workspace_id from change_stream c where c.stream_seq is null limit p_limit loop
    perform pg_advisory_xact_lock(hashtext('cc:stream'), hashtext(ws::text));
    select coalesce(max(stream_seq), 0) into base from change_stream where workspace_id = ws;
    with pending as (
      select id, row_number() over (order by created_at, id) as n
      from change_stream where workspace_id = ws and stream_seq is null
    )
    update change_stream c set stream_seq = base + pending.n
    from pending where c.id = pending.id;
    return next ws;
  end loop;
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

-- lease_reaper (06 §2.12): takes over items whose lease expired, with a fresh committed lease, so the
-- reaper can decide inside the item's workspace whether to resume from a checkpoint or mark it
-- interrupted (06 §5.8). Same shape and rules as sys_claim_work.
create or replace function sys_claim_expired(p_limit int, p_owner text, p_lease_seconds int)
returns table (workspace_id uuid, work_item_id uuid, lease_token uuid, fence int)
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  return query
  with expired as (
    select w.id from work_items w
    where w.status = 'leased' and w.lease_expires_at <= now()
    order by w.lease_expires_at
    limit p_limit
    for update skip locked
  )
  update work_items w
  set lease_token = gen_random_uuid(), lease_owner = p_owner,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      fence = w.fence + 1, updated_at = now()
  from expired
  where w.id = expired.id
  returning w.workspace_id, w.id, w.lease_token, w.fence;
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
revoke all on function app_enroll_runner(text) from public;
revoke all on function app_enter_runner(uuid, text) from public;
revoke all on function sys_claim_work(text[], int, text, int) from public;
revoke all on function sys_renew_lease(uuid, uuid, int) from public;
revoke all on function sys_claim_expired(int, text, int) from public;
revoke all on function app_enter_lease(uuid, uuid) from public;
revoke all on function cc_events_ensure_partitions(int) from public;
revoke all on function app_preview_invitation(text) from public;
revoke all on function app_accept_invitation(uuid, text) from public;
revoke all on function sys_assign_stream_seq(int) from public;
grant execute on function app_preview_invitation(text) to cc_app;
revoke all on function app_my_workspaces(uuid) from public;
grant execute on function app_my_workspaces(uuid) to cc_app;
grant execute on function app_accept_invitation(uuid, text) to cc_app;
grant execute on function sys_assign_stream_seq(int) to cc_app;
grant execute on function app_enter(uuid, uuid) to cc_app;
grant execute on function app_create_workspace(uuid, text, text, text) to cc_app;
grant execute on function app_enroll_runner(text) to cc_app;
grant execute on function app_enter_runner(uuid, text) to cc_app;
grant execute on function sys_claim_work(text[], int, text, int) to cc_app;
grant execute on function sys_renew_lease(uuid, uuid, int) to cc_app;
grant execute on function sys_claim_expired(int, text, int) to cc_app;
grant execute on function app_enter_lease(uuid, uuid) to cc_app;
grant execute on function cc_events_ensure_partitions(int) to cc_app;
