-- Own historical attendance remains usable after enrollment ends. Return only
-- attendance metadata; this does not expose past classes' meeting/content links.
create function public.get_attendance_history() returns table(id uuid,session_id uuid,enrollment_id uuid,student_id uuid,status text,updated_at timestamptz,session_starts_at timestamptz,class_name text) language sql stable security definer set search_path=public as $$
 select a.id,a.session_id,a.enrollment_id,a.student_id,a.status,a.updated_at,s.starts_at,c.name
 from attendance a join class_sessions s on s.id=a.session_id join classes c on c.id=s.class_id
 where is_teacher() or owns_student(a.student_id)
$$;
revoke all on function public.get_attendance_history() from public,anon;
grant execute on function public.get_attendance_history() to authenticated;
