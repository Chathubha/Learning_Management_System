import { useState } from "react";
import {
  Plus,
  FileText,
  PlayCircle,
  ExternalLink,
  Download,
} from "lucide-react";
import { useData } from "../../hooks/data";
import { useAuth } from "../../hooks/auth";
import { repository } from "../../api/repository";
import {
  Badge,
  Empty,
  FilterBar,
  FormDialog,
  PageTitle,
  Pagination,
  type Field,
} from "../../components/ui";
import { dateTime, safeUrl, toLocalInput, toUTC } from "../../lib/format";
import type { Material } from "../../types";
export function Materials() {
  const { data: d, write } = useData();
  const { profile } = useAuth();
  const teacher = profile!.role === "teacher";
  const [edit, setEdit] = useState<Material | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [classId, setClass] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  if (!d) return null;
  const rows = d.materials
    .filter(
      (m) =>
        (classId === "all" || m.class_id === classId) &&
        (type === "all" || m.type === type) &&
        `${m.title} ${m.topic} ${m.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
  const fields: Field[] = [
    {
      name: "class_id",
      label: "Class",
      type: "select",
      required: true,
      options: d.classes.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      name: "type",
      label: "Material type",
      type: "select",
      required: true,
      options: ["notes", "paper", "answers", "recording", "link"].map(
        (value) => ({ value, label: value }),
      ),
    },
    { name: "title", label: "Title", required: true },
    { name: "topic", label: "Lesson / topic", required: true },
    { name: "description", label: "Description", type: "textarea" },
    {
      name: "external_url",
      label: "External HTTPS link",
      hint: "Use external video links for recordings.",
    },
    {
      name: "file",
      label: "PDF file (optional for links)",
      type: "file",
      accept: ".pdf",
      hint: "PDF only · up to 20 MB (2 MB in demo). Existing files remain unless replaced.",
    },
    {
      name: "published_at",
      label: "Publication date (Asia/Colombo)",
      type: "datetime-local",
      required: true,
    },
    {
      name: "publication",
      label: "Visibility",
      type: "select",
      required: true,
      options: [
        { value: "published", label: "Published" },
        { value: "draft", label: "Draft" },
      ],
    },
  ];
  return (
    <>
      <PageTitle
        title="Learning materials"
        description="Notes, papers, answer sheets and lesson recordings."
        action={
          teacher && (
            <button onClick={() => setEdit("new")}>
              <Plus size={18} /> Add material
            </button>
          )
        }
      />
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <FilterBar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
      >
        <select
          aria-label="Material class"
          value={classId}
          onChange={(e) => {
            setClass(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All classes</option>
          {d.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Material type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All materials</option>
          {["notes", "paper", "answers", "recording", "link"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </FilterBar>
      <div className="material-grid">
        {rows.slice((page - 1) * 10, page * 10).map((m) => (
          <article className="material-card" key={m.id}>
            <div className="material-icon">
              {m.type === "recording" ? (
                <PlayCircle />
              ) : m.type === "link" ? (
                <ExternalLink />
              ) : (
                <FileText />
              )}
            </div>
            <div className="row-actions">
              <Badge>{m.type}</Badge>
              {teacher && (
                <Badge>{m.is_published ? "published" : "draft"}</Badge>
              )}
            </div>
            <small>{d.classes.find((c) => c.id === m.class_id)?.name}</small>
            <h2>{m.title}</h2>
            <p>{m.description}</p>
            <small>
              {m.topic} · {dateTime(m.published_at)}
            </small>
            <footer>
              {m.file_path && (
                <button
                  className="secondary"
                  onClick={async () => {
                    setError("");
                    try {
                      const url = await repository.signedUrl(
                        "materials",
                        m.file_path!,
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.target = "_blank";
                      a.rel = "noopener";
                      if (url.startsWith("data:"))
                        a.download = `${m.title}.pdf`;
                      a.click();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  <Download size={16} /> Open PDF
                </button>
              )}
              {safeUrl(m.external_url) && (
                <a
                  className="button secondary"
                  href={safeUrl(m.external_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open link ↗
                </a>
              )}
              {!m.file_path && !m.external_url && (
                <small>Demo placeholder</small>
              )}
              {teacher && (
                <button className="text-button" onClick={() => setEdit(m)}>
                  Edit
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
      {!rows.length && (
        <Empty title="No materials found">
          {teacher
            ? "Upload a PDF or add a lesson link."
            : "Published resources for your classes will appear here."}
        </Empty>
      )}
      <Pagination total={rows.length} page={page} onPage={setPage} />
      {edit && (
        <FormDialog
          title={
            edit === "new" ? "Add learning material" : "Edit learning material"
          }
          fields={fields}
          initial={
            edit === "new"
              ? {
                  type: "notes",
                  publication: "draft",
                  published_at: toLocalInput(new Date().toISOString()),
                }
              : {
                  ...Object.fromEntries(
                    Object.entries(edit).filter(
                      ([, v]) => typeof v === "string",
                    ),
                  ),
                  published_at: toLocalInput(edit.published_at),
                  publication: edit.is_published ? "published" : "draft",
                }
          }
          onClose={() => setEdit(null)}
          validate={(v) =>
            v.external_url && !safeUrl(String(v.external_url))
              ? "Use a valid HTTPS link."
              : ["recording", "link"].includes(String(v.type)) &&
                  !v.external_url
                ? "This material needs an external link."
                : ["notes", "paper", "answers"].includes(String(v.type)) &&
                    !(v.file as FileList)?.length &&
                    !(edit !== "new" && edit.file_path)
                  ? "Upload a PDF for this material."
                  : undefined
          }
          onSave={async (v) => {
            const file = (v.file as FileList)?.[0];
            const path = file
              ? await repository.upload("materials", file, profile!.id)
              : edit !== "new"
                ? edit.file_path
                : null;
            return write("materials", {
              class_id: String(v.class_id),
              title: String(v.title),
              topic: String(v.topic),
              type: v.type as Material["type"],
              description: String(v.description),
              external_url: String(v.external_url),
              file_path: path,
              published_at: toUTC(String(v.published_at)),
              is_published: v.publication === "published",
              ...(edit !== "new" ? { id: edit.id } : {}),
            });
          }}
        />
      )}
    </>
  );
}
