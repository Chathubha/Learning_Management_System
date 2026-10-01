import { localDate } from "./format";
import type { Data, FeeDue, Role } from "../types";
export function balance(data: Data, due: FeeDue) {
  const paid = data.payments
    .filter(
      (p) =>
        p.due_id === due.id &&
        p.status === "approved" &&
        !data.payment_voids.some((v) => v.payment_id === p.id),
    )
    .reduce((n, p) => n + Math.round(Number(p.amount) * 100), 0);
  return (Math.round(Number(due.amount) * 100) - paid) / 100;
}
export function requireTeacher(role: Role) {
  if (role !== "teacher")
    throw new Error("Only teachers can perform this action.");
}
export function canAccessClass(data: Data, accountId: string, classId: string) {
  return data.enrollments.some(
    (e) =>
      e.class_id === classId &&
      e.status === "active" &&
      e.start_date <= localDate() &&
      (!e.end_date || e.end_date >= localDate()) &&
      data.students.some(
        (s) =>
          s.id === e.student_id &&
          s.account_id === accountId &&
          s.status === "active",
      ),
  );
}
export function generateDues(
  data: Data,
  year: number,
  month: number,
  id: () => string,
): FeeDue[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return data.enrollments
    .filter(
      (e) =>
        e.start_date <= last &&
        (!e.end_date || e.end_date >= first) &&
        !data.fee_dues.some(
          (d) =>
            d.enrollment_id === e.id && d.year === year && d.month === month,
        ),
    )
    .map((e) => ({
      id: id(),
      enrollment_id: e.id,
      student_id: e.student_id,
      class_id: e.class_id,
      year,
      month,
      base_amount: Number(
        data.classes.find((c) => c.id === e.class_id)?.monthly_fee ?? 0,
      ),
      amount: Number(
        data.classes.find((c) => c.id === e.class_id)?.monthly_fee ?? 0,
      ),
      adjustment_note: "",
    }));
}
export function checkApproval(data: Data, paymentId: string) {
  const p = data.payments.find((p) => p.id === paymentId);
  if (!p || p.status !== "pending")
    throw new Error("This payment has already been reviewed.");
  const due = data.fee_dues.find((d) => d.id === p.due_id);
  if (!due || Number(p.amount) > balance(data, due))
    throw new Error("Payment exceeds the outstanding balance.");
  return p;
}
