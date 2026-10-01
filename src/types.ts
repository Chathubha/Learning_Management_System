export type Role = "teacher" | "student";
export type Status = "active" | "archived";
export interface Profile {
  id: string;
  role: Role;
  full_name: string;
}
export interface Student {
  id: string;
  student_number: string;
  full_name: string;
  phone: string;
  guardian_name: string;
  guardian_phone: string;
  email: string;
  school: string;
  status: Status;
  account_id: string | null;
  created_at: string;
}
export interface Class {
  id: string;
  name: string;
  exam_year: number;
  type: "Theory" | "Revision" | "Paper";
  delivery_mode: "physical" | "online" | "hybrid";
  monthly_fee: number;
  description: string;
  status: Status;
}
export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "ended";
}
export interface ClassSession {
  id: string;
  class_id: string;
  starts_at: string;
  ends_at: string;
  delivery_mode: Class["delivery_mode"];
  location: string;
  meeting_url: string;
  status: "scheduled" | "completed" | "cancelled";
}
export interface Attendance {
  id: string;
  session_id: string;
  enrollment_id: string;
  student_id: string;
  status: "present" | "absent" | "late" | "excused";
  updated_at: string;
  session_starts_at?: string;
  class_name?: string;
}
export interface FeeDue {
  id: string;
  enrollment_id: string;
  student_id: string;
  class_id: string;
  year: number;
  month: number;
  base_amount: number;
  amount: number;
  adjustment_note: string;
}
export interface Payment {
  id: string;
  due_id: string;
  amount: number;
  method: "cash" | "bank";
  status: "pending" | "approved" | "rejected";
  slip_path: string | null;
  note: string;
  review_note: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
export interface PaymentVoid {
  id: string;
  payment_id: string;
  reason: string;
  created_at: string;
}
export interface Material {
  id: string;
  class_id: string;
  title: string;
  topic: string;
  type: "notes" | "paper" | "answers" | "recording" | "link";
  description: string;
  file_path: string | null;
  external_url: string;
  published_at: string;
  is_published: boolean;
}
export interface Announcement {
  id: string;
  class_id: string;
  title: string;
  message: string;
  published_at: string;
  expires_at: string | null;
}
export interface LinkingRequest {
  id: string;
  student_id: string;
  account_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}
export interface Data {
  students: Student[];
  classes: Class[];
  enrollments: Enrollment[];
  class_sessions: ClassSession[];
  attendance: Attendance[];
  fee_dues: FeeDue[];
  payments: Payment[];
  payment_voids: PaymentVoid[];
  materials: Material[];
  announcements: Announcement[];
  linking_requests: LinkingRequest[];
}
export type Table = keyof Data;
export type Row<T extends Table> = Data[T][number];
