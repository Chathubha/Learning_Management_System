export const money = (n: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(
    n,
  );
export const dateTime = (s: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(s));
export const localDate = (s = new Date().toISOString()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(s));
export const toUTC = (s: string) => new Date(`${s}:00+05:30`).toISOString();
export const toLocalInput = (s: string) => {
  const d = new Date(new Date(s).getTime() + 330 * 60000);
  return d.toISOString().slice(0, 16);
};
export const safeUrl = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
};
