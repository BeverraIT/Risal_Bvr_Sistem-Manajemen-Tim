-- Fase 12: Management/Owner (bukan cuma Owner) bisa melihat rapat & thread
-- forum "Internal Divisi" untuk keperluan pengawasan lintas-divisi, sesuai
-- struktur Owner -> Management -> Leader Divisi -> Staff. Sebelumnya hanya
-- superadmin (Owner) yang bypass privasi internal; admin (Management) harus
-- jadi anggota divisi terkait atau pembuatnya untuk bisa melihat.

create or replace function can_view_meeting(p_meeting_id uuid, p_uid uuid)
returns boolean
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_visibility text;
  v_created_by uuid;
begin
  select visibility, created_by into v_visibility, v_created_by
  from meetings where id = p_meeting_id;

  if v_visibility is null then
    return false;
  end if;

  if v_visibility = 'public' then
    return true;
  end if;

  if get_user_role(p_uid) in ('superadmin', 'admin') then
    return true;
  end if;

  if v_created_by = p_uid then
    return true;
  end if;

  return exists (
    select 1 from meeting_divisions md
    where md.meeting_id = p_meeting_id
    and md.division_id = get_user_division(p_uid)
  );
end;
$$;

create or replace function can_view_thread(p_thread_id uuid, p_uid uuid)
returns boolean
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_visibility text;
  v_created_by uuid;
begin
  select visibility, created_by into v_visibility, v_created_by
  from forum_threads where id = p_thread_id;

  if v_visibility is null then
    return false;
  end if;

  if v_visibility = 'public' then
    return true;
  end if;

  if get_user_role(p_uid) in ('superadmin', 'admin') then
    return true;
  end if;

  if v_created_by = p_uid then
    return true;
  end if;

  return exists (
    select 1 from forum_thread_divisions ftd
    where ftd.thread_id = p_thread_id
    and ftd.division_id = get_user_division(p_uid)
  );
end;
$$;

-- Policy select inline (dari 0017, catatan RETURNING) juga perlu diselaraskan
-- dengan bypass admin di atas -- policy ini mengevaluasi kolom row langsung,
-- bukan lewat can_view_meeting/can_view_thread, jadi harus diubah terpisah.
drop policy if exists "meetings_select_visible" on meetings;
create policy "meetings_select_visible" on meetings
  for select using (
    auth.role() = 'authenticated'
    and (
      visibility = 'public'
      or created_by = auth.uid()
      or get_user_role(auth.uid()) in ('superadmin', 'admin')
      or exists (
        select 1 from meeting_divisions md
        where md.meeting_id = meetings.id
        and md.division_id = get_user_division(auth.uid())
      )
    )
  );

drop policy if exists "forum_threads_select_visible" on forum_threads;
create policy "forum_threads_select_visible" on forum_threads
  for select using (
    auth.role() = 'authenticated'
    and (
      visibility = 'public'
      or created_by = auth.uid()
      or get_user_role(auth.uid()) in ('superadmin', 'admin')
      or exists (
        select 1 from forum_thread_divisions ftd
        where ftd.thread_id = forum_threads.id
        and ftd.division_id = get_user_division(auth.uid())
      )
    )
  );
