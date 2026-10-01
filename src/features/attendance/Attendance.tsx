import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { useData } from "../../hooks/data";
import { useAuth } from "../../hooks/auth";
import { Badge, Empty, PageTitle, Panel } from "../../components/ui";
import { dateTime, localDate } from "../../lib/format";
import type { Attendance as AttendanceRecord } from "../../types";
export function Attendance() {
  const { data: d, write, busy } = useData();
  const { profile } = useAuth();
  const teacher = profile!.role === "teacher";
  const [sessionId, setSession] = useState("");
  if (!d) return null;
  const session = d.class_sessions.find((s) => s.id === sessionId);
  const sessionDate = session ? localDate(session.starts_at) : "";
  const enrolled = d.enrollments.filter(
    (e) =>
      e.class_id === session?.class_id &&
      e.start_date <= sessionDate &&
      (!e.end_date || e.end_date >= sessionDate),
  );
  const mark = (
    enrollment: (typeof enrolled)[number],
    status: AttendanceRecord["status"],
  ) =>
    write("attendance", {
      session_id: sessionId,
      enrollment_id: enrollment.id,
      student_id: enrollment.student_id,
      ...{ class_id: enrollment.class_id },
      status,
    });
  return (
    <>
      <PageTitle
        title={teacher ? "Attendance" : "My attendance"}
        description="Attendance is recorded manually for physical and online classes. Unmarked stays unmarked."
      />
      {teacher ? (
        <Panel title="Mark a session">
          <label className="session-select">
            Session
            <select
              value={sessionId}
              onChange={(e) => setSession(e.target.value)}
            >
              <option value="">Choose a session…</option>
              {[...d.class_sessions]
                .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {d.classes.find((c) => c.id === s.class_id)?.name} ·{" "}
                    {dateTime(s.starts_at)} · {s.status}
                  </option>
                ))}
            </select>
          </label>
          {session && (
            <>
              <div className="attendance-toolbar">
                <p>
                  {enrolled.length} enrolled students · changes save immediately
                </p>
                <button
                  disabled={
                    busy || !enrolled.length || session.status === "cancelled"
                  }
                  onClick={async () => {
                    for (const e of enrolled) {
                      if (!(await mark(e, "present"))) break;
                    }
                  }}
                >
                  <CheckCheck size={18} /> Mark all present
                </button>
              </div>
              {enrolled.map((e) => {
                const s = d.students.find((s) => s.id === e.student_id);
                const a = d.attendance.find(
                  (a) =>
                    a.student_id === e.student_id && a.session_id === sessionId,
                );
                return (
                  <div className="attendance-row" key={e.id}>
                    <div>
                      <h3>{s?.full_name}</h3>
                      <small>{s?.student_number}</small>
                      <Badge>{a?.status || "unmarked"}</Badge>
                    </div>
                    <div className="attendance-options">
                      {(["present", "absent", "late", "excused"] as const).map(
                        (status) => (
                          <button
                            aria-pressed={a?.status === status}
                            className={a?.status === status ? "" : "secondary"}
                            key={status}
                            disabled={busy || session.status === "cancelled"}
                            onClick={() => void mark(e, status)}
                          >
                            {status}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
              {!enrolled.length && (
                <Empty title="No students enrolled on this date" />
              )}
            </>
          )}
          {!session && (
            <Empty title="Choose a lesson to begin">
              Mark all present, then adjust individual students as needed.
            </Empty>
          )}
        </Panel>
      ) : (
        <Panel title="Attendance history">
          {d.enrollments
            .flatMap((e) =>
              d.class_sessions
                .filter(
                  (s) =>
                    s.class_id === e.class_id &&
                    s.status !== "cancelled" &&
                    new Date(s.starts_at) <= new Date() &&
                    localDate(s.starts_at) >= e.start_date &&
                    (!e.end_date || localDate(s.starts_at) <= e.end_date),
                )
                .map((s) => ({ s, e })),
            )
            .sort((a, b) => b.s.starts_at.localeCompare(a.s.starts_at))
            .map(({ s, e }) => (
              <div className="timetable-row" key={`${s.id}-${e.id}`}>
                <div className="grow">
                  <h3>
                    {d.classes.find((c) => c.id === s.class_id)?.name ||
                      "Previous class"}
                  </h3>
                  <p>{dateTime(s.starts_at)}</p>
                </div>
                <Badge>
                  {d.attendance.find(
                    (a) => a.session_id === s.id && a.enrollment_id === e.id,
                  )?.status || "unmarked"}
                </Badge>
              </div>
            ))}
          {d.attendance
            .filter((a) => !d.class_sessions.some((s) => s.id === a.session_id))
            .sort((a, b) =>
              (b.session_starts_at || b.updated_at).localeCompare(
                a.session_starts_at || a.updated_at,
              ),
            )
            .map((a) => (
              <div className="timetable-row" key={a.id}>
                <div className="grow">
                  <h3>{a.class_name || "Previous class"}</h3>
                  <p>{dateTime(a.session_starts_at || a.updated_at)}</p>
                </div>
                <Badge>{a.status}</Badge>
              </div>
            ))}
          {!d.class_sessions.length && !d.attendance.length && (
            <Empty title="No attendance history yet" />
          )}
        </Panel>
      )}
    </>
  );
}
