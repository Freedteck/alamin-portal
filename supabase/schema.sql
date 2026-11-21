-- Al-Amin Group of Schools Management System
-- Complete Supabase PostgreSQL Schema, RLS Policies, Storage & Subject Catalog
-- Run in the Supabase SQL Editor for setup; re-run after schema, RLS, or storage-policy changes.
-- Note: Demo/mock school records are intentionally excluded; only core subjects are seeded.
--       Teachers and students cannot self-register; accounts are provisioned exclusively by Admin.

-- ============================================================
-- 1. PORTAL USERS & PROFILES (ADMIN-PROVISIONED AUTH ACCOUNTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student')),
  student_id TEXT NOT NULL DEFAULT '',
  teacher_id TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.institution_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  institution_name TEXT NOT NULL DEFAULT 'Al-Amin Group of Schools',
  established_year TEXT NOT NULL DEFAULT '2010',
  official_email TEXT NOT NULL DEFAULT 'info@alaminschools.edu.ng',
  phone TEXT NOT NULL DEFAULT '+234 803 456 7890',
  address TEXT NOT NULL DEFAULT 'Al-Amin Campus, 14 Ahmadu Bello Way, Nassarawa GRA',
  website TEXT NOT NULL DEFAULT 'www.alaminschools.edu.ng',
  registration_number TEXT NOT NULL DEFAULT 'ASS-2010-008920',
  timezone TEXT NOT NULL DEFAULT 'wat',
  date_format TEXT NOT NULL DEFAULT 'dd-mm-yyyy',
  academic_term TEXT NOT NULL DEFAULT 'first-term',
  current_session TEXT NOT NULL DEFAULT '2026/2027',
  current_term TEXT NOT NULL DEFAULT 'Term 1',
  language TEXT NOT NULL DEFAULT 'en',
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  sms_alerts BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. CORE ACADEMIC & DIRECTORY TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.classes (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL DEFAULT 'Junior',
  class_teacher_id TEXT NOT NULL DEFAULT '',
  class_teacher_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  all_classes BOOLEAN NOT NULL DEFAULT TRUE,
  classes JSONB NOT NULL DEFAULT '[]'::jsonb,
  all_departments BOOLEAN NOT NULL DEFAULT TRUE,
  departments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.classes (id, name, category)
VALUES
  ('cls-1', 'JSS 1', 'Junior'),
  ('cls-2', 'JSS 2', 'Junior'),
  ('cls-3', 'JSS 3', 'Junior'),
  ('cls-4', 'SSS 1', 'Senior'),
  ('cls-5', 'SSS 2', 'Senior'),
  ('cls-6', 'SSS 3', 'Senior')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  admission_number TEXT NOT NULL DEFAULT '',
  class TEXT NOT NULL DEFAULT 'JSS 1',
  department TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT 'Male',
  dob TEXT NOT NULL DEFAULT '',
  state_of_origin TEXT NOT NULL DEFAULT '',
  lga TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  parent_name TEXT NOT NULL DEFAULT '',
  parent_phone TEXT NOT NULL DEFAULT '',
  parent_email TEXT NOT NULL DEFAULT '',
  parent_occupation TEXT NOT NULL DEFAULT '',
  parent_relationship TEXT NOT NULL DEFAULT '',
  emergency_contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  enrolled_subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  attendance_rate NUMERIC NOT NULL DEFAULT 0,
  gpa TEXT NOT NULL DEFAULT '0.00',
  avatar_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.teachers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  staff_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  qualification TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  date_of_birth TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT 'Subject Teacher',
  department TEXT NOT NULL DEFAULT 'Academic Faculty',
  emergency_contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_classes JSONB NOT NULL DEFAULT '[]'::jsonb,
  class_teacher_of JSONB NOT NULL DEFAULT '[]'::jsonb,
  avatar_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id TEXT PRIMARY KEY,
  class TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'lesson',
  title TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  teacher_id TEXT NOT NULL DEFAULT '',
  teacher_name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.timetable_alerts (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  target_class TEXT NOT NULL DEFAULT '',
  target_teacher TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  record_key TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  class_name TEXT NOT NULL,
  submitted_by TEXT NOT NULL DEFAULT '',
  timestamp_label TEXT NOT NULL DEFAULT '',
  records JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.grades (
  grade_key TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  session TEXT NOT NULL DEFAULT '2026/2027',
  term TEXT NOT NULL DEFAULT 'Term1',
  subject TEXT NOT NULL,
  ca1 NUMERIC NOT NULL DEFAULT 0,
  ca2 NUMERIC NOT NULL DEFAULT 0,
  exam NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'F9',
  remark TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'document',
  subject TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  classes JSONB NOT NULL DEFAULT '["All Classes"]'::jsonb,
  access_level TEXT NOT NULL DEFAULT 'students',
  file_name TEXT NOT NULL DEFAULT '',
  file_size TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT '',
  upload_date TEXT NOT NULL DEFAULT '',
  downloads INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Laboratory',
  quantity INTEGER NOT NULL DEFAULT 1,
  available INTEGER NOT NULL DEFAULT 1,
  location TEXT NOT NULL DEFAULT '',
  condition TEXT NOT NULL DEFAULT 'Good',
  added_date TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  issue TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  reported_date TEXT NOT NULL DEFAULT '',
  reported_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Policy & Handbook',
  type TEXT NOT NULL DEFAULT 'PDF',
  size TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  folder_id TEXT NOT NULL DEFAULT '',
  access_level TEXT NOT NULL DEFAULT 'all',
  allowed_classes JSONB NOT NULL DEFAULT '["All Classes"]'::jsonb,
  description TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT '',
  upload_date TEXT NOT NULL DEFAULT '',
  downloads INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  author TEXT NOT NULL DEFAULT '',
  author_role TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT '',
  event_time TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'published',
  target_audiences JSONB NOT NULL DEFAULT '["Everyone"]'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.teacher_availability (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  day TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assignments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  class TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  total_marks NUMERIC NOT NULL DEFAULT 20,
  max_marks NUMERIC NOT NULL DEFAULT 20,
  type TEXT NOT NULL DEFAULT 'homework',
  status TEXT NOT NULL DEFAULT 'published',
  teacher_name TEXT NOT NULL DEFAULT '',
  attachment_name TEXT NOT NULL DEFAULT '',
  attachment_size TEXT NOT NULL DEFAULT '',
  attachment_path TEXT NOT NULL DEFAULT '',
  attachment_url TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_students INTEGER NOT NULL DEFAULT 0,
  total_students INTEGER NOT NULL DEFAULT 35,
  submissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_requests (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL DEFAULT '',
  admission_number TEXT NOT NULL DEFAULT '',
  class TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  request_type TEXT NOT NULL DEFAULT 'booking',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_date TEXT NOT NULL DEFAULT '',
  preferred_date TEXT NOT NULL DEFAULT '',
  preferred_time TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  preferred_teacher TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  staff_response TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.enquiries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'enquiry' CHECK (kind IN ('enquiry', 'appointment')),
  parent_name TEXT NOT NULL,
  student_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  year_level TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  preferred_date TEXT NOT NULL DEFAULT '',
  preferred_time TEXT NOT NULL DEFAULT '',
  meeting_type TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL DEFAULT '',
  sender_name TEXT NOT NULL DEFAULT 'Admin',
  recipient TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Recipient',
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'delivered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_leaves (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL DEFAULT '',
  teacher_name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'Casual Leave',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_date TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT 'Pending Review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.help_tickets (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Academic Support',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to TEXT NOT NULL DEFAULT 'Student Affairs Desk',
  created_date TEXT NOT NULL DEFAULT '',
  last_updated TEXT NOT NULL DEFAULT '',
  responses JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. ROLE RESOLUTION HELPER (ADMIN-PROVISIONED RECORDS ONLY)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role TEXT := 'student';
BEGIN
  IF LOWER(NEW.email) IN ('admin@alaminschools.edu', 'admin@alaminschools.edu.ng') THEN
    assigned_role := 'admin';
  ELSIF EXISTS (SELECT 1 FROM public.teachers WHERE LOWER(email) = LOWER(NEW.email)) THEN
    assigned_role := 'teacher';
  ELSIF EXISTS (SELECT 1 FROM public.students WHERE LOWER(email) = LOWER(NEW.email)) THEN
    assigned_role := 'student';
  ELSE
    RAISE EXCEPTION 'Self-registration is disabled. Accounts must be added by the School Administrator.';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    assigned_role
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'student');
$$;

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_tickets ENABLE ROW LEVEL SECURITY;

-- Portal users table is strictly server-side (Express uses SUPABASE_SECRET_KEY, bypassing RLS)
DROP POLICY IF EXISTS "No direct client access to portal_users" ON public.portal_users;
CREATE POLICY "No direct client access to portal_users" ON public.portal_users
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Profiles
DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own profile name" ON public.profiles;
CREATE POLICY "Users can update own profile name" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins manage all profiles" ON public.profiles;
CREATE POLICY "Admins manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Classes
DROP POLICY IF EXISTS "Authenticated read classes" ON public.classes;
CREATE POLICY "Authenticated read classes" ON public.classes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage classes" ON public.classes;
CREATE POLICY "Admins manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

-- Institution Settings
DROP POLICY IF EXISTS "Authenticated read settings" ON public.institution_settings;
CREATE POLICY "Authenticated read settings" ON public.institution_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage settings" ON public.institution_settings;
CREATE POLICY "Admins manage settings" ON public.institution_settings FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

-- Subjects
DROP POLICY IF EXISTS "Authenticated read subjects" ON public.subjects;
CREATE POLICY "Authenticated read subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage subjects" ON public.subjects;
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

-- Students: Admin-only creation & deletion; Teachers can read and update class/subject enrollment
DROP POLICY IF EXISTS "Authenticated read students" ON public.students;
CREATE POLICY "Authenticated read students" ON public.students FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin and staff manage students" ON public.students;
DROP POLICY IF EXISTS "Admins insert students" ON public.students;
CREATE POLICY "Admins insert students" ON public.students FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');
DROP POLICY IF EXISTS "Admins delete students" ON public.students;
CREATE POLICY "Admins delete students" ON public.students FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');
DROP POLICY IF EXISTS "Admin and teachers update students" ON public.students;
CREATE POLICY "Admin and teachers update students" ON public.students FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin', 'teacher'))
  WITH CHECK (public.current_user_role() IN ('admin', 'teacher'));

-- Teachers: Admin-only creation & deletion; Teachers can update own profile
DROP POLICY IF EXISTS "Authenticated read teachers" ON public.teachers;
CREATE POLICY "Authenticated read teachers" ON public.teachers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin manage teachers" ON public.teachers;
CREATE POLICY "Admin manage teachers" ON public.teachers FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');
DROP POLICY IF EXISTS "Teacher update own record" ON public.teachers;
CREATE POLICY "Teacher update own record" ON public.teachers FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'teacher' AND LOWER(email) = LOWER(auth.email()))
  WITH CHECK (public.current_user_role() = 'teacher' AND LOWER(email) = LOWER(auth.email()));

DROP POLICY IF EXISTS "Authenticated read timetable" ON public.timetable_slots;
CREATE POLICY "Authenticated read timetable" ON public.timetable_slots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin and staff manage timetable" ON public.timetable_slots;
CREATE POLICY "Admin and staff manage timetable" ON public.timetable_slots FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'teacher'))
  WITH CHECK (public.current_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "Authenticated manage timetable alerts" ON public.timetable_alerts;
DROP POLICY IF EXISTS "Authenticated read timetable alerts" ON public.timetable_alerts;
CREATE POLICY "Authenticated read timetable alerts" ON public.timetable_alerts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin and staff manage timetable alerts" ON public.timetable_alerts;
CREATE POLICY "Admin and staff manage timetable alerts" ON public.timetable_alerts FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'teacher'))
  WITH CHECK (public.current_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "Authenticated read attendance" ON public.attendance_records;
CREATE POLICY "Authenticated read attendance" ON public.attendance_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin and staff manage attendance" ON public.attendance_records;
CREATE POLICY "Admin and staff manage attendance" ON public.attendance_records FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'teacher'))
  WITH CHECK (public.current_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "Authenticated read grades" ON public.grades;
CREATE POLICY "Authenticated read grades" ON public.grades FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin and staff manage grades" ON public.grades;
CREATE POLICY "Admin and staff manage grades" ON public.grades FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'teacher'))
  WITH CHECK (public.current_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "Authenticated read resources" ON public.resources;
CREATE POLICY "Authenticated read resources" ON public.resources FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin and staff manage resources" ON public.resources;
CREATE POLICY "Admin and staff manage resources" ON public.resources FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'teacher'))
  WITH CHECK (public.current_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "Authenticated read equipment" ON public.equipment;
CREATE POLICY "Authenticated read equipment" ON public.equipment FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin manage equipment" ON public.equipment;
CREATE POLICY "Admin manage equipment" ON public.equipment FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated read maintenance" ON public.maintenance_requests;
CREATE POLICY "Authenticated read maintenance" ON public.maintenance_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin and staff manage maintenance" ON public.maintenance_requests;
CREATE POLICY "Admin and staff manage maintenance" ON public.maintenance_requests FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'teacher'))
  WITH CHECK (public.current_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "Authenticated read documents" ON public.documents;
CREATE POLICY "Authenticated read documents" ON public.documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin manage documents" ON public.documents;
CREATE POLICY "Admin manage documents" ON public.documents FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated read announcements" ON public.announcements;
CREATE POLICY "Authenticated read announcements" ON public.announcements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin and staff manage announcements" ON public.announcements;
CREATE POLICY "Admin and staff manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'teacher'))
  WITH CHECK (public.current_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "Authenticated read teacher availability" ON public.teacher_availability;
CREATE POLICY "Authenticated read teacher availability" ON public.teacher_availability FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin and staff manage teacher availability" ON public.teacher_availability;
CREATE POLICY "Admin and staff manage teacher availability" ON public.teacher_availability FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'teacher'))
  WITH CHECK (public.current_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "Authenticated read assignments" ON public.assignments;
CREATE POLICY "Authenticated read assignments" ON public.assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin and staff insert delete assignments" ON public.assignments;
CREATE POLICY "Admin and assigned teachers insert assignments" ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'teacher'
      AND EXISTS (
        SELECT 1
        FROM public.teachers t
        JOIN public.profiles p ON LOWER(p.email) = LOWER(t.email)
        WHERE p.id = auth.uid()
          AND (
            t.name = assignments.teacher_name
            OR t.assigned_classes @> jsonb_build_array(
              jsonb_build_object('class', assignments.class, 'subject', assignments.subject)
            )
          )
      )
    )
  );
