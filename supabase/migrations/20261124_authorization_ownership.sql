ALTER TABLE public.portal_users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auth_version BIGINT NOT NULL DEFAULT 1;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS creator_id TEXT;

UPDATE public.portal_users AS account
SET is_active = FALSE,
    auth_version = account.auth_version + 1
FROM public.teachers AS teacher
WHERE account.teacher_id = teacher.id
  AND lower(teacher.status) <> 'active'
  AND account.is_active = TRUE;

UPDATE public.portal_users AS account
SET is_active = FALSE,
    auth_version = account.auth_version + 1
FROM public.students AS student
WHERE account.student_id = student.id
  AND lower(student.status) <> 'active'
  AND account.is_active = TRUE;

DO $$
DECLARE
  app_table TEXT;
  app_tables TEXT[] := ARRAY[
    'portal_users', 'profiles', 'institution_settings', 'classes', 'subjects',
    'students', 'teachers', 'timetable_slots', 'timetable_alerts',
    'attendance_records', 'grades', 'resources', 'equipment',
    'maintenance_requests', 'documents', 'announcements', 'teacher_availability',
    'assignments', 'student_requests', 'enquiries', 'direct_messages',
    'staff_leaves', 'help_tickets'
  ];
BEGIN
  FOREACH app_table IN ARRAY app_tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      app_table
    );
  END LOOP;
END
$$;
