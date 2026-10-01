// Actual migrations run in an embedded PostgreSQL engine, with Supabase auth/storage
// schemas stubbed. Supabase-hosted auth/storage APIs still require integration QA.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
const db = new PGlite();
const teacher = "10000000-0000-0000-0000-000000000001",
  student = "10000000-0000-0000-0000-000000000002",
  other = "10000000-0000-0000-0000-000000000003";
const sid = "20000000-0000-0000-0000-000000000001",
  sid2 = "20000000-0000-0000-0000-000000000002",
  cid = "30000000-0000-0000-0000-000000000001",
  cid2 = "30000000-0000-0000-0000-000000000002",
  eid = "40000000-0000-0000-0000-000000000001",
  sess = "50000000-0000-0000-0000-000000000001";
let due;
const query = (sql, params = []) => db.query(sql, params);
const as = async (id) => {
  await db.exec("reset role");
  await query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
};
const owner = () => db.exec("reset role");
before(async () => {
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create schema storage; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth,storage to authenticated; grant execute on function auth.uid() to authenticated; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text); alter table storage.objects enable row level security; grant select,insert on storage.objects to authenticated; create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;`,
  );
  for (const name of [
    "001_schema",
    "002_security",
    "003_storage",
    "004_integrity",
    "005_attendance_history",
  ]) {
    const sql = await readFile(
      new URL(`../supabase/migrations/${name}.sql`, import.meta.url),
      "utf8",
    );
    await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
  }
  await query(
    'insert into auth.users(id,email_confirmed_at,raw_user_meta_data) values($1,now(),\'{"role":"teacher"}\'),($2,now(),\'{"role":"teacher"}\'),($3,now(),\'{}\')',
    [teacher, student, other],
  );
  await query("update profiles set role='teacher' where id=$1", [teacher]);
  await query(
    "insert into students(id,student_number,full_name,account_id) values($1,'TEST-1','Own student',$2),($3,'TEST-2','Other student',$4)",
    [sid, student, sid2, other],
  );
  await query(
    "insert into classes(id,name,exam_year,type,delivery_mode,monthly_fee) values($1,'Test theory',2027,'Theory','hybrid',3500),($2,'Other class',2027,'Paper','online',2000)",
    [cid, cid2],
  );
  await query(
    "insert into enrollments(id,student_id,class_id,start_date) values($1,$2,$3,'2025-01-01')",
    [eid, sid, cid],
  );
  await query(
    "insert into class_sessions(id,class_id,starts_at,ends_at,delivery_mode) values($1,$2,now(),now()+interval '2 hours','online')",
    [sess, cid],
  );
  await query(
    "insert into materials(class_id,title,type,is_published,file_path) values($1,'Published','notes',true,'teacher/allowed.pdf'),($1,'Draft','notes',false,'teacher/draft.pdf'),($2,'Other class file','notes',true,'teacher/other.pdf')",
    [cid, cid2],
  );
  await db.exec(
    "insert into storage.objects(bucket_id,name) values('materials','teacher/allowed.pdf'),('materials','teacher/draft.pdf'),('materials','teacher/other.pdf')",
  );
});
after(() => db.close());
test("signup metadata cannot assign teacher and direct role changes are denied", async () => {
  await as(student);
  assert.equal(
    (await query("select role from profiles where id=$1", [student])).rows[0]
      .role,
    "student",
  );
  await assert.rejects(
    query("update profiles set role='teacher' where id=$1", [student]),
    /permission denied/,
  );
  await assert.rejects(
    query("select generate_dues(2026,10)"),
    /Teacher permission/,
  );
});
test("RLS isolates records, classes, published materials and storage objects", async () => {
  await as(student);
  assert.deepEqual(
    (await query("select id from students")).rows.map((r) => r.id),
    [sid],
  );
  assert.deepEqual(
    (await query("select id from classes")).rows.map((r) => r.id),
    [cid],
  );
  assert.deepEqual(
    (await query("select title from materials")).rows.map((r) => r.title),
    ["Published"],
  );
  assert.deepEqual(
    (
      await query(
        "select name from storage.objects where bucket_id='materials'",
      )
    ).rows.map((r) => r.name),
    ["teacher/allowed.pdf"],
  );
  await assert.rejects(
    query(
      "insert into classes(name,exam_year,type,delivery_mode,monthly_fee) values('Hack',2027,'Theory','online',0)",
    ),
    /row-level security/,
  );
  await assert.rejects(
    query("update students set account_id=$1 where id=$2", [other, sid]),
    /permission denied/,
  );
});
test("teacher access allowed; enrollment and attendance uniqueness enforced", async () => {
  await as(teacher);
  assert.equal(
    (await query("select count(*)::int as n from students")).rows[0].n,
    2,
  );
  await assert.rejects(
    query(
      "insert into enrollments(student_id,class_id,start_date) values($1,$2,'2025-01-01')",
      [sid, cid],
    ),
    /unique constraint/,
  );
  await query(
    "insert into attendance(session_id,enrollment_id,student_id,class_id,status) values($1,$2,$3,$4,'present')",
    [sess, eid, sid, cid],
  );
  await assert.rejects(
    query(
      "insert into attendance(session_id,enrollment_id,student_id,class_id,status) values($1,$2,$3,$4,'absent')",
      [sess, eid, sid, cid],
    ),
    /unique constraint/,
  );
  await assert.rejects(
    query(
      "insert into attendance(session_id,enrollment_id,student_id,class_id,status) values($1,$2,$3,$4,'absent')",
      [sess, eid, sid2, cid],
    ),
    /foreign key/,
  );
});
test("dues generation is idempotent, dated, and retains fee snapshot", async () => {
  await as(teacher);
  assert.equal(
    (await query("select generate_dues(2026,10) as n")).rows[0].n,
    1,
  );
  assert.equal(
    (await query("select generate_dues(2026,10) as n")).rows[0].n,
    0,
  );
  due = (await query("select id from fee_dues")).rows[0].id;
  await query("update classes set monthly_fee=9000 where id=$1", [cid]);
  assert.equal(
    Number((await query("select amount from fee_dues")).rows[0].amount),
    3500,
  );
  await query(
    "update enrollments set end_date='2026-10-31',status='ended' where id=$1",
    [eid],
  );
  assert.equal(
    (await query("select generate_dues(2026,11) as n")).rows[0].n,
    0,
  );
  await query(
    "update enrollments set end_date=null,status='active' where id=$1",
    [eid],
  );
});
test("partial approved payments, pending and rejected submissions, protected review fields", async () => {
  await as(teacher);
  await query("select record_payment($1,1000,'cash','Cash',null)", [due]);
  await as(student);
  const path = `${student}/slip.pdf`;
  await query(
    "insert into storage.objects(bucket_id,name,owner_id) values('payment-slips',$1,$2)",
    [path, student],
  );
  const p = (
    await query("select record_payment($1,1500,'bank','Pending',$2) as id", [
      due,
      path,
    ])
  ).rows[0].id;
  assert.equal(
    Number((await query("select due_balance($1) as b", [due])).rows[0].b),
    2500,
  );
  await assert.rejects(
    query(
      "update payments set status='approved',reviewed_by=$1,reviewed_at=now() where id=$2",
      [student, p],
    ),
    /permission denied/,
  );
  await assert.rejects(
    query("select review_payment($1,true,'Hack')", [p]),
    /Teacher permission/,
  );
  await as(teacher);
  await query("select review_payment($1,false,'Unreadable slip')", [p]);
  assert.equal(
    Number((await query("select due_balance($1) as b", [due])).rows[0].b),
    2500,
  );
  await assert.rejects(
    query("select review_payment($1,true,'Again')", [p]),
    /already reviewed/,
  );
});
test("competing approvals cannot overpay and financial corrections preserve history", async () => {
  await as(student);
  const path = `${student}/slip.pdf`;
  const a = (
    await query("select record_payment($1,2000,'bank','A',$2) as id", [
      due,
      path,
    ])
  ).rows[0].id;
  const b = (
    await query("select record_payment($1,2000,'bank','B',$2) as id", [
      due,
      path,
    ])
  ).rows[0].id;
  await as(teacher);
  const result = await Promise.allSettled([
    query("select review_payment($1,true,'A')", [a]),
    query("select review_payment($1,true,'B')", [b]),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    Number((await query("select due_balance($1) as b", [due])).rows[0].b),
    500,
  );
  await assert.rejects(
    query("select adjust_due($1,2000,'Below paid')", [due]),
    /below approved/,
  );
  const approved = (
    await query(
      "select id from payments where due_id=$1 and amount=2000 and status='approved'",
      [due],
    )
  ).rows[0].id;
  await query("select void_payment($1,'Correction')", [approved]);
  assert.equal(
    (await query("select status from payments where id=$1", [approved])).rows[0]
      .status,
    "approved",
  );
  assert.equal(
    Number((await query("select due_balance($1) as b", [due])).rows[0].b),
    2500,
  );
  await assert.rejects(
    query("select void_payment($1,'Again')", [approved]),
    /unique constraint/,
  );
});
test("a request cannot self-link and teacher linking requires verified email", async () => {
  await owner();
  const unlinked = (
    await query(
      "insert into students(student_number,full_name) values('TEST-3','Unlinked') returning id",
    )
  ).rows[0].id;
  await query("update students set account_id=null where id=$1", [sid2]);
  await query("update auth.users set email_confirmed_at=null where id=$1", [
    other,
  ]);
  await as(other);
  await query("select request_link($1)", [unlinked]);
  const request = (await query("select id from linking_requests")).rows[0].id;
  await assert.rejects(
    query("select review_link($1,true)", [request]),
    /Teacher permission/,
  );
  await as(teacher);
  await assert.rejects(
    query("select review_link($1,true)", [request]),
    /email must be verified/,
  );
  await owner();
  await query("update auth.users set email_confirmed_at=now() where id=$1", [
    other,
  ]);
  await as(teacher);
  await query("select review_link($1,true)", [request]);
  assert.equal(
    (await query("select account_id from students where id=$1", [unlinked]))
      .rows[0].account_id,
    other,
  );
});
test("archived students retain only their own attendance metadata and financial history", async () => {
  await as(teacher);
  await query("update students set status='archived' where id=$1", [sid]);
  await as(student);
  assert.equal(
    (await query("select count(*)::int as n from classes")).rows[0].n,
    0,
  );
  assert.equal(
    (await query("select count(*)::int as n from materials")).rows[0].n,
    0,
  );
  const history = (await query("select * from get_attendance_history()")).rows;
  assert.equal(history.length, 1);
  assert.equal(history[0].student_id, sid);
  assert.equal(history[0].class_name, "Test theory");
  assert.equal(
    (await query("select count(*)::int as n from fee_dues")).rows[0].n,
    1,
  );
  await as(other);
  assert.equal(
    (await query("select count(*)::int as n from get_attendance_history()"))
      .rows[0].n,
    0,
  );
});
