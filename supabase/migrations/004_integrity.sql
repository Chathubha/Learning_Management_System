-- Retain access to the linked student's financial/attendance history if archived;
-- content remains restricted to active students and active enrollments by in_class.
create or replace function public.owns_student(sid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from students where id=sid and account_id=auth.uid()) $$;
alter table public.classes add constraint finite_class_fee check(monthly_fee<10000000000);
alter table public.fee_dues add constraint finite_due_amount check(amount<10000000000 and base_amount<10000000000);
alter table public.payments add constraint finite_payment_amount check(amount<10000000000);
-- Audit snapshots make operational and financial corrections reviewable.
create or replace function public.log_change() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into audit_log(actor_id,action,table_name,record_id,details) values(auth.uid(),TG_OP,TG_TABLE_NAME,new.id,jsonb_build_object('before',case when TG_OP='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new))); return new; end $$;
-- Prevent unlinked accounts from filling storage with arbitrary evidence.
drop policy slips_upload on storage.objects;
create policy slips_upload on storage.objects for insert to authenticated with check(bucket_id='payment-slips' and (storage.foldername(name))[1]=auth.uid()::text and (public.is_teacher() or exists(select 1 from public.fee_dues d where public.owns_student(d.student_id))));
