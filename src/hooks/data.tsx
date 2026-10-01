import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Data, Row, Table } from "../types";
import { repository } from "../api/repository";
import { useAuth } from "./auth";
interface Store {
  data: Data | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  reload: () => Promise<void>;
  write: <T extends Table>(
    table: T,
    values: Partial<Row<T>>,
  ) => Promise<boolean>;
  operation: (name: string, args: Record<string, unknown>) => Promise<boolean>;
  clear: () => void;
}
const Context = createContext<Store | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      setData(await repository.load(profile.role, profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [profile]);
  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);
  async function mutate(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await reload();
      setNotice("Saved successfully");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        data,
        loading,
        busy,
        error,
        notice,
        reload,
        clear() {
          setError(null);
          setNotice(null);
        },
        write: (table, values) =>
          mutate(() => repository.write(table, values, profile!.role)),
        operation: (name, args) =>
          mutate(() =>
            repository.operation(name, args, profile!.role, profile!.id),
          ),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useData() {
  const d = useContext(Context);
  if (!d) throw new Error("Data provider missing");
  return d;
}
