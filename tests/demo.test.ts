import { beforeEach, describe, expect, it, vi } from "vitest";
import { repository } from "../src/api/repository";
class LocalStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
beforeEach(() => {
  vi.stubGlobal("localStorage", new LocalStorage());
  vi.stubGlobal("navigator", {
    locks: { request: async (_key: string, fn: () => unknown) => fn() },
  });
});
describe("persistent demo workflows", () => {
  it("creates physical students, enrolls multiple classes and prevents duplicates", async () => {
    await repository.write(
      "students",
      {
        student_number: "MA-004",
        full_name: "Demo student",
        phone: "0770000000",
        guardian_name: "Guardian",
        guardian_phone: "0710000000",
        email: "",
        school: "Test school",
        status: "active",
      },
      "teacher",
    );
    let d = await repository.load("teacher", "demo-teacher");
    const s = d.students.find((s) => s.student_number === "MA-004")!;
    expect(s.full_name).toBe("Demo student");
    await repository.write(
      "enrollments",
      {
        student_id: s.id,
        class_id: "c1",
        start_date: "2026-01-01",
        end_date: null,
        status: "active",
      },
      "teacher",
    );
    await repository.write(
      "enrollments",
      {
        student_id: s.id,
        class_id: "c2",
        start_date: "2026-01-01",
        end_date: null,
        status: "active",
      },
      "teacher",
    );
    await expect(
      repository.write(
        "enrollments",
        {
          student_id: s.id,
          class_id: "c1",
          start_date: "2026-01-01",
          end_date: null,
          status: "active",
        },
        "teacher",
      ),
    ).rejects.toThrow("already enrolled");
    d = await repository.load("teacher", "demo-teacher");
    expect(d.enrollments.filter((e) => e.student_id === s.id)).toHaveLength(2);
  });
  it("updates attendance without duplicates and retains unmarked sessions", async () => {
    const mark = {
      session_id: "ss1",
      enrollment_id: "e1",
      student_id: "s1",
      status: "present" as const,
    };
    await repository.write("attendance", mark, "teacher");
    await repository.write(
      "attendance",
      { ...mark, status: "late" },
      "teacher",
    );
    const d = await repository.load("student", "demo-student");
    expect(d.attendance.filter((a) => a.session_id === "ss1")).toHaveLength(1);
    expect(d.attendance.find((a) => a.session_id === "ss1")?.status).toBe(
      "late",
    );
    expect(d.attendance.some((a) => a.session_id === "ss2")).toBe(false);
    await expect(
      repository.write("attendance", mark, "student"),
    ).rejects.toThrow("Only teachers");
  });
  it("persists student submission, teacher review and explicit reversal", async () => {
    await repository.operation(
      "record_payment",
      {
        p_due_id: "d1",
        p_amount: 500,
        p_method: "bank",
        p_slip_path: "demo-student/test.pdf",
        p_note: "Test transfer",
      },
      "student",
      "demo-student",
    );
    const before = await repository.load("teacher", "demo-teacher");
    const p = before.payments.find((p) => p.note === "Test transfer")!;
    expect(p.status).toBe("pending");
    await expect(
      repository.operation(
        "review_payment",
        { p_payment_id: p.id, p_approve: true },
        "student",
        "demo-student",
      ),
    ).rejects.toThrow("Only teachers");
    await repository.operation(
      "review_payment",
      { p_payment_id: p.id, p_approve: true, p_note: "Verified" },
      "teacher",
      "demo-teacher",
    );
    await repository.operation(
      "void_payment",
      { p_payment_id: p.id, p_reason: "Duplicate cash receipt" },
      "teacher",
      "demo-teacher",
    );
    const d = await repository.load("student", "demo-student");
    expect(d.payments.find((x) => x.id === p.id)?.status).toBe("approved");
    expect(d.payment_voids.some((v) => v.payment_id === p.id)).toBe(true);
    expect(d.students).toHaveLength(1);
    expect(d.classes.some((c) => c.id === "c3")).toBe(false);
  });
});
