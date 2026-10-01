// Run against a disposable migrated Supabase/local PostgreSQL database ONLY.
import pg from "pg";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
test(
  "independent PostgreSQL connections serialize approvals on the parent due",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const owner = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    const a = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    const b = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await Promise.all([owner.connect(), a.connect(), b.connect()]);
    const tid = randomUUID(),
      sid = randomUUID(),
      cid = randomUUID(),
      eid = randomUUID(),
      did = randomUUID();
    try {
      await owner.query("begin");
      await owner.query(
        "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')",
        [tid, `concurrency-${tid}@example.test`],
      );
      await owner.query("update profiles set role='teacher' where id=$1", [
        tid,
      ]);
      await owner.query(
        "insert into students(id,student_number,full_name) values($1,$2,'Concurrency test')",
        [sid, `TEST-${sid}`],
      );
      await owner.query(
        "insert into classes(id,name,exam_year,type,delivery_mode,monthly_fee) values($1,'Concurrency test',2027,'Theory','online',100)",
        [cid],
      );
      await owner.query(
        "insert into enrollments(id,student_id,class_id,start_date) values($1,$2,$3,'2026-01-01')",
        [eid, sid, cid],
      );
      await owner.query(
        "insert into fee_dues(id,enrollment_id,student_id,class_id,year,month,base_amount,amount) values($1,$2,$3,$4,2026,10,100,100)",
        [did, eid, sid, cid],
      );
      const p1 = randomUUID(),
        p2 = randomUUID();
      await owner.query(
        "insert into payments(id,due_id,amount,method,submitted_by) values($1,$3,75,'bank',$4),($2,$3,75,'bank',$4)",
        [p1, p2, did, tid],
      );
      await owner.query("commit");
      for (const c of [a, b]) {
        await c.query("begin");
        await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
          tid,
        ]);
        await c.query("set local role authenticated");
      }
      await a.query("select review_payment($1,true,'First connection')", [p1]);
      let settled = false;
      const second = b
        .query("select review_payment($1,true,'Second connection')", [p2])
        .then(
          () => {
            settled = true;
            return null;
          },
          (e) => {
            settled = true;
            return e;
          },
        );
      await new Promise((r) => setTimeout(r, 150));
      assert.equal(
        settled,
        false,
        "Second connection must wait on the due lock",
      );
      await a.query("commit");
      const denied = await second;
      assert.match(denied.message, /exceeds outstanding/);
      await b.query("rollback");
      const result = await owner.query(
        "select sum(amount)::numeric as paid from payments where due_id=$1 and status='approved'",
        [did],
      );
      assert.equal(Number(result.rows[0].paid), 75);
    } finally {
      await Promise.all([a.end(), b.end(), owner.end()]);
    }
  },
);
