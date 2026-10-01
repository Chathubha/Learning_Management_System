import { useState } from "react";
import { Plus, Upload, Wallet } from "lucide-react";
import { useData } from "../../hooks/data";
import { useAuth } from "../../hooks/auth";
import { repository } from "../../api/repository";
import {
  Badge,
  Empty,
  FilterBar,
  FormDialog,
  PageTitle,
  Pagination,
  Panel,
  type Field,
  type FormValues,
} from "../../components/ui";
import { balance } from "../../lib/rules";
import { dateTime, localDate, money } from "../../lib/format";
import type { FeeDue, Payment } from "../../types";
type Action =
  | { kind: "payment"; due: FeeDue }
  | { kind: "adjust"; due: FeeDue }
  | { kind: "approve"; payment: Payment }
  | { kind: "reject"; payment: Payment }
  | { kind: "void"; payment: Payment }
  | { kind: "generate" };
export function Fees() {
  const { data: d, operation } = useData();
  const { profile } = useAuth();
  const teacher = profile!.role === "teacher";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("outstanding");
  const [month, setMonth] = useState("all");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<Action | null>(null);
  const [fileError, setFileError] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  if (!d) return null;
  const studentName = (due: FeeDue) =>
    d.students.find((s) => s.id === due.student_id)?.full_name || "Student";
  const className = (due: FeeDue) =>
    d.classes.find((c) => c.id === due.class_id)?.name || "Previous class";
  const dueMonth = (due: FeeDue) =>
    `${due.year}-${String(due.month).padStart(2, "0")}`;
  const rows = d.fee_dues.filter(
    (f) =>
      (filter === "all" || balance(d, f) > 0) &&
      (month === "all" || dueMonth(f) === month) &&
      `${studentName(f)} ${className(f)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const total = d.fee_dues.reduce((n, f) => n + balance(d, f), 0);
  const payments = d.payments
    .filter((p) => paymentFilter === "all" || p.status === paymentFilter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  let fields: Field[] = [];
  let initial: Record<string, string | number> = {};
  if (action?.kind === "generate") {
    fields = [
      {
        name: "month",
        label: "Fee month",
        required: true,
        type: "text",
        hint: "YYYY-MM, for example 2026-10. Full monthly fees apply to any enrollment overlapping this month.",
      },
    ];
    initial = { month: localDate().slice(0, 7) };
  }
  if (action?.kind === "payment") {
    fields = [
      {
        name: "amount",
        label: "Payment amount (LKR)",
        type: "number",
        min: 0.01,
        max: balance(d, action.due),
        required: true,
      },
      {
        name: "method",
        label: "Method",
        type: "select",
        required: true,
        options: teacher
          ? [
              { value: "cash", label: "Cash" },
              { value: "bank", label: "Bank transfer" },
            ]
          : [{ value: "bank", label: "Bank transfer" }],
      },
      { name: "note", label: "Reference / note", type: "textarea" },
      ...(!teacher
        ? [
            {
              name: "slip",
              label: "Payment slip",
              type: "file" as const,
              required: true,
              accept: ".pdf,.jpg,.jpeg,.png",
              hint: "PDF, JPG or PNG · up to 5 MB (2 MB in demo).",
            },
          ]
        : []),
    ];
    initial = {
      amount: balance(d, action.due),
      method: teacher ? "cash" : "bank",
    };
  }
  if (action?.kind === "adjust") {
    fields = [
      {
        name: "amount",
        label: "Override charged amount (LKR)",
        type: "number",
        required: true,
        min: 0,
      },
      {
        name: "note",
        label: "Discount / adjustment reason",
        required: true,
        type: "textarea",
      },
    ];
    initial = { amount: action.due.amount, note: action.due.adjustment_note };
  }
  if (action && ["approve", "reject", "void"].includes(action.kind)) {
    fields = [
      {
        name: "note",
        label:
          action.kind === "approve"
            ? "Review note (optional)"
            : action.kind === "reject"
              ? "Rejection reason"
              : "Void reason — original payment will be preserved",
        type: "textarea",
        required: action.kind !== "approve",
      },
    ];
  }
  async function submit(v: FormValues) {
    if (!action) return false;
    if (action.kind === "generate") {
      const m = String(v.month).match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
      if (!m) throw new Error("Enter a month in YYYY-MM format.");
      return operation("generate_dues", {
        p_year: Number(m[1]),
        p_month: Number(m[2]),
      });
    }
    if (action.kind === "payment") {
      let path: null | string = null;
      if (!teacher)
        path = await repository.upload(
          "payment-slips",
          (v.slip as FileList)[0],
          profile!.id,
        );
      return operation("record_payment", {
        p_due_id: action.due.id,
        p_amount: Number(v.amount),
        p_method: v.method,
        p_note: v.note || "",
        p_slip_path: path,
      });
    }
    if (action.kind === "adjust")
      return operation("adjust_due", {
        p_due_id: action.due.id,
        p_amount: Number(v.amount),
        p_note: v.note,
      });
    if (action.kind === "void")
      return operation("void_payment", {
        p_payment_id: action.payment.id,
        p_reason: v.note,
      });
    return operation("review_payment", {
      p_payment_id: action.payment.id,
      p_approve: action.kind === "approve",
      p_note: v.note || "",
    });
  }
  return (
    <>
      <PageTitle
        title={teacher ? "Fees & payments" : "My fees & payments"}
        description="Clear balances. Every payment accounted for in LKR."
        action={
          teacher && (
            <button onClick={() => setAction({ kind: "generate" })}>
              <Plus size={18} /> Generate monthly dues
            </button>
          )
        }
      />
      <div className="fee-summary">
        <Wallet />
        <div>
          <small>Total outstanding balance</small>
          <strong>{money(total)}</strong>
        </div>
        <p>
          Only approved, non-voided payments reduce balances.
          <br />
          Pending submissions remain outstanding.
        </p>
      </div>
      {fileError && (
        <div role="alert" className="alert error">
          {fileError}
        </div>
      )}
      <Panel title="Monthly fee dues">
        <FilterBar
          search={search}
          onSearch={(s) => {
            setSearch(s);
            setPage(1);
          }}
        >
          <select
            aria-label="Balance filter"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="outstanding">Outstanding</option>
            <option value="all">All dues</option>
          </select>
          <select
            aria-label="Fee month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All months</option>
            {[...new Set(d.fee_dues.map(dueMonth))]
              .sort()
              .reverse()
              .map((m) => (
                <option key={m}>{m}</option>
              ))}
          </select>
        </FilterBar>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {teacher && <th>Student</th>}
                <th>Class / month</th>
                <th>Charged</th>
                <th>Approved paid</th>
                <th>Outstanding</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 10, page * 10).map((f) => (
                <tr key={f.id}>
                  {teacher && (
                    <td>
                      <strong>{studentName(f)}</strong>
                    </td>
                  )}
                  <td>
                    {className(f)}
                    <small>
                      {dueMonth(f)}
                      {f.adjustment_note && ` · ${f.adjustment_note}`}
                    </small>
                  </td>
                  <td>
                    {money(Number(f.amount))}
                    <small>Original: {money(Number(f.base_amount))}</small>
                  </td>
                  <td>{money(Number(f.amount) - balance(d, f))}</td>
                  <td>
                    <strong className={balance(d, f) > 0 ? "balance" : "paid"}>
                      {money(balance(d, f))}
                    </strong>
                  </td>
                  <td>
                    <div className="row-actions">
                      {balance(d, f) > 0 && (
                        <button
                          className="secondary"
                          onClick={() => setAction({ kind: "payment", due: f })}
                        >
                          {teacher ? <Plus size={15} /> : <Upload size={15} />}{" "}
                          {teacher ? "Record" : "Upload slip"}
                        </button>
                      )}
                      {teacher && (
                        <button
                          className="text-button"
                          onClick={() => setAction({ kind: "adjust", due: f })}
                        >
                          Adjust
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty title="No dues to show">
            {teacher
              ? "Generate dues for a month, or change the balance filter."
              : "Your teacher will generate your monthly fees."}
          </Empty>
        )}
        <Pagination total={rows.length} page={page} onPage={setPage} />
      </Panel>
      <Panel
        title={teacher ? "Payment submissions & history" : "My payment history"}
        action={
          <select
            aria-label="Payment review status"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        }
      >
        {payments.map((p) => {
          const f = d.fee_dues.find((f) => f.id === p.due_id);
          const voided = d.payment_voids.find((v) => v.payment_id === p.id);
          return (
            <article className="payment-row" key={p.id}>
              <div className="grow">
                <h3>
                  {money(Number(p.amount))}{" "}
                  <Badge>{voided ? "voided" : p.status}</Badge>
                </h3>
                <p>
                  {f &&
                    `${teacher ? `${studentName(f)} · ` : ""}${className(f)} · ${dueMonth(f)}`}{" "}
                  · {p.method}
                </p>
                <small>
                  Submitted {dateTime(p.created_at)}
                  {p.reviewed_at && ` · Reviewed ${dateTime(p.reviewed_at)}`}
                </small>
                {p.note && <p>{p.note}</p>}
                {p.review_note && <p>Review: {p.review_note}</p>}
                {voided && <p>Void: {voided.reason}</p>}
              </div>
              <div className="row-actions">
                {p.slip_path && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      setFileError("");
                      try {
                        const url = await repository.signedUrl(
                          "payment-slips",
                          p.slip_path!,
                        );
                        const link = document.createElement("a");
                        link.href = url;
                        link.target = "_blank";
                        link.rel = "noopener";
                        if (url.startsWith("data:"))
                          link.download = "payment-slip";
                        link.click();
                      } catch (e) {
                        setFileError(
                          e instanceof Error ? e.message : String(e),
                        );
                      }
                    }}
                  >
                    View slip
                  </button>
                )}
                {teacher && p.status === "pending" && (
                  <>
                    <button
                      onClick={() => setAction({ kind: "approve", payment: p })}
                    >
                      Approve
                    </button>
                    <button
                      className="danger secondary"
                      onClick={() => setAction({ kind: "reject", payment: p })}
                    >
                      Reject
                    </button>
                  </>
                )}
                {teacher && p.status === "approved" && !voided && (
                  <button
                    className="text-button danger"
                    onClick={() => setAction({ kind: "void", payment: p })}
                  >
                    Void
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {!payments.length && <Empty title="No payments yet" />}
      </Panel>
      {action && (
        <FormDialog
          title={
            action.kind === "generate"
              ? "Generate monthly dues"
              : action.kind === "payment"
                ? teacher
                  ? "Record approved payment"
                  : "Submit payment for review"
                : action.kind === "adjust"
                  ? "Adjust fee due"
                  : action.kind === "approve"
                    ? "Approve payment"
                    : action.kind === "reject"
                      ? "Reject payment"
                      : "Void approved payment"
          }
          fields={fields}
          initial={initial}
          onClose={() => setAction(null)}
          onSave={submit}
        />
      )}
    </>
  );
}
