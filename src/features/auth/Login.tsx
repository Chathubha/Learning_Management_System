import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation } from "react-router-dom";
import { GraduationCap, ArrowRight } from "lucide-react";
import { useAuth } from "../../hooks/auth";
import { supabase, demoMode, configError } from "../../api/client";
const schema = z.object({
  full_name: z.string(),
  email: z.string().email("Enter a valid email address"),
  password: z.string(),
});
type Values = z.infer<typeof schema>;
export function Login() {
  const auth = useAuth();
  const location = useLocation();
  const recovery = location.pathname === "/reset-password";
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(
      recovery ? schema.extend({ email: z.string() }) : schema,
    ),
    defaultValues: { full_name: "", email: "", password: "" },
  });
  if (auth.profile && !recovery) return <Navigate to="/" replace />;
  return (
    <main className="login-page">
      <section className="login-story">
        <GraduationCap size={48} />
        <p className="eyebrow">A space to learn. A place to grow.</p>
        <h1>
          Confidence in maths.
          <br />
          Progress for every student.
        </h1>
        <p>Theory, revision and paper practice — connected in one classroom.</p>
        <div className="story-foot">O/L Mathematics · Sri Lanka</div>
      </section>
      <section className="login-form">
        <div className="brand">
          <GraduationCap />
          <strong>{import.meta.env.VITE_APP_NAME || "Maths Academy"}</strong>
        </div>
        <h1>
          {recovery
            ? "Choose a new password"
            : mode === "signup"
              ? "Create your student account"
              : mode === "reset"
                ? "Reset your password"
                : "Welcome back"}
        </h1>
        <p>
          {mode === "signup"
            ? "Your teacher will link your student record and enroll you."
            : "Your learning community, all in one place."}
        </p>
        {configError && <div className="alert error">{configError}</div>}
        {auth.error && <div className="alert error">{auth.error}</div>}
        {demoMode ? (
          <>
            <div className="alert">
              Demo mode · Fictional data, saved on this device.
            </div>
            <button onClick={() => auth.switchRole("teacher")}>
              Enter teacher demo <ArrowRight size={18} />
            </button>
            <button
              className="secondary"
              onClick={() => auth.switchRole("student")}
            >
              Enter student demo
            </button>
          </>
        ) : (
          <form
            onSubmit={handleSubmit(async (v) => {
              setError("");
              setMessage("");
              try {
                if (!supabase)
                  throw new Error(configError || "Supabase unavailable");
                if ((mode !== "reset" || recovery) && v.password.length < 8)
                  throw new Error(
                    "Use at least 8 characters for your password.",
                  );
                if (recovery) {
                  const { error } = await supabase.auth.updateUser({
                    password: v.password,
                  });
                  if (error) throw error;
                  setMessage(
                    "Password updated. You can return to the dashboard.",
                  );
                } else if (mode === "signup") {
                  if (!v.full_name.trim())
                    throw new Error("Enter your full name");
                  const { error } = await supabase.auth.signUp({
                    email: v.email,
                    password: v.password,
                    options: {
                      data: { full_name: v.full_name },
                      emailRedirectTo: window.location.origin,
                    },
                  });
                  if (error) throw error;
                  setMessage(
                    "Check your email to verify your account. Your teacher must link and enroll you before content is available.",
                  );
                } else if (mode === "reset") {
                  const { error } = await supabase.auth.resetPasswordForEmail(
                    v.email,
                    { redirectTo: `${window.location.origin}/reset-password` },
                  );
                  if (error) throw error;
                  setMessage(
                    "If the account exists, you will receive a password reset email.",
                  );
                } else {
                  const { error } = await supabase.auth.signInWithPassword({
                    email: v.email,
                    password: v.password,
                  });
                  if (error) throw error;
                  await auth.refresh();
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            })}
          >
            {mode === "signup" && (
              <label>
                Full name
                <input autoComplete="name" {...register("full_name")} />
              </label>
            )}
            {!recovery && (
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  {...register("email")}
                />
                {errors.email && (
                  <small className="field-error">{errors.email.message}</small>
                )}
              </label>
            )}
            {(mode !== "reset" || recovery) && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete={
                    mode === "signup" || recovery
                      ? "new-password"
                      : "current-password"
                  }
                  {...register("password")}
                />
              </label>
            )}
            {error && (
              <div role="alert" className="alert error">
                {error}
              </div>
            )}
            {message && (
              <div role="status" className="alert success">
                {message}
              </div>
            )}
            <button disabled={isSubmitting || !!configError}>
              {isSubmitting
                ? "Please wait…"
                : recovery
                  ? "Update password"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "reset"
                      ? "Send reset email"
                      : "Sign in"}{" "}
              <ArrowRight size={18} />
            </button>
          </form>
        )}
        {!demoMode && !recovery && (
          <div className="auth-actions">
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setMessage("");
                setError("");
              }}
            >
              {mode === "signup"
                ? "Already registered? Sign in"
                : "New student? Create an account"}
            </button>
            <button
              className="text-button"
              onClick={() => setMode(mode === "reset" ? "login" : "reset")}
            >
              {mode === "reset" ? "Back to sign in" : "Forgot password?"}
            </button>
          </div>
        )}
        {recovery && <a href="/">Return to dashboard</a>}
        <small className="timezone">
          All class times are shown in Asia/Colombo.
        </small>
      </section>
    </main>
  );
}
