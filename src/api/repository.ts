import { supabase, demoMode } from "./client";
import { seed } from "../demo/seed";
import type { Data, Role, Row, Table } from "../types";
import {
  balance,
  canAccessClass,
  checkApproval,
  generateDues,
  requireTeacher,
} from "../lib/rules";
const key = "maths-academy-demo-v1";
const fresh = (): Data => structuredClone(seed);
function read(): Data {
  const raw = localStorage.getItem(key);
  if (!raw) return fresh();
  try {
    return JSON.parse(raw) as Data;
  } catch {
    throw new Error("Demo data is damaged. Use Reset demo to restore it.");
  }
}
function save(d: Data) {
  localStorage.setItem(key, JSON.stringify(d));
}
const uid = () => crypto.randomUUID();
function assertOwn(d: Data, account: string, sid: string) {
  if (
    !d.students.some(
      (s) => s.id === sid && s.account_id === account && s.status === "active",
    )
  )
    throw new Error("Access denied");
}
async function locked<T>(action: () => T): Promise<T> {
  return navigator.locks ? navigator.locks.request(key, action) : action();
}
export const repository = {
  async load(role: Role, account: string): Promise<Data> {
    if (demoMode) {
      const d = read();
      if (role === "teacher") return d;
      const own = (sid: string) =>
        d.students.some((s) => s.id === sid && s.account_id === account);
      return {
        students: d.students.filter((s) => s.account_id === account),
        classes: d.classes.filter((c) => canAccessClass(d, account, c.id)),
        enrollments: d.enrollments.filter((e) => own(e.student_id)),
        class_sessions: d.class_sessions.filter((s) =>
          canAccessClass(d, account, s.class_id),
        ),
        attendance: d.attendance
          .filter((a) => own(a.student_id))
          .map((a) => ({
            ...a,
            session_starts_at: d.class_sessions.find(
              (s) => s.id === a.session_id,
            )?.starts_at,
            class_name: d.classes.find(
              (c) =>
                c.id ===
                d.class_sessions.find((s) => s.id === a.session_id)?.class_id,
            )?.name,
          })),
        fee_dues: d.fee_dues.filter((f) => own(f.student_id)),
        payments: d.payments.filter((p) =>
          d.fee_dues.some((f) => f.id === p.due_id && own(f.student_id)),
        ),
        payment_voids: d.payment_voids.filter((v) =>
          d.payments.some(
            (p) =>
              p.id === v.payment_id &&
              d.fee_dues.some((f) => f.id === p.due_id && own(f.student_id)),
          ),
        ),
        materials: d.materials.filter(
          (m) =>
            canAccessClass(d, account, m.class_id) &&
            m.is_published &&
            new Date(m.published_at) <= new Date(),
        ),
        announcements: d.announcements.filter(
          (a) =>
            canAccessClass(d, account, a.class_id) &&
            new Date(a.published_at) <= new Date() &&
            (!a.expires_at || new Date(a.expires_at) > new Date()),
        ),
        linking_requests: d.linking_requests.filter(
          (r) => r.account_id === account,
        ),
      };
    }
    if (!supabase) throw new Error("Supabase is not configured.");
    const tables: Table[] = [
      "students",
      "classes",
      "enrollments",
      "class_sessions",
      "attendance",
      "fee_dues",
      "payments",
      "payment_voids",
      "materials",
      "announcements",
      "linking_requests",
    ];
    const entries = await Promise.all(
      tables.map(async (t) => {
        const rows: unknown[] = [];
        for (let offset = 0; ; offset += 1000) {
          const request =
            t === "attendance"
              ? supabase!.rpc("get_attendance_history")
              : supabase!.from(t).select("*");
          const { data, error } = await request
            .order("id")
            .range(offset, offset + 999);
          if (error) throw new Error(error.message);
          rows.push(...data);
          if (data.length < 1000) break;
        }
        return [t, rows] as const;
      }),
    );
    return Object.fromEntries(entries) as unknown as Data;
  },
  async write<T extends Table>(
    table: T,
    values: Partial<Row<T>>,
    role: Role,
  ): Promise<void> {
    requireTeacher(role);
    if (
      ["payments", "payment_voids", "fee_dues", "linking_requests"].includes(
        table,
      )
    )
      throw new Error("Use a secure operation for this record.");
    if (demoMode)
      return locked(() => {
        const d = read();
        const rows = d[table] as Row<T>[];
        const row = { ...values } as Row<T> & { id: string };
        if (table === "students" && "account_id" in values)
          throw new Error("Use verified account linking.");
        if (
          table === "students" &&
          d.students.some(
            (s) =>
              s.student_number ===
                (values as Partial<Row<"students">>).student_number &&
              s.id !== row.id,
          )
        )
          throw new Error("Student number already exists.");
        if (table === "enrollments") {
          const e = values as Row<"enrollments">;
          if (
            d.enrollments.some(
              (x) =>
                x.student_id === e.student_id &&
                x.class_id === e.class_id &&
                x.id !== row.id,
            )
          )
            throw new Error("Student already enrolled in this class.");
        }
        if (table === "attendance") {
          const a = values as Row<"attendance">;
          const existing = d.attendance.find(
            (x) =>
              x.student_id === a.student_id && x.session_id === a.session_id,
          );
          if (existing) row.id = existing.id;
        }
        const i = rows.findIndex((x) => x.id === row.id);
        if (i >= 0) rows[i] = { ...rows[i], ...row };
        else
          rows.push({
            ...(table === "students" ? { account_id: null } : {}),
            ...row,
            id: uid(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Row<T>);
        save(d);
      });
    const isUpdate = !!values.id;
    const { id, ...payload } = values;
    const request = isUpdate
      ? supabase!.from(table).update(payload).eq("id", id!)
      : table === "attendance"
        ? supabase!
            .from(table)
            .upsert(payload, { onConflict: "student_id,session_id" })
        : supabase!.from(table).insert(payload);
    const { error } = await request;
    if (error) throw new Error(error.message);
  },
  async operation(
    name: string,
    args: Record<string, unknown>,
    role: Role,
    account: string,
  ): Promise<void> {
    if (!demoMode) {
      const { error } = await supabase!.rpc(name, args);
      if (error) throw new Error(error.message);
      return;
    }
    return locked(() => {
      const d = read();
      const stamp = new Date().toISOString();
      if (name === "request_link") {
        const s = d.students.find(
          (s) => s.id === args.p_student_id && s.account_id === null,
        );
        if (!s) throw new Error("Record unavailable");
        d.linking_requests.push({
          id: uid(),
          student_id: s.id,
          account_id: account,
          status: "pending",
          created_at: stamp,
        });
      } else if (name === "record_payment") {
        const due = d.fee_dues.find((x) => x.id === args.p_due_id);
        if (!due) throw new Error("Due not found");
        if (role === "student") assertOwn(d, account, due.student_id);
        const amount = Number(args.p_amount);
        if (amount <= 0 || amount > balance(d, due))
          throw new Error(
            "Payment must be positive and cannot exceed balance.",
          );
        if (role === "student" && !args.p_slip_path)
          throw new Error("Payment slip required");
        d.payments.push({
          id: uid(),
          due_id: due.id,
          amount,
          method: args.p_method as "cash" | "bank",
          status: role === "teacher" ? "approved" : "pending",
          slip_path: args.p_slip_path as string | null,
          note: String(args.p_note || ""),
          review_note: "",
          reviewed_by: role === "teacher" ? account : null,
          reviewed_at: role === "teacher" ? stamp : null,
          created_at: stamp,
        });
      } else {
        requireTeacher(role);
        if (name === "generate_dues")
          d.fee_dues.push(
            ...generateDues(d, Number(args.p_year), Number(args.p_month), uid),
          );
        if (name === "review_payment") {
          const p = args.p_approve
            ? checkApproval(d, String(args.p_payment_id))
            : d.payments.find(
                (p) => p.id === args.p_payment_id && p.status === "pending",
              );
          if (!p) throw new Error("Payment already reviewed");
          if (!args.p_approve && !String(args.p_note || "").trim())
            throw new Error("Rejection reason required");
          p.status = args.p_approve ? "approved" : "rejected";
          p.review_note = String(args.p_note || "");
          p.reviewed_by = account;
          p.reviewed_at = stamp;
        }
        if (name === "adjust_due") {
          const due = d.fee_dues.find((x) => x.id === args.p_due_id);
          if (!due) throw new Error("Due not found");
          const amount = Number(args.p_amount);
          if (
            amount < Number(due.amount) - balance(d, due) ||
            !String(args.p_note).trim()
          )
            throw new Error(
              "Amount is below approved payments or reason is missing",
            );
          due.amount = amount;
          due.adjustment_note = String(args.p_note);
        }
        if (name === "void_payment") {
          const p = d.payments.find(
            (x) => x.id === args.p_payment_id && x.status === "approved",
          );
          if (
            !p ||
            d.payment_voids.some((v) => v.payment_id === p.id) ||
            !String(args.p_reason).trim()
          )
            throw new Error("Cannot void this payment");
          d.payment_voids.push({
            id: uid(),
            payment_id: p.id,
            reason: String(args.p_reason),
            created_at: stamp,
          });
        }
        if (name === "review_link") {
          const r = d.linking_requests.find(
            (r) => r.id === args.p_request_id && r.status === "pending",
          );
          if (!r) throw new Error("Request unavailable");
          if (args.p_approve) {
            const s = d.students.find(
              (s) => s.id === r.student_id && s.account_id === null,
            );
            if (!s) throw new Error("Already linked");
            if (d.students.some((x) => x.account_id === r.account_id))
              throw new Error("Account already linked");
            s.account_id = r.account_id;
          }
          r.status = args.p_approve ? "approved" : "rejected";
        }
      }
      save(d);
    });
  },
  async upload(
    bucket: "materials" | "payment-slips",
    file: File,
    account: string,
  ): Promise<string> {
    const allowed =
      bucket === "materials"
        ? ["application/pdf"]
        : ["application/pdf", "image/jpeg", "image/png"];
    const max = bucket === "materials" ? 20 : 5;
    if (!allowed.includes(file.type) || file.size > max * 1024 * 1024)
      throw new Error(
        `Choose ${bucket === "materials" ? "a PDF" : "a PDF, JPG or PNG"} under ${max} MB.`,
      );
    const path = `${account}/${uid()}.${file.name.split(".").pop()?.toLowerCase()}`;
    if (demoMode) {
      if (file.size > 2 * 1024 * 1024)
        throw new Error(
          "Demo local file limit is 2 MB. Real storage supports the documented limits.",
        );
      const value = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("File could not be read"));
        r.readAsDataURL(file);
      });
      localStorage.setItem(`demo-file:${path}`, value);
      return path;
    }
    const { error } = await supabase!.storage
      .from(bucket)
      .upload(path, file, { upsert: false });
    if (error) throw new Error(error.message);
    return path;
  },
  async signedUrl(
    bucket: "materials" | "payment-slips",
    path: string,
  ): Promise<string> {
    if (demoMode) {
      const v = localStorage.getItem(`demo-file:${path}`);
      if (!v) throw new Error("This fictional item has no uploaded file.");
      return v;
    }
    const { data, error } = await supabase!.storage
      .from(bucket)
      .createSignedUrl(path, 60);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  },
  reset() {
    localStorage.removeItem(key);
    Object.keys(localStorage)
      .filter((k) => k.startsWith("demo-file:"))
      .forEach((k) => localStorage.removeItem(k));
  },
};
