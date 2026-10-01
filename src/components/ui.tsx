import { Component, useState, type ReactNode, type ErrorInfo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Search, Inbox } from "lucide-react";
export function Empty({
  title = "Nothing here yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={28} />
      <h3>{title}</h3>
      <p>{children || "New records will appear here when they are added."}</p>
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className={`badge badge-${String(children).toLowerCase()}`}>
      {children}
    </span>
  );
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function FilterBar({
  search,
  onSearch,
  children,
}: {
  search: string;
  onSearch: (s: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="filters">
      <div className="search">
        <Search size={18} />
        <input
          aria-label="Search records"
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      {children}
    </div>
  );
}
export function Pagination({
  total,
  page,
  onPage,
}: {
  total: number;
  page: number;
  onPage: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 10));
  return (
    <div className="pagination">
      <span>
        {total} records • Page {Math.min(page, pages)} of {pages}
      </span>
      <button
        className="secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <button
        className="secondary"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
export interface Field {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "number"
    | "date"
    | "datetime-local"
    | "textarea"
    | "select"
    | "file"
    | "password";
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  accept?: string;
  hint?: string;
}
export type FormValues = Record<string, string | number | FileList>;
export function FormDialog({
  title,
  fields,
  initial = {},
  onClose,
  onSave,
  validate,
}: {
  title: string;
  fields: Field[];
  initial?: Record<string, string | number>;
  onClose: () => void;
  onSave: (v: FormValues) => Promise<boolean>;
  validate?: (v: FormValues) => string | undefined;
}) {
  const shape: Record<string, z.ZodTypeAny> = {};
  fields.forEach((f) => {
    if (f.type === "file") {
      shape[f.name] = z
        .custom<FileList>()
        .refine((v) => !f.required || v?.length > 0, "Choose a file");
    } else if (f.type === "number") {
      shape[f.name] = z.coerce
        .number()
        .min(f.min ?? 0)
        .max(f.max ?? 10000000)
        .refine((v) => Number.isFinite(v), "Enter a valid number");
    } else {
      let schema = z.string();
      if (f.required) schema = schema.trim().min(1, "This field is required");
      if (f.type === "email")
        shape[f.name] = schema.refine(
          (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
          "Enter a valid email",
        );
      else shape[f.name] = schema;
    }
  });
  const defaults = Object.fromEntries(
    fields
      .filter((f) => f.type !== "file" && initial[f.name] !== undefined)
      .map((f) => [f.name, initial[f.name]]),
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(z.object(shape)),
    defaultValues: defaults,
  });
  const [error, setError] = useState("");
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !isSubmitting) onClose();
          if (e.key === "Tab") {
            const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input,select,textarea",
            );
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button
            aria-label="Close dialog"
            className="icon-button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X />
          </button>
        </header>
        <form
          onSubmit={handleSubmit(async (v) => {
            setError("");
            const invalid = validate?.(v);
            if (invalid) {
              setError(invalid);
              return;
            }
            try {
              if (await onSave(v)) onClose();
              else
                setError("Unable to save. See the error message on the page.");
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          })}
        >
          <div className="form-grid">
            {fields.map((f, i) => (
              <label
                key={f.name}
                className={f.type === "textarea" ? "span-two" : ""}
              >
                {f.label}
                {f.required && <span className="required"> *</span>}
                {f.type === "select" ? (
                  <select autoFocus={i === 0} {...register(f.name)}>
                    <option value="">Select…</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea rows={3} {...register(f.name)} />
                ) : (
                  <input
                    autoFocus={i === 0}
                    type={f.type || "text"}
                    step={f.type === "number" ? "0.01" : undefined}
                    min={f.min}
                    max={f.max}
                    accept={f.accept}
                    {...register(f.name)}
                  />
                )}{" "}
                {f.hint && <small>{f.hint}</small>}
                {errors[f.name] && (
                  <small className="field-error">
                    {String(errors[f.name]?.message)}
                  </small>
                )}
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="alert error">
              {error}
            </p>
          )}
          <footer>
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>Something went wrong</h1>
        <p>Reload the application to recover.</p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
