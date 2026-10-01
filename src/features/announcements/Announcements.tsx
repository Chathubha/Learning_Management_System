import { useState } from "react";
import { Plus, Megaphone } from "lucide-react";
import { useData } from "../../hooks/data";
import { useAuth } from "../../hooks/auth";
import {
  Badge,
  Empty,
  FormDialog,
  PageTitle,
  type Field,
} from "../../components/ui";
import { dateTime, toLocalInput, toUTC } from "../../lib/format";
import type { Announcement } from "../../types";
export function Announcements() {
  const { data: d, write } = useData();
  const { profile } = useAuth();
  const teacher = profile!.role === "teacher";
  const [edit, setEdit] = useState<Announcement | "new" | null>(null);
  if (!d) return null;
  const fields: Field[] = [
    {
      name: "class_id",
      label: "Class",
      type: "select",
      required: true,
      options: d.classes.map((c) => ({ value: c.id, label: c.name })),
    },
    { name: "title", label: "Title", required: true },
    { name: "message", label: "Message", type: "textarea", required: true },
    {
      name: "published_at",
      label: "Publication (Asia/Colombo)",
      type: "datetime-local",
      required: true,
    },
    { name: "expires_at", label: "Expiry (optional)", type: "datetime-local" },
  ];
  return (
    <>
      <PageTitle
        title="Announcements"
        description="Keep your classes informed and connected."
        action={
          teacher && (
            <button onClick={() => setEdit("new")}>
              <Plus size={18} /> New announcement
            </button>
          )
        }
      />
      <div className="announcement-grid">
        {[...d.announcements]
          .sort((a, b) => b.published_at.localeCompare(a.published_at))
          .map((a) => (
            <article className="panel announcement-card" key={a.id}>
              <div className="row-actions">
                <Megaphone size={20} />
                <Badge>
                  {d.classes.find((c) => c.id === a.class_id)?.name}
                </Badge>
              </div>
              <h2>{a.title}</h2>
              <p className="whitespace-pre-wrap">{a.message}</p>
              <small>
                Published {dateTime(a.published_at)}
                {a.expires_at && ` · Expires ${dateTime(a.expires_at)}`}
              </small>
              {teacher && (
                <button className="secondary" onClick={() => setEdit(a)}>
                  Edit
                </button>
              )}
            </article>
          ))}
      </div>
      {!d.announcements.length && <Empty title="No announcements yet" />}
      {edit && (
        <FormDialog
          title={edit === "new" ? "Publish announcement" : "Edit announcement"}
          fields={fields}
          initial={
            edit === "new"
              ? { published_at: toLocalInput(new Date().toISOString()) }
              : {
                  ...edit,
                  published_at: toLocalInput(edit.published_at),
                  expires_at: edit.expires_at
                    ? toLocalInput(edit.expires_at)
                    : "",
                }
          }
          onClose={() => setEdit(null)}
          validate={(v) =>
            v.expires_at && v.expires_at <= v.published_at
              ? "Expiry must follow publication."
              : undefined
          }
          onSave={(v) =>
            write("announcements", {
              ...v,
              published_at: toUTC(String(v.published_at)),
              expires_at: v.expires_at ? toUTC(String(v.expires_at)) : null,
              ...(edit !== "new" ? { id: edit.id } : {}),
            } as Partial<Announcement>)
          }
        />
      )}
    </>
  );
}
