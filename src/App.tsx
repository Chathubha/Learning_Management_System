import { useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Wallet,
  FolderOpen,
  Megaphone,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "./hooks/auth";
import { DataProvider, useData } from "./hooks/data";
import { demoMode } from "./api/client";
import { Login } from "./features/auth/Login";
import { Dashboard } from "./features/dashboard/Dashboard";
import { Students } from "./features/students/Students";
import { Classes } from "./features/classes/Classes";
import { Sessions } from "./features/sessions/Sessions";
import { Attendance } from "./features/attendance/Attendance";
import { Fees } from "./features/fees/Fees";
import { Materials } from "./features/materials/Materials";
import { Announcements } from "./features/announcements/Announcements";
import { Account } from "./features/account/Account";
function Protected() {
  const { profile, loading, error } = useAuth();
  if (loading)
    return (
      <div className="fatal" role="status">
        Loading your account…
      </div>
    );
  if (!profile)
    return <Navigate to="/login" state={{ expired: !!error }} replace />;
  return (
    <DataProvider>
      <Layout />
    </DataProvider>
  );
}
function Teacher() {
  return useAuth().profile?.role === "teacher" ? (
    <Outlet />
  ) : (
    <Navigate to="/" replace />
  );
}
function Layout() {
  const { profile, switchRole, logout } = useAuth();
  const { loading, data, error, notice, clear, reload } = useData();
  const [open, setOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const links = [
    { to: "/", label: "Overview", icon: LayoutDashboard },
    ...(profile!.role === "teacher"
      ? [{ to: "/students", label: "Students", icon: Users }]
      : []),
    {
      to: "/classes",
      label: profile!.role === "teacher" ? "Classes" : "My classes",
      icon: BookOpen,
    },
    { to: "/sessions", label: "Timetable", icon: CalendarDays },
    { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
    { to: "/fees", label: "Fees & payments", icon: Wallet },
    { to: "/materials", label: "Materials", icon: FolderOpen },
    { to: "/announcements", label: "Announcements", icon: Megaphone },
    {
      to: "/account",
      label: profile!.role === "teacher" ? "Account linking" : "My account",
      icon: ShieldCheck,
    },
  ];
  return (
    <div className="app-shell">
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <GraduationCap size={26} />
          </div>
          <div>
            <strong>{import.meta.env.VITE_APP_NAME || "Maths Academy"}</strong>
            <small>Learning together</small>
          </div>
          <button
            className="mobile-close icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          {profile!.role === "teacher"
            ? "TEACHER WORKSPACE"
            : "STUDENT WORKSPACE"}
        </div>
        <nav aria-label="Main navigation">
          {links.map((l) => (
            <NavLink
              to={l.to}
              end={l.to === "/"}
              key={l.to}
              onClick={() => setOpen(false)}
            >
              <l.icon size={19} />
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <BookOpen size={22} />
            <p>
              Learning adds up.
              <br />
              <small>One lesson at a time.</small>
            </p>
          </div>
          <button
            className="logout"
            onClick={async () => {
              try {
                await logout();
              } catch (e) {
                setAuthError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <div className="topbar-title">
            O/L Mathematics{" "}
            <span>
              {" "}
              /{" "}
              {profile!.role === "teacher"
                ? "Teacher portal"
                : "Student portal"}
            </span>
          </div>
          <div className="profile-chip">
            <span className="avatar">
              {profile!.full_name.charAt(0) || "M"}
            </span>
            <div>
              <strong>{profile!.full_name || "Academy member"}</strong>
              <small>{profile!.role}</small>
            </div>
            <ChevronDown size={15} />
          </div>
        </header>
        {demoMode && (
          <div className="demo-banner">
            <span>
              <strong>DEMO MODE</strong> Fictional data · changes saved on this
              device
            </span>
            <label>
              View as{" "}
              <select
                aria-label="Demo role"
                value={profile!.role}
                onChange={(e) =>
                  switchRole(e.target.value as "teacher" | "student")
                }
              >
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
            </label>
          </div>
        )}
        <main className="content">
          {(error || authError) && (
            <div className="alert error" role="alert">
              {error || authError}
              <button
                className="text-button"
                onClick={() => {
                  clear();
                  setAuthError("");
                  void reload();
                }}
              >
                Retry
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={clear}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading && !data ? (
            <div className="loading" role="status">
              Loading academy data…
            </div>
          ) : data ? (
            <Outlet />
          ) : (
            <div className="fatal">
              <h2>Unable to load your academy</h2>
              <p>
                Check your connection and Supabase configuration. Your session
                may have expired.
              </p>
              <button onClick={() => void reload()}>Try again</button>
            </div>
          )}
        </main>
        <footer className="app-footer">
          {import.meta.env.VITE_APP_NAME || "Maths Academy"} · All times in
          Asia/Colombo · LKR
        </footer>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<Login />} />
      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route element={<Teacher />}>
          <Route path="students" element={<Students />} />
        </Route>
        <Route path="classes" element={<Classes />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="fees" element={<Fees />} />
        <Route path="materials" element={<Materials />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
