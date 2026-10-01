import { useState } from "react";
import { Plus, Pencil, Archive, UserRound } from "lucide-react";
import { useData } from "../../hooks/data";
import {
  Badge,
  Empty,
  FilterBar,
  FormDialog,
  PageTitle,
  Pagination,
  Panel,
  type Field,
} from "../../components/ui";
import type { Student } from "../../types";
import { money } from "../../lib/format";
import { balance } from "../../lib/rules";
const fields: Field[] = [
  { name: "student_number", label: "Student number", required: true },
  { name: "full_name", label: "Full name", required: true },
  { name: "phone", label: "Student phone", required: true },
  { name: "school", label: "School" },
  { name: "guardian_name", label: "Parent / guardian name", required: true },
  { name: "guardian_phone", label: "Parent / guardian phone", required: true },
  { name: "email", label: "Email (optional)", type: "email" },
  {
    name: "status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { value: "active", label: "Active" },
      { value: "archived", label: "Archived" },
    ],
  },
];
export function Students() {
  const { data: d, write } = useData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Student | "new" | null>(null);
  const [detail, setDetail] = useState<Student | null>(null);
  if (!d) return null;
  const rows = d.students.filter(
    (s) =>
      (status === "all" || s.status === status) &&
      `${s.full_name} ${s.student_number} ${s.school} ${s.phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title="Students"
        description="Every student, every step of their journey."
        action={
          <button onClick={() => setEdit("new")}>
            <Plus size={18} /> Add student
          </button>
        }
      />
      <Panel title="Student directory">
        <FilterBar
          search={search}
          onSearch={(s) => {
            setSearch(s);
            setPage(1);
          }}
        >
          <select
            aria-label="Student status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="active">Active students</option>
            <option value="archived">Archived students</option>
            <option value="all">All students</option>
          </select>
        </FilterBar>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Contact</th>
                <th>School</th>
                <th>Account</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 10, page * 10).map((s) => (
                <tr key={s.id}>
                  <td>
                    <button
                      className="student-name"
                      onClick={() => setDetail(s)}
                    >
                      <span className="avatar">
                        <UserRound size={18} />
                      </span>
                      <span>
                        <strong>{s.full_name}</strong>
                        <small>{s.student_number}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    {s.phone}
                    <small>{s.guardian_name}</small>
                  </td>
                  <td>{s.school || "—"}</td>
                  <td>
                    <Badge>{s.account_id ? "Linked" : "Physical only"}</Badge>
                  </td>
                  <td>
                    <Badge>{s.status}</Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Edit ${s.full_name}`}
                        onClick={() => setEdit(s)}
                      >
                        <Pencil size={17} />
                      </button>
                      {s.status === "active" && (
                        <button
                          className="icon-button"
                          aria-label={`Archive ${s.full_name}`}
                          onClick={() => setEdit({ ...s, status: "archived" })}
                        >
                          <Archive size={17} />
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
          <Empty title="No students found">
            Add your first student or change your search.
          </Empty>
        )}
        <Pagination total={rows.length} page={page} onPage={setPage} />
      </Panel>
      {detail && (
        <div className="detail-card panel">
          <div className="panel-heading">
            <h2>{detail.full_name}</h2>
            <button className="secondary" onClick={() => setDetail(null)}>
              Close
            </button>
          </div>
          <div className="detail-grid">
            <p>
              <strong>Guardian</strong>
              {detail.guardian_name} · {detail.guardian_phone}
            </p>
            <p>
              <strong>Email</strong>
              {detail.email || "Not provided"}
            </p>
            <p>
              <strong>Record ID for account linking</strong>
              <code>{detail.id}</code>
              <small>
                Share privately after verifying the student. Approve the
                resulting request in Account linking.
              </small>
            </p>
            <p>
              <strong>Outstanding fees</strong>
              {money(
                d.fee_dues
                  .filter((f) => f.student_id === detail.id)
                  .reduce((n, f) => n + balance(d, f), 0),
              )}
            </p>
          </div>
          <h3>Enrollments</h3>
          {d.enrollments
            .filter((e) => e.student_id === detail.id)
            .map((e) => (
              <p key={e.id}>
                {d.classes.find((c) => c.id === e.class_id)?.name} · {e.status}{" "}
                · {e.start_date} — {e.end_date || "ongoing"}
              </p>
            ))}
          <h3>Attendance</h3>
          <p>
            {d.attendance.filter((a) => a.student_id === detail.id).length}{" "}
            marked sessions. See Attendance for corrections.
          </p>
        </div>
      )}
      {edit && (
        <FormDialog
          title={edit === "new" ? "Add student" : "Edit student"}
          fields={fields}
          initial={
            edit === "new"
              ? { status: "active" }
              : Object.fromEntries(
                  Object.entries(edit).filter(([, v]) => typeof v === "string"),
                )
          }
          onClose={() => setEdit(null)}
          onSave={(v) =>
            write("students", {
              ...v,
              ...(edit !== "new" ? { id: edit.id } : {}),
            } as Partial<Student>)
          }
        />
      )}
    </>
  );
}
