import { useState } from "react";
import { Plus, MapPin, Video } from "lucide-react";
import { useData } from "../../hooks/data";
import { useAuth } from "../../hooks/auth";
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
import { dateTime, safeUrl, toLocalInput, toUTC } from "../../lib/format";
import type { ClassSession } from "../../types";
export function Sessions() {
  const { data: d, write } = useData();
  const { profile } = useAuth();
  const teacher = profile!.role === "teacher";
  const [edit, setEdit] = useState<ClassSession | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("upcoming");
  const [page, setPage] = useState(1);
  if (!d) return null;
  const rows = d.class_sessions
    .filter(
      (s) =>
        (status === "all" || status === "upcoming"
          ? status === "all" ||
            (new Date(s.ends_at) > new Date() && s.status === "scheduled")
          : s.status === status) &&
        `${d.classes.find((c) => c.id === s.class_id)?.name} ${s.location}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const opts = (a: string[]) => a.map((value) => ({ value, label: value }));
  const fields: Field[] = [
    {
      name: "class_id",
      label: "Class",
      type: "select",
      required: true,
      options: d.classes.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      name: "delivery_mode",
      label: "Delivery mode",
      type: "select",
      required: true,
      options: opts(["physical", "online", "hybrid"]),
    },
    {
      name: "starts_at",
      label: "Start (Asia/Colombo)",
      type: "datetime-local",
      required: true,
    },
    {
      name: "ends_at",
      label: "End (Asia/Colombo)",
      type: "datetime-local",
      required: true,
    },
    { name: "location", label: "Physical location" },
    { name: "meeting_url", label: "Zoom / Google Meet HTTPS link" },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: opts(["scheduled", "completed", "cancelled"]),
    },
  ];
  return (
    <>
      <PageTitle
        title="Timetable"
        description="Physical and online sessions. All times are Asia/Colombo (UTC+05:30)."
        action={
          teacher && (
            <button onClick={() => setEdit("new")}>
              <Plus size={18} /> Schedule session
            </button>
          )
        }
      />
      <Panel title="Class sessions">
        <FilterBar
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
        >
          <select
            aria-label="Session status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {opts([
              "upcoming",
              "all",
              "scheduled",
              "completed",
              "cancelled",
            ]).map((o) => (
              <option key={o.value}>{o.value}</option>
            ))}
          </select>
        </FilterBar>
        {rows.slice((page - 1) * 10, page * 10).map((s) => (
          <article className="timetable-row" key={s.id}>
            <div className="grow">
              <h3>{d.classes.find((c) => c.id === s.class_id)?.name}</h3>
              <p>
                {dateTime(s.starts_at)} —{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  timeZone: "Asia/Colombo",
                  timeStyle: "short",
                }).format(new Date(s.ends_at))}
              </p>
              <small className="inline-icon">
                {s.delivery_mode === "online" ? (
                  <Video size={15} />
                ) : (
                  <MapPin size={15} />
                )}{" "}
                {s.location || "Online classroom"}
              </small>
            </div>
            <Badge>{s.delivery_mode}</Badge>
            <Badge>{s.status}</Badge>
            {safeUrl(s.meeting_url) && s.status !== "cancelled" && (
              <a
                className="button secondary"
                href={safeUrl(s.meeting_url)}
                target="_blank"
                rel="noreferrer"
              >
                Join class ↗
              </a>
            )}
            {teacher && (
              <button className="secondary" onClick={() => setEdit(s)}>
                Edit
              </button>
            )}
          </article>
        ))}
        {!rows.length && (
          <Empty title="No sessions found">
            {teacher
              ? "Schedule your first lesson to fill this timetable."
              : "Check back when your teacher schedules a lesson."}
          </Empty>
        )}
        <Pagination total={rows.length} page={page} onPage={setPage} />
      </Panel>
      {edit && (
        <FormDialog
          title={edit === "new" ? "Schedule a session" : "Edit session"}
          fields={fields}
          initial={
            edit === "new"
              ? { status: "scheduled", delivery_mode: "physical" }
              : {
                  ...edit,
                  starts_at: toLocalInput(edit.starts_at),
                  ends_at: toLocalInput(edit.ends_at),
                }
          }
          onClose={() => setEdit(null)}
          validate={(v) =>
            v.ends_at <= v.starts_at
              ? "End time must follow start time."
              : v.meeting_url && !safeUrl(String(v.meeting_url))
                ? "Use a valid HTTPS meeting link."
                : v.delivery_mode !== "online" && !v.location
                  ? "A physical location is required."
                  : undefined
          }
          onSave={(v) =>
            write("class_sessions", {
              ...v,
              starts_at: toUTC(String(v.starts_at)),
              ends_at: toUTC(String(v.ends_at)),
              ...(edit !== "new" ? { id: edit.id } : {}),
            } as Partial<ClassSession>)
          }
        />
      )}
    </>
  );
}
