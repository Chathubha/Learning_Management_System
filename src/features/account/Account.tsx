import { useState } from "react";
import { useData } from "../../hooks/data";
import { useAuth } from "../../hooks/auth";
import { demoMode } from "../../api/client";
import { repository } from "../../api/repository";
import {
  Badge,
  Empty,
  FormDialog,
  PageTitle,
  Panel,
} from "../../components/ui";
import { dateTime } from "../../lib/format";
export function Account() {
  const { profile } = useAuth();
  const { data: d, operation, reload } = useData();
  const [request, setRequest] = useState(false);
  const [review, setReview] = useState<{ id: string; approve: boolean } | null>(
    null,
  );
  if (!d) return null;
  const teacher = profile!.role === "teacher";
  return (
    <>
      <PageTitle
        title={teacher ? "Account linking" : "My account"}
        description="Student records and authenticated accounts are separate identities."
      />
      <Panel title="Your account">
        <p>
          <strong>{profile!.full_name}</strong> · <Badge>{profile!.role}</Badge>
        </p>
        <p>
          Account ID: <code>{profile!.id}</code>
        </p>
        {!teacher && (
          <>
            <p>
              {d.students.length
                ? "Your student record is linked."
                : "Ask your teacher for your student record ID, then submit a linking request."}
            </p>
            {!d.students.length && (
              <button onClick={() => setRequest(true)}>
                Request account linking
              </button>
            )}
          </>
        )}
      </Panel>
      <Panel title={teacher ? "Linking requests" : "Your linking requests"}>
        {teacher && (
          <p className="alert">
            Before approval, verify the student or guardian’s identity through a
            trusted channel and confirm this is their account. A request alone
            is not proof of record ownership. Supabase also requires verified
            account email.
          </p>
        )}
        {d.linking_requests.map((r) => (
          <div className="timetable-row" key={r.id}>
            <div className="grow">
              <h3>
                {d.students.find((s) => s.id === r.student_id)?.full_name ||
                  "Student record"}
              </h3>
              <p>
                Record: <code>{r.student_id}</code>
              </p>
              <p>
                Account: <code>{r.account_id}</code>
              </p>
              <small>{dateTime(r.created_at)}</small>
            </div>
            <Badge>{r.status}</Badge>
            {teacher && r.status === "pending" && (
              <div className="row-actions">
                <button onClick={() => setReview({ id: r.id, approve: true })}>
                  Verify & link
                </button>
                <button
                  className="secondary danger"
                  onClick={() => setReview({ id: r.id, approve: false })}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
        {!d.linking_requests.length && <Empty title="No linking requests" />}
      </Panel>
      {demoMode && (
        <Panel title="Demo settings">
          <p>
            Fictional demo changes are saved only in this browser. Demo file
            uploads are limited to 2 MB by local storage.
          </p>
          <button
            className="secondary"
            onClick={() => {
              repository.reset();
              void reload();
            }}
          >
            Reset fictional demo data
          </button>
        </Panel>
      )}
      {request && (
        <FormDialog
          title="Request account linking"
          fields={[
            {
              name: "student_id",
              label: "Student record UUID",
              required: true,
            },
          ]}
          onClose={() => setRequest(false)}
          onSave={(v) =>
            operation("request_link", { p_student_id: v.student_id })
          }
        />
      )}{" "}
      {review && (
        <FormDialog
          title={
            review.approve
              ? "Confirm verified identity"
              : "Reject linking request"
          }
          fields={[
            {
              name: "confirmation",
              label: review.approve
                ? "Type VERIFIED after verifying identity out-of-band"
                : "Type REJECT",
              required: true,
            },
          ]}
          onClose={() => setReview(null)}
          validate={(v) =>
            v.confirmation !== (review.approve ? "VERIFIED" : "REJECT")
              ? "Enter the confirmation text."
              : undefined
          }
          onSave={() =>
            operation("review_link", {
              p_request_id: review.id,
              p_approve: review.approve,
            })
          }
        />
      )}
    </>
  );
}
