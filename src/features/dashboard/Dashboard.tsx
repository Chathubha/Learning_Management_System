import {
  Users,
  BookOpen,
  CalendarDays,
  Wallet,
  ArrowUpRight,
  Clock,
  CircleCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/auth";
import { useData } from "../../hooks/data";
import { balance } from "../../lib/rules";
import { dateTime, localDate, money, safeUrl } from "../../lib/format";
import { Badge, Empty, PageTitle, Panel } from "../../components/ui";
export function Dashboard() {
  const { profile } = useAuth();
  const { data: d } = useData();
  if (!d) return null;
  const teacher = profile!.role === "teacher";
  const now = new Date();
  const upcoming = d.class_sessions
    .filter((s) => s.status === "scheduled" && new Date(s.ends_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const outstanding = d.fee_dues.reduce((n, f) => n + balance(d, f), 0);
  const month = localDate().slice(0, 7);
  const approved = d.payments
    .filter(
      (p) =>
        p.status === "approved" &&
        p.reviewed_at &&
        localDate(p.reviewed_at).slice(0, 7) === month &&
        !d.payment_voids.some((v) => v.payment_id === p.id),
    )
    .reduce((n, p) => n + Number(p.amount), 0);
  const metrics = teacher
    ? [
        {
          label: "Active students",
          value: d.students.filter((s) => s.status === "active").length,
          icon: Users,
          to: "/students",
        },
        {
          label: "Active classes",
          value: d.classes.filter((c) => c.status === "active").length,
          icon: BookOpen,
          to: "/classes",
        },
        {
          label: "Today’s sessions",
          value: d.class_sessions.filter(
            (s) =>
              localDate(s.starts_at) === localDate() &&
              s.status !== "cancelled",
          ).length,
          icon: CalendarDays,
          to: "/sessions",
        },
        {
          label: "Approved this month",
          value: money(approved),
          icon: CircleCheck,
          to: "/fees",
        },
        {
          label: "Outstanding fees",
          value: money(outstanding),
          icon: Wallet,
          to: "/fees",
        },
        {
          label: "Pending submissions",
          value: d.payments.filter((p) => p.status === "pending").length,
          icon: Clock,
          to: "/fees",
        },
      ]
    : [
        {
          label: "Enrolled classes",
          value: d.classes.length,
          icon: BookOpen,
          to: "/classes",
        },
        {
          label: "Upcoming sessions",
          value: upcoming.length,
          icon: CalendarDays,
          to: "/sessions",
        },
        {
          label: "Outstanding balance",
          value: money(outstanding),
          icon: Wallet,
          to: "/fees",
        },
        {
          label: "Approved this month",
          value: money(approved),
          icon: CircleCheck,
          to: "/fees",
        },
      ];
  return (
    <>
      <PageTitle
        title={`Hello, ${profile!.full_name.split(" ")[0] || "there"} 👋`}
        description={
          teacher
            ? "Here’s what’s happening at your academy."
            : "Keep learning, one step at a time."
        }
        action={
          <span className="date-chip">
            {new Intl.DateTimeFormat("en-GB", {
              timeZone: "Asia/Colombo",
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(now)}
          </span>
        }
      />
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">
            {teacher ? "YOUR CLASSROOM, CONNECTED" : "YOUR NEXT CHAPTER"}
          </span>
          <h2>
            {teacher
              ? "More time for teaching."
              : "Small steps. Strong foundations."}
          </h2>
          <p>
            {teacher
              ? "Manage your physical and online classes in one place."
              : "Your classes, resources and progress are right here."}
          </p>
        </div>
        <div className="banner-symbol">
          π<span>×</span>
        </div>
      </div>
      <div className="stats-grid">
        {metrics.map((m) => (
          <Link className="stat" key={m.label} to={m.to}>
            <div className="stat-top">
              <span className="stat-icon">
                <m.icon size={20} />
              </span>
              <ArrowUpRight size={16} />
            </div>
            <strong>{m.value}</strong>
            <span>{m.label}</span>
          </Link>
        ))}
      </div>
      {!teacher && !d.students.length && (
        <div className="alert">
          Your account is ready. Ask your teacher to link your student record
          and enroll you. <Link to="/account">Request linking →</Link>
        </div>
      )}
      <div className="dashboard-columns">
        <Panel
          title="Upcoming sessions"
          action={<Link to="/sessions">View timetable →</Link>}
        >
          {upcoming.length ? (
            upcoming.slice(0, 4).map((s) => (
              <div className="session-row" key={s.id}>
                <div className="calendar-tile">
                  <span>
                    {new Intl.DateTimeFormat("en-GB", {
                      timeZone: "Asia/Colombo",
                      month: "short",
                    }).format(new Date(s.starts_at))}
                  </span>
                  <strong>
                    {new Intl.DateTimeFormat("en-GB", {
                      timeZone: "Asia/Colombo",
                      day: "2-digit",
                    }).format(new Date(s.starts_at))}
                  </strong>
                </div>
                <div className="grow">
                  <h3>{d.classes.find((c) => c.id === s.class_id)?.name}</h3>
                  <p>{dateTime(s.starts_at)}</p>
                  <small>{s.location || "Online classroom"}</small>
                </div>
                <div>
                  <Badge>{s.delivery_mode}</Badge>
                  {safeUrl(s.meeting_url) && (
                    <a
                      className="join-link"
                      href={safeUrl(s.meeting_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Join class ↗
                    </a>
                  )}
                </div>
              </div>
            ))
          ) : (
            <Empty title="No upcoming sessions">
              {teacher
                ? "Schedule a session to start your timetable."
                : "Your next session will appear here."}
            </Empty>
          )}
        </Panel>
        <Panel title={teacher ? "Recent activity" : "Class announcements"}>
          {teacher ? (
            <>
              {[...d.payments]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice(0, 5)
                .map((p) => (
                  <div className="activity" key={p.id}>
                    <span className="activity-dot" />
                    <div>
                      <h3>
                        {money(Number(p.amount))} payment {p.status}
                      </h3>
                      <p>
                        {
                          d.students.find(
                            (s) =>
                              s.id ===
                              d.fee_dues.find((f) => f.id === p.due_id)
                                ?.student_id,
                          )?.full_name
                        }
                      </p>
                      <small>{dateTime(p.created_at)}</small>
                    </div>
                  </div>
                ))}
              {!d.payments.length && (
                <Empty title="A fresh start">
                  Payments and class activity will appear as your academy grows.
                </Empty>
              )}
            </>
          ) : (
            <>
              {d.announcements.slice(0, 4).map((a) => (
                <div className="announcement" key={a.id}>
                  <Badge>
                    {d.classes.find((c) => c.id === a.class_id)?.type}
                  </Badge>
                  <h3>{a.title}</h3>
                  <p>{a.message}</p>
                  <small>{dateTime(a.published_at)}</small>
                </div>
              ))}
              {!d.announcements.length && <Empty title="You’re up to date" />}
            </>
          )}
        </Panel>
      </div>
      <Panel
        title={teacher ? "Teaching resources" : "Recent learning materials"}
        action={<Link to="/materials">All materials →</Link>}
      >
        <div className="resource-grid">
          {d.materials
            .filter((m) => m.is_published)
            .slice(0, 3)
            .map((m) => (
              <Link to="/materials" className="resource-card" key={m.id}>
                <BookOpen />
                <Badge>{m.type}</Badge>
                <h3>{m.title}</h3>
                <p>{m.topic}</p>
              </Link>
            ))}
        </div>
        {!d.materials.length && (
          <Empty title="Your resource library starts here" />
        )}
      </Panel>
    </>
  );
}
