-- The browser uses the Express API exclusively. Deny direct Supabase Data API
-- access to application tables; the server's service_role key bypasses these
-- policies and performs role-scoped authorization in server/routes.ts.
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
      'DROP POLICY IF EXISTS "Deny direct API access" ON public.%I',
      app_table
    );
    EXECUTE format(
      'CREATE POLICY "Deny direct API access" ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      app_table
    );
  END LOOP;
END
$$;
