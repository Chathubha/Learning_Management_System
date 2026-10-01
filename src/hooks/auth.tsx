import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Profile, Role } from "../types";
import { demoMode, supabase } from "../api/client";
interface Auth {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  switchRole: (role: Role) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(
    demoMode
      ? {
          id:
            localStorage.getItem("demo-role") === "student"
              ? "demo-student"
              : "demo-teacher",
          role:
            localStorage.getItem("demo-role") === "student"
              ? "student"
              : "teacher",
          full_name:
            localStorage.getItem("demo-role") === "student"
              ? "Nethmi Perera"
              : "Mr. Senanayake",
        }
      : null,
  );
  const [loading, setLoading] = useState(!demoMode && !!supabase);
  const [error, setError] = useState<string | null>(null);
  async function refresh() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        setProfile(null);
        return;
      }
      const result = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.session.user.id)
        .single();
      if (result.error) throw new Error(result.error.message);
      setProfile(result.data as Profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your account");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!supabase) return;
    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refresh(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <Context.Provider
      value={{
        profile,
        loading,
        error,
        refresh,
        switchRole(role) {
          if (!demoMode)
            throw new Error("Role switching is only available in demo mode.");
          localStorage.setItem("demo-role", role);
          setProfile({
            id: `demo-${role}`,
            role,
            full_name: role === "teacher" ? "Mr. Senanayake" : "Nethmi Perera",
          });
        },
        async logout() {
          if (demoMode) {
            setProfile(null);
            return;
          }
          const { error } = await supabase!.auth.signOut();
          if (error) throw error;
          setProfile(null);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const c = useContext(Context);
  if (!c) throw new Error("Auth provider missing");
  return c;
}
