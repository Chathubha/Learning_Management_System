import { createClient } from "@supabase/supabase-js";
export const demoMode =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  (import.meta.env.VITE_DEMO_MODE === undefined &&
    !import.meta.env.VITE_SUPABASE_URL &&
    !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
function validProjectUrl(value: string | undefined) {
  try {
    const parsed = new URL(value || "");
    return parsed.protocol === "https:" && !!parsed.hostname;
  } catch {
    return false;
  }
}
export const configError =
  !demoMode && (!validProjectUrl(url) || !key?.trim())
    ? "Set a valid Supabase URL and publishable key, or explicitly enable demo mode."
    : null;
export const supabase =
  !demoMode && !configError ? createClient(url!, key!) : null;
