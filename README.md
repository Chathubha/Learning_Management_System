# Maths Academy LMS

Responsive LMS for one Sri Lankan O/L Mathematics teaching business. React + Vite + strict TypeScript, Tailwind, React Router, React Hook Form/Zod, Lucide and Supabase Auth/PostgreSQL/Storage. No Express server. English UI supports Unicode/Sinhala content. All displayed times are Asia/Colombo; timestamps store UTC instants. Money uses PostgreSQL numeric(12,2) and LKR formatting.

## Local setup

Use Node 22.16+ or a newer supported LTS.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open the URL printed by Vite (normally http://127.0.0.1:5173). The example explicitly enables demo mode, with no credentials needed. Switch Teacher/Student in the labelled banner. Fictional records and small uploads persist in this browser; reset from Account linking/My account. Demo local files are capped at 2 MB and browser quota. Demo is separate from real data and must not contain real student information. Fictional seed: `src/demo/seed.ts`.

Configure the academy name with `VITE_APP_NAME`. Set `VITE_DEMO_MODE=false` for real mode. Invalid/incomplete real credentials produce errors and never silently fall back to demo. A first launch with no environment variables is explicitly labelled demo.

## Supabase setup

Reference: [private bucket access](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [object ownership](https://supabase.com/docs/guides/storage/security/ownership) in the official Supabase documentation.

1. Create a Supabase project. Copy its HTTPS project URL and publishable client key (legacy anon key also works) to `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never use a service-role/secret key or database password in frontend variables.
2. Apply all SQL files in `supabase/migrations` in filename order using the SQL editor, or initialize/link Supabase CLI and use `supabase db push`. Migrations target a fresh project and are versioned rather than rerunnable scripts. The CLI is not bundled.
3. Migrations create private `materials` and `payment-slips` buckets. Verify both remain private. PDFs for materials: 20 MB maximum. PDF/JPEG/PNG slips: 5 MB maximum. Files use immutable paths and 60-second signed URLs. No client overwrite/delete policies exist. Do not add broad storage or financial-table write grants.
4. Enable email/password Auth and email confirmation. Configure Site URL and allowed redirects for local/production origins and each `/reset-password` URL. Configure SMTP for real delivery and test confirmation/recovery emails.
5. Set `VITE_DEMO_MODE=false`, restart Vite, and create test accounts. Signup always creates the student role, regardless of supplied role metadata.

## Secure first-teacher provisioning

Sign up and email-verify the teacher's ordinary account. A trusted project administrator verifies its exact Auth UUID and runs this in the Supabase SQL editor (replace UUID). This must never run in frontend code.

```sql
begin;
update public.profiles set role = 'teacher'
where id = 'VERIFIED-AUTH-USER-UUID'::uuid
  and exists (select 1 from auth.users u
              where u.id = profiles.id and u.email_confirmed_at is not null);
select id, full_name, role from public.profiles
where id = 'VERIFIED-AUTH-USER-UUID'::uuid;
-- Verify the intended account before committing.
commit;
```

Re-login after provisioning. No promotion RPC or frontend role editor exists; authenticated users cannot update profiles. Additional teachers require the same administrator-controlled procedure. All teacher accounts share the same one business.

## Student identity and test accounts

Business student records exist independently of Auth accounts; physical-only students need no login. Signup does not auto-match email, create an enrollment, or grant content access.

Teacher: create a record, privately share its UUID from student details. Student: sign up/verify, request linking in My account using that UUID. Teacher: independently check student/guardian identity and the signed-in account UUID through a trusted channel, then approve in Account linking. The database requires verified account email and one-to-one linking. Knowing a record ID or requesting a link alone grants no access. Enroll the record into each class separately. Archive records to preserve attendance and financial history.

For real-mode testing, create one teacher, two verified students linked to different records/classes, and one unlinked verified student. Test direct API permissions too. Demo `example.test` addresses are fictional; there are no shared passwords or automatic production Auth seeds.

## Implemented features

- Login/logout, student signup, reset password, protected role routes and Supabase-enforced access.
- Actual-data dashboard: active students/classes, today's sessions, approved payments this month, outstanding dues, pending submissions, upcoming lessons and recent payment activity.
- Student add/edit/search/status filter/pagination/details/archive, physical-only records and secure teacher-reviewed linking.
- Theory/Revision/Paper classes by exam year, physical/online/hybrid delivery, fees, enrolled students and materials; multiple classes per student with unique enrollment per pair and date/status edits.
- Timetable and dated sessions, location/HTTPS join links and statuses. Manual attendance, mark all present, corrections, unmarked states, own history. Online attendance is not detected automatically.
- Idempotent dues for any enrollment overlapping a selected month. Full-month charging, no automatic prorating. Snapshot amounts survive fee changes; teacher discounts/overrides require a reason and cannot go below approved payments.
- Approved cash/bank teacher records, student slips pending review, review notes/reviewer/timestamps, partial payments, approved-only balances and explicit voids preserving original records. Financial RPCs check permissions and lock the parent due before mutations to prevent concurrent overpayment/double review. Audit snapshots retain adjustment history.
- PDF notes/papers/answers, HTTPS external recordings/lesson links, topic/type/date, draft/published visibility and private signed downloads.
- Class announcements with publication/expiry. Students see active-enrollment content and only their own records/history. Archived linked students retain their own history but lose content access.
- Navy/teal dashboard, desktop sidebar/mobile navigation, responsive marking/upload forms, labels, keyboard focus, Zod validation, loading/empty/error/success states and error boundary. Supabase Auth state changes clear expired sessions.

## Architecture

`src/api`: client config and repository. `src/demo`: isolated fictional data. `src/hooks`: auth/data providers. `src/features`: domain screens. `src/components`: shared form/panel/table helpers. `src/lib`: dates, money, rules. `src/types.ts`: strict domain types. Presentation screens call contexts/repository, not Supabase queries. Real queries page all visible rows to avoid the default row limit, then filter/paginate locally; larger academies should adopt server aggregation/pagination.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
npm run test:db
npm run test:concurrency
npm run build
npm audit
```

Unit tests cover access rules, enrollment-date overlap, due idempotence/snapshots, partial/pending/rejected payments, voids and overpayment checks. `test:db` runs actual migrations in embedded PostgreSQL (PGlite), stubbing Supabase Auth/Storage schemas and omitting the pgcrypto extension statement (gen_random_uuid is built in). It verifies allowed/denied RLS access, direct role/review tampering, signup role safety, enrollment/attendance uniqueness and class consistency, material/storage isolation, dues, payment invariants and verified linking.

Embedded PostgreSQL uses one connection: competing approvals test invariants, not independent-session lock contention. `test:concurrency` uses two actual PostgreSQL connections and skips unless local server-only `TEST_DATABASE_URL` points to a **disposable migrated test database** with owner fixture privileges and SET ROLE authenticated. It creates committed fictional fixtures to prove blocking then rejection; reset that test database afterward. Never use production or put that variable in frontend/Vercel configuration.

Hosted Auth/SMTP/redirects, PostgREST grants, Storage API/signed expiry and independent-session concurrency still require a configured project. See `VALIDATION.md` for actual results. No deployment or hosted verification is claimed.

Manual desktop/390px mobile checklist:

1. Add a Unicode student, classes, two enrollments; reject duplicates, inspect/edit/archive history.
2. Schedule all delivery modes; check Colombo time and links. Mark all present, correct one to late; untouched attendance remains unmarked.
3. Generate a month twice, change class fee, check old snapshot, apply discount, record partial cash.
4. Verify no student content before linking/enrollment; upload an own slip and check pending. Deny other students' records/files and direct role/payment-review writes.
5. Approve/reject with note; attempt two pending payments whose sum exceeds balance. Void with reason; verify preserved history and restored balance.
6. Publish PDF, keep another draft, add recording, publish/expire announcement; verify class-specific content and signed URL expiry.
7. Check navigation, tables, forms, uploads, keyboard focus, empty business, expired sessions, password recovery and refresh persistence.

## Vercel

Import repository with Vite preset. Install `npm ci`; build `npm run build`; output `dist`. Included SPA rewrites support React Router. Set `VITE_APP_NAME`, `VITE_DEMO_MODE=false`, Supabase URL and publishable key. Rebuild after changing environment variables. Update Supabase Site URL/redirects to deployed origin and `/reset-password`; apply migrations/buckets before real users. Use demo or a dedicated test project for preview deployments. No deployment was performed here.

## Limitations

No hosted video, payment gateway, SMS, exams or tenant separation. Attendance is manual. Demo locking/local storage are conveniences, not real security. Interrupted upload/save can leave orphan files; trusted administrators can reconcile unused paths, preserving referenced payment evidence. Ended-enrollment class metadata is hidden by content RLS, so historical fee views label it Previous class. A permission-checked attendance-history function retains class names/dates without exposing meeting links. A single enrollment range models continuous enrollment; repeated gaps need enrollment-period history in a future version. Corrections to approved payments use void-and-re-record. Browser visual/workflow QA and hosted service tests require available browser/project configuration.
