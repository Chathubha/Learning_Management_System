import { describe, expect, it } from "vitest";
import { seed } from "../src/demo/seed";
import {
  balance,
  canAccessClass,
  checkApproval,
  generateDues,
  requireTeacher,
} from "../src/lib/rules";
describe("business rules", () => {
  it("restricts teacher operations and enrolled class access", () => {
    expect(() => requireTeacher("student")).toThrow();
    expect(() => requireTeacher("teacher")).not.toThrow();
    expect(canAccessClass(seed, "demo-student", "c1")).toBe(true);
    expect(canAccessClass(seed, "demo-student", "c3")).toBe(false);
    expect(canAccessClass(seed, "unlinked", "c1")).toBe(false);
  });
  it("uses approved payments only and supports partial payments", () => {
    expect(balance(seed, seed.fee_dues[0])).toBe(2000);
    expect(balance(seed, seed.fee_dues[1])).toBe(2500);
    const d = structuredClone(seed);
    d.payments[1].status = "rejected";
    expect(balance(d, d.fee_dues[1])).toBe(2500);
    d.payment_voids.push({
      id: "v",
      payment_id: "p1",
      reason: "Correction",
      created_at: new Date().toISOString(),
    });
    expect(balance(d, d.fee_dues[0])).toBe(3500);
  });
  it("generates monthly dues idempotently and snapshots fees", () => {
    const d = structuredClone(seed);
    const y = new Date().getFullYear();
    let i = 0;
    const rows = generateDues(d, y, 12, () => String(++i));
    d.fee_dues.push(...rows);
    expect(generateDues(d, y, 12, () => String(++i))).toEqual([]);
    d.classes[0].monthly_fee = 9999;
    expect(rows.find((f) => f.enrollment_id === "e1")?.amount).toBe(3500);
  });
  it("respects enrollment overlap including ended enrollments", () => {
    const d = structuredClone(seed);
    d.fee_dues = [];
    d.enrollments = [
      {
        ...d.enrollments[0],
        start_date: "2025-02-10",
        end_date: "2025-03-15",
        status: "ended",
      },
    ];
    expect(generateDues(d, 2025, 1, () => "x")).toHaveLength(0);
    expect(generateDues(d, 2025, 2, () => "x")).toHaveLength(1);
    expect(generateDues(d, 2025, 3, () => "x")).toHaveLength(1);
    expect(generateDues(d, 2025, 4, () => "x")).toHaveLength(0);
  });
  it("rejects duplicate reviews and overpayments", () => {
    expect(() => checkApproval(seed, "p1")).toThrow("already");
    const d = structuredClone(seed);
    d.payments[1].amount = 2501;
    expect(() => checkApproval(d, "p2")).toThrow("exceeds");
    expect(checkApproval(seed, "p2").id).toBe("p2");
  });
});
