-- DESTRUCTIVE: removes all application data and app-owned public tables.
-- Keeps Supabase Auth users and Storage files/bucket intact.
-- Existing Auth users will lose their public.profiles and portal_users rows.
-- Back up the project before running. Run schema.sql afterward to recreate
-- the application tables, functions, trigger, policies, and seed catalog data.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TABLE IF EXISTS
  public.portal_users,
  public.profiles,
  public.institution_settings,
  public.classes,
  public.subjects,
  public.students,
  public.teachers,
  public.timetable_slots,
  public.timetable_alerts,
  public.attendance_records,
  public.grades,
  public.resources,
  public.equipment,
  public.maintenance_requests,
  public.documents,
  public.announcements,
  public.teacher_availability,
  public.assignments,
  public.student_requests,
  public.enquiries,
  public.direct_messages,
  public.staff_leaves,
  public.help_tickets
CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.document_facets(TEXT, TEXT[]);
DROP FUNCTION IF EXISTS public.attendance_summary(TEXT[], DATE);

NOTIFY pgrst, 'reload schema';
