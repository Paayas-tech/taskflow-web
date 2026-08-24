-- Expose only collaboration-safe identity fields for users visible to the
-- caller through shared project membership or a pending invitation.
create or replace function public.get_visible_user_profiles(target_user_ids uuid[])
returns table(user_id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.display_name, u.avatar_url
  from public.users u
  where auth.uid() is not null
    and u.id = any(coalesce(target_user_ids, array[]::uuid[]))
    and (
      u.id = auth.uid()
      or exists (
        select 1
        from public.project_members requester
        join public.project_members target
          on target.project_id = requester.project_id
        where requester.user_id = auth.uid()
          and target.user_id = u.id
      )
      or exists (
        select 1
        from public.project_invitations invitation
        where invitation.inviter_id = u.id
          and invitation.status = 'pending'
          and invitation.email_normalized = lower(coalesce(auth.jwt() ->> 'email', ''))
          and (invitation.expires_at is null or invitation.expires_at > now())
      )
    )
  order by u.id;
$$;

revoke all on function public.get_visible_user_profiles(uuid[]) from public, anon;
grant execute on function public.get_visible_user_profiles(uuid[]) to authenticated;