DROP POLICY IF EXISTS "Authenticated update assignments" ON public.assignments;
CREATE POLICY "Authenticated update assignments" ON public.assignments FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'teacher'
      AND EXISTS (
        SELECT 1
        FROM public.teachers t
        JOIN public.profiles p ON LOWER(p.email) = LOWER(t.email)
        WHERE p.id = auth.uid()
          AND (
            t.name = assignments.teacher_name
            OR t.assigned_classes @> jsonb_build_array(
              jsonb_build_object('class', assignments.class, 'subject', assignments.subject)
            )
          )
      )
    )
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'teacher'
      AND EXISTS (
        SELECT 1
        FROM public.teachers t
        JOIN public.profiles p ON LOWER(p.email) = LOWER(t.email)
        WHERE p.id = auth.uid()
          AND (
            t.name = assignments.teacher_name
            OR t.assigned_classes @> jsonb_build_array(
              jsonb_build_object('class', assignments.class, 'subject', assignments.subject)
            )
          )
      )
    )
  );
DROP POLICY IF EXISTS "Admin and staff delete assignments" ON public.assignments;
CREATE POLICY "Admin and assigned teachers delete assignments" ON public.assignments FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'teacher'
      AND EXISTS (
        SELECT 1
        FROM public.teachers t
        JOIN public.profiles p ON LOWER(p.email) = LOWER(t.email)
        WHERE p.id = auth.uid()
          AND (
            t.name = assignments.teacher_name
            OR t.assigned_classes @> jsonb_build_array(
              jsonb_build_object('class', assignments.class, 'subject', assignments.subject)
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated read student requests" ON public.student_requests;
CREATE POLICY "Authenticated read student requests" ON public.student_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated create and update student requests" ON public.student_requests;
CREATE POLICY "Authenticated create and update student requests" ON public.student_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admin and staff update student requests" ON public.student_requests;
CREATE POLICY "Admin and staff update student requests" ON public.student_requests FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin', 'teacher'))
  WITH CHECK (public.current_user_role() IN ('admin', 'teacher'));

-- Enquiries & Appointments (Public submission from Login page, Admin/Staff review)
DROP POLICY IF EXISTS "Anyone can submit enquiry or appointment" ON public.enquiries;
CREATE POLICY "Anyone can submit enquiry or appointment" ON public.enquiries
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admins read enquiries" ON public.enquiries;
CREATE POLICY "Admins read enquiries" ON public.enquiries
  FOR SELECT TO authenticated USING (public.current_user_role() IN ('admin', 'teacher'));

-- Direct Messages, Staff Leaves & Help Tickets
DROP POLICY IF EXISTS "Authenticated direct messages read" ON public.direct_messages;
DROP POLICY IF EXISTS "Authenticated direct messages insert" ON public.direct_messages;
DROP POLICY IF EXISTS "Deny direct client access to direct_messages" ON public.direct_messages;
CREATE POLICY "Deny direct client access to direct_messages" ON public.direct_messages
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Authenticated staff leaves read" ON public.staff_leaves;
DROP POLICY IF EXISTS "Authenticated staff leaves insert" ON public.staff_leaves;
DROP POLICY IF EXISTS "Admin staff leaves update" ON public.staff_leaves;
DROP POLICY IF EXISTS "Deny direct client access to staff_leaves" ON public.staff_leaves;
CREATE POLICY "Deny direct client access to staff_leaves" ON public.staff_leaves
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Authenticated help tickets read" ON public.help_tickets;
DROP POLICY IF EXISTS "Authenticated help tickets insert" ON public.help_tickets;
DROP POLICY IF EXISTS "Authenticated help tickets update" ON public.help_tickets;
DROP POLICY IF EXISTS "Deny direct client access to help_tickets" ON public.help_tickets;
CREATE POLICY "Deny direct client access to help_tickets" ON public.help_tickets
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ============================================================
-- 5. SUPABASE STORAGE BUCKET & POLICIES (school-files)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-files', 'school-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "School files public read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload school files" ON storage.objects;
DROP POLICY IF EXISTS "Admin and staff delete school files" ON storage.objects;
DROP POLICY IF EXISTS "Deny direct client access to school files" ON storage.objects;
CREATE POLICY "Deny direct client access to school files" ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id = 'school-files' AND false)
  WITH CHECK (bucket_id = 'school-files' AND false);

-- ============================================================
-- 6. REALTIME PUBLICATION (MULTI-DEVICE LIVE SYNC)
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
  tables_to_sync TEXT[] := ARRAY[
    'subjects', 'students', 'teachers', 'timetable_slots', 'timetable_alerts',
    'attendance_records', 'grades', 'resources', 'equipment', 'maintenance_requests',
    'documents', 'announcements', 'teacher_availability', 'assignments', 'student_requests', 'enquiries',
    'direct_messages', 'staff_leaves', 'help_tickets'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_sync LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 7. CORE SUBJECT CURRICULUM CATALOG (NO DEMO/MOCK RECORDS)
-- ============================================================
INSERT INTO public.subjects (id, name, all_classes, classes, all_departments, departments) VALUES
  ('sub-1', 'Mathematics', true, '["JSS 1","JSS 2","JSS 3","SSS 1","SSS 2","SSS 3"]'::jsonb, true, '["Science","Humanities","Business"]'::jsonb),
  ('sub-2', 'English Language', true, '["JSS 1","JSS 2","JSS 3","SSS 1","SSS 2","SSS 3"]'::jsonb, true, '["Science","Humanities","Business"]'::jsonb)
ON CONFLICT (id) DO NOTHING;
