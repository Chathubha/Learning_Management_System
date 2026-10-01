import { useState } from "react";
import { Plus, BookOpen, Users, Pencil } from "lucide-react";
import { useData } from "../../hooks/data";
import { useAuth } from "../../hooks/auth";
import {
  Badge,
  Empty,
  FilterBar,
  FormDialog,
  PageTitle,
  Panel,
  type Field,
} from "../../components/ui";
import { money, localDate } from "../../lib/format";
import type { Class, Enrollment } from "../../types";
const options = (s: string[]) => s.map((value) => ({ value, label: value }));
const fields: Field[] = [
  { name: "name", label: "Class name", required: true },
  {
    name: "exam_year",
    label: "O/L exam year",
    type: "number",
    required: true,
    min: 2000,
    max: 2100,
  },
  {
    name: "type",
    label: "Class type",
    type: "select",
    required: true,
    options: options(["Theory", "Revision", "Paper"]),
  },
  {
    name: "delivery_mode",
    label: "Delivery mode",
    type: "select",
    required: true,
    options: options(["physical", "online", "hybrid"]),
  },
  {
    name: "monthly_fee",
    label: "Monthly fee (LKR)",
    type: "number",
    required: true,
    min: 0,
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    required: true,
    options: options(["active", "archived"]),
  },
  { name: "description", label: "Description", type: "textarea" },
];
export function Classes() {
  const { data: d, write } = useData();
  const { profile } = useAuth();
  const teacher = profile!.role === "teacher";
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [edit, setEdit] = useState<Class | "new" | null>(null);
  const [selected, setSelected] = useState<Class | null>(null);
  const [enroll, setEnroll] = useState<Enrollment | "new" | null>(null);
  if (!d) return null;
  const rows = d.classes.filter(
    (c) =>
      (type === "all" || c.type === type) &&
      `${c.name} ${c.exam_year}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title={teacher ? "Classes & enrollments" : "My classes"}
        description="Theory, revision and paper practice, organized by exam year."
        action={
          teacher && (
            <button onClick={() => setEdit("new")}>
              <Plus size={18} /> Create class
            </button>
          )
        }
      />
      <FilterBar search={search} onSearch={setSearch}>
        <select
          aria-label="Class type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">All class types</option>
          {options(["Theory", "Revision", "Paper"]).map((o) => (
            <option key={o.value}>{o.value}</option>
          ))}
        </select>
      </FilterBar>
      <div className="class-grid">
        {rows.map((c) => (
          <article className="class-card" key={c.id}>
            <div className="class-card-top">
              <span className="class-icon">
                <BookOpen />
              </span>
              <Badge>{c.status}</Badge>
            </div>
            <span className="eyebrow">
              O/L {c.exam_year} · {c.type}
            </span>
            <h2>{c.name}</h2>
            <p>{c.description}</p>
            <div className="class-meta">
              <span>
                <Users size={16} />
                {teacher
                  ? d.enrollments.filter(
                      (e) => e.class_id === c.id && e.status === "active",
                    ).length
                  : "Your"}{" "}
                {teacher ? "students" : "enrollment"}
              </span>
              <Badge>{c.delivery_mode}</Badge>
            </div>
            <footer>
              <strong>
                {money(Number(c.monthly_fee))}
                <small> / month</small>
              </strong>
              <button className="secondary" onClick={() => setSelected(c)}>
                View class
              </button>
              {teacher && (
                <button
                  className="icon-button"
                  aria-label={`Edit ${c.name}`}
                  onClick={() => setEdit(c)}
                >
                  <Pencil size={17} />
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
      {!rows.length && (
        <Empty title="No classes yet">
          {teacher
            ? "Create a class, then enroll students."
            : "Your teacher will enroll you into your classes."}
        </Empty>
      )}
      {selected && (
        <Panel
          title={selected.name}
          action={
            <div className="row-actions">
              {teacher && (
                <button onClick={() => setEnroll("new")}>
                  <Plus size={17} /> Enroll student
                </button>
              )}
              <button className="secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          }
        >
          <h3>{teacher ? "Enrolled students" : "Your enrollment"}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  {teacher && <th>Manage</th>}
                </tr>
              </thead>
              <tbody>
                {d.enrollments
                  .filter((e) => e.class_id === selected.id)
                  .map((e) => (
                    <tr key={e.id}>
                      <td>
                        {
                          d.students.find((s) => s.id === e.student_id)
                            ?.full_name
                        }
                      </td>
                      <td>{e.start_date}</td>
                      <td>{e.end_date || "Ongoing"}</td>
                      <td>
                        <Badge>{e.status}</Badge>
                      </td>
                      {teacher && (
                        <td>
                          <button
                            className="secondary"
                            onClick={() => setEnroll(e)}
                          >
                            Edit enrollment
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <h3 className="mt-5">Class materials</h3>
          {d.materials
            .filter((m) => m.class_id === selected.id)
            .map((m) => (
              <p className="list-line" key={m.id}>
                {m.title} <Badge>{m.type}</Badge>
              </p>
            ))}
        </Panel>
      )}
      {edit && (
        <FormDialog
          title={edit === "new" ? "Create class" : "Edit class"}
          fields={fields}
          initial={
            edit === "new"
              ? {
                  exam_year: new Date().getFullYear() + 1,
                  type: "Theory",
                  delivery_mode: "physical",
                  monthly_fee: 3500,
                  status: "active",
                }
              : { ...edit }
          }
          onClose={() => setEdit(null)}
          validate={(v) =>
            Number.isInteger(v.exam_year)
              ? undefined
              : "Exam year must be an integer."
          }
          onSave={(v) =>
            write("classes", {
              ...v,
              ...(edit !== "new" ? { id: edit.id } : {}),
            } as Partial<Class>)
          }
        />
      )}{" "}
      {enroll && selected && (
        <FormDialog
          title={enroll === "new" ? "Enroll student" : "Edit enrollment"}
          fields={[
            {
              name: "student_id",
              label: "Student",
              required: true,
              type: "select",
              options: d.students
                .filter(
                  (s) =>
                    s.status === "active" ||
                    (enroll !== "new" && s.id === enroll.student_id),
                )
                .map((s) => ({
                  value: s.id,
                  label: `${s.student_number} · ${s.full_name}`,
                })),
            },
            {
              name: "start_date",
              label: "Start date",
              type: "date",
              required: true,
            },
            { name: "end_date", label: "End date (optional)", type: "date" },
            {
              name: "status",
              label: "Status",
              type: "select",
              required: true,
              options: options(["active", "ended"]),
            },
          ]}
          initial={
            enroll === "new"
              ? { start_date: localDate(), status: "active" }
              : {
                  student_id: enroll.student_id,
                  start_date: enroll.start_date,
                  end_date: enroll.end_date || "",
                  status: enroll.status,
                }
          }
          onClose={() => setEnroll(null)}
          validate={(v) =>
            v.end_date && v.end_date < v.start_date
              ? "End date must follow start date."
              : v.status === "ended" && !v.end_date
                ? "An ended enrollment needs an end date."
                : undefined
          }
          onSave={(v) =>
            write("enrollments", {
              ...v,
              class_id: selected.id,
              end_date: v.end_date || null,
              ...(enroll !== "new" ? { id: enroll.id } : {}),
            } as Partial<Enrollment>)
          }
        />
      )}
    </>
  );
}
