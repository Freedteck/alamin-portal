import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SCHOOL_CLASSES,
  SSS_DEPARTMENTS,
  computeGrade,
  createInitialUsers,
  generateAdmissionNumber,
  hashPassword,
  isSeniorClass,
  verifyPassword
} from './seed.ts';

const SUPABASE_BUCKET = 'school-files';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''
).trim();

function isValidHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

let serverSupabase: SupabaseClient | null = null;
if (isValidHttpUrl(SUPABASE_URL) && SUPABASE_KEY) {
  try {
    serverSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  } catch {
    serverSupabase = null;
  }
}

export const isServerSupabaseConfigured = Boolean(serverSupabase);

type SseListener = (event: { resource: string; action: string; timestamp: string }) => void;
const sseListeners = new Set<SseListener>();

export function subscribeServerEvents(listener: SseListener) {
  sseListeners.add(listener);
  return () => {
    sseListeners.delete(listener);
  };
}

export function broadcastChange(resource: string, action = 'updated') {
  const payload = { resource, action, timestamp: new Date().toISOString() };
  sseListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch {
    }
  });
}

function requireServerSupabase(): SupabaseClient {
  if (!serverSupabase) {
    throw new Error('Supabase is required for this data operation. Configure SUPABASE_URL and SUPABASE_SECRET_KEY.');
  }
  return serverSupabase;
}

function mapEquipmentRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    available: row.available,
    location: row.location,
    condition: row.condition,
    addedDate: row.added_date
  };
}

function mapMaintenanceRow(row: any) {
  return {
    id: row.id,
    itemName: row.item_name,
    issue: row.issue,
    priority: row.priority,
    status: row.status,
    reportedDate: row.reported_date,
    reportedBy: row.reported_by
  };
}

function mapClassRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category || (isSeniorClass(row.name) ? 'Senior' : 'Junior'),
    classTeacherId: row.class_teacher_id || '',
    classTeacherName: row.class_teacher_name || ''
  };
}

function mapSubjectRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    allClasses: row.all_classes,
    classes: row.classes || [],
    allDepartments: row.all_departments,
    departments: row.departments || []
  };
}

function mapStudentRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    admissionNumber: row.admission_number,
    class: row.class,
    department: row.department,
    gender: row.gender,
    dob: row.dob,
    stateOfOrigin: row.state_of_origin,
    lga: row.lga,
    address: row.address,
    email: row.email,
    parentName: row.parent_name,
    parentPhone: row.parent_phone,
    parentEmail: row.parent_email,
    parentOccupation: row.parent_occupation || '',
    parentRelationship: row.parent_relationship || '',
    emergencyContact: row.emergency_contact || {},
    enrolledSubjects: row.enrolled_subjects || [],
    attendanceRate: row.attendance_rate || 0,
    gpa: row.gpa || '0.00',
    avatarUrl: row.avatar_url || '',
    status: row.status || 'active',
    createdAt: row.created_at
  };
}

function mapTeacherRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    staffId: row.staff_id,
    email: row.email,
    phone: row.phone,
    qualification: row.qualification,
    address: row.address,
    dateOfBirth: row.date_of_birth,
    startDate: row.start_date,
    position: row.position,
    department: row.department,
    emergencyContact: row.emergency_contact || {},
    assignedClasses: row.assigned_classes || [],
    classTeacherOf: row.class_teacher_of || [],
    avatarUrl: row.avatar_url || '',
    status: row.status || 'active',
    createdAt: row.created_at
  };
}

function mapDatabaseRow(row: any): any {
  return Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
      value
    ])
  );
}

function mapDatabaseRows(rows: unknown): any[] {
  return Array.isArray(rows) ? rows.map(mapDatabaseRow) : [];
}

function toDatabaseRow(record: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(record || {}).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      value
    ])
  );
}

function quotePostgrestSearch(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[%_]/g, '\\$&');
}

function toStudentDatabaseRow(student: any) {
  return {
    name: student.name,
    admission_number: student.admissionNumber,
    class: student.class,
    department: student.department || '',
    gender: student.gender || 'Male',
    dob: student.dob || student.dateOfBirth || '',
    state_of_origin: student.stateOfOrigin || '',
    lga: student.lga || '',
    address: student.address || '',
    email: student.email || '',
    parent_name: student.parentName || '',
    parent_phone: student.parentPhone || '',
    parent_email: student.parentEmail || '',
    parent_occupation: student.parentOccupation || '',
    parent_relationship: student.parentRelationship || '',
    emergency_contact: student.emergencyContact || {},
    enrolled_subjects: student.enrolledSubjects || [],
    attendance_rate: student.attendanceRate ?? 0,
    gpa: String(student.gpa || '0.00'),
    avatar_url: student.avatarUrl || '',
    status: student.status || 'active'
  };
}

function toTeacherDatabaseRow(teacher: any) {
  return {
    name: teacher.name,
    staff_id: teacher.staffId,
    email: teacher.email || '',
    phone: teacher.phone || '',
    qualification: teacher.qualification || '',
    address: teacher.address || '',
    date_of_birth: teacher.dateOfBirth || '',
    start_date: teacher.startDate || '',
    position: teacher.position || 'Subject Teacher',
    department: teacher.department || 'Academic Faculty',
    emergency_contact: teacher.emergencyContact || {},
    assigned_classes: teacher.assignedClasses || [],
    class_teacher_of: teacher.classTeacherOf || [],
    avatar_url: teacher.avatarUrl || '',
    status: teacher.status || 'active'
  };
}

const timeToMinutes = (t = '') => {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const slotsOverlap = (startA: string, endA: string, startB: string, endB: string) => {
  const a1 = timeToMinutes(startA);
  const a2 = timeToMinutes(endA);
  const b1 = timeToMinutes(startB);
  const b2 = timeToMinutes(endB);
  return a1 < b2 && b1 < a2;
};

export async function uploadFileToBackendStorage(
  folder: string,
  file: Express.Multer.File
): Promise<{ fileName: string; fileSize: string; filePath: string; fileUrl: string }> {
  const safeFolder = String(folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanOriginal = String(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storedName = `${Date.now()}_${cleanOriginal}`;
  const relativePath = `${safeFolder}/${storedName}`;

  const sizeLabel =
    file.size < 1024
      ? `${file.size} B`
      : file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  const { error } = await requireServerSupabase().storage
    .from(SUPABASE_BUCKET)
    .upload(relativePath, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: false
    });
  if (error) throw error;

  return {
    fileName: file.originalname,
    fileSize: sizeLabel,
    filePath: relativePath,
    fileUrl: `/api/files/download/${relativePath}`
  };
}

export async function downloadFileFromBackendStorage(filePath: string): Promise<Buffer | null> {
  const { data, error } = await requireServerSupabase().storage.from(SUPABASE_BUCKET).download(filePath);
  if (error) throw error;
  if (!data) return null;
  return Buffer.from(await data.arrayBuffer());
}

interface PasswordResetOtp {
  email: string;
  code: string;
  expiresAt: number;
  failedAttempts: number;
}
const passwordResetOtps = new Map<string, PasswordResetOtp>();

export const backendStore = {
  getStorageMode() {
    return isServerSupabaseConfigured ? 'supabase-postgres' : 'supabase-unavailable';
  },

  async ensureInitialAdmin() {
    const client = requireServerSupabase();
    const { data: admins, error: adminError } = await client.from('portal_users')
      .select('id,password_hash').eq('role', 'admin');
    if (adminError) throw adminError;
    const legacyAdminIds = (admins || [])
      .filter((admin) => verifyPassword('admin123', admin.password_hash))
      .map((admin) => admin.id);
    if (legacyAdminIds.length) {
      const { error } = await client.from('portal_users').delete().in('id', legacyAdminIds);
      if (error) throw error;
      console.warn('Removed legacy administrator account(s) using the known default password.');
    }

    const remainingAdmins = (admins || []).filter((admin) => !legacyAdminIds.includes(admin.id));
    if (remainingAdmins.length) return;
    const [initialAdmin] = createInitialUsers();
    if (!initialAdmin) {
      throw new Error('No administrator account exists. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (at least 12 characters).');
    }
    const { error } = await client.from('portal_users').insert({
      id: initialAdmin.id,
      email: initialAdmin.email,
      name: initialAdmin.name,
      role: initialAdmin.role,
      student_id: '',
      teacher_id: '',
      password_hash: initialAdmin.passwordHash,
      avatar_url: ''
    });
    if (error) throw error;
    console.info(`[Al-Amin Store] Provisioned initial administrator ${initialAdmin.email}.`);
  },

  async canAccessFile(filePath: string, user: any) {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const sameFile = (entry: any, path: string) =>
      [entry.filePath, entry.attachmentPath, entry.fileUrl, entry.attachmentUrl]
        .some((value) => value === path || value === `/api/files/download/${path}`);
    const classMatches = (classes: any, className: string) =>
      !Array.isArray(classes) || classes.length === 0 || classes.includes('All Classes') || classes.includes(className);

    if (user.role === 'student') {
      const student = await this.getStudentDirectoryRecord(user.studentId);
      if (!student) return false;
      const className = student.class;
      const studentSubjectNames = student.enrolledSubjects?.length
        ? student.enrolledSubjects
        : (await this.getSubjects())
          .filter((subject) =>
            subject.allClasses || (Array.isArray(subject.classes) && subject.classes.includes(className))
          )
          .map((subject) => subject.name);
      const subjectMatches = (subject: string) =>
        !subject || subject === 'General' || studentSubjectNames.includes(subject);
      const [resources, documents, assignments, account] = await Promise.all([
        this.getResources(),
        this.getDocuments(),
        this.getAssignments(),
        this.getUserByIdFromDatabase(user.id)
      ]);
      const hasResource = resources.some((item) =>
        sameFile(item, filePath) &&
        ['students', 'all'].includes(String(item.accessLevel || '').toLowerCase()) &&
        classMatches(item.classes, className) &&
        subjectMatches(item.subject)
      );
      const hasDocument = documents.some((item) =>
        sameFile(item, filePath) &&
        ['all', 'student', 'students'].includes(String(item.accessLevel || '').toLowerCase()) &&
        classMatches(item.allowedClasses, className)
      );
      const assignmentFile = assignments.some((assignment) =>
        sameFile(assignment, filePath) &&
        (!assignment.class || assignment.class === 'All Classes' || assignment.class === className) &&
        subjectMatches(assignment.subject)
      );
      const submissionFile = assignments.some((assignment) =>
        (assignment.submissions || []).some((submission: any) =>
          submission.studentId === user.studentId &&
          filePath.startsWith(`submissions-${String(student.id).replace(/[^A-Za-z0-9_-]/g, '')}/`) &&
          sameFile(submission, filePath)
        )
      );
      return hasResource || hasDocument || assignmentFile ||
        (submissionFile && account?.studentId === user.studentId) ||
        student.avatarUrl === `/api/files/download/${filePath}`;
    }

    if (user.role === 'teacher') {
      const teacher = await this.getTeacherDirectoryRecord(user.teacherId);
      if (!teacher) return false;
      const assigned = teacher.assignedClasses || [];
      const classNames = assigned.map((item: any) => item.class).filter(Boolean);
      const subjectNames = assigned.map((item: any) => item.subject).filter(Boolean);
      const [resources, documents, assignments, account] = await Promise.all([
        this.getResources(),
        this.getDocuments(),
        this.getAssignments(),
        this.getUserByIdFromDatabase(user.id)
      ]);
      const hasResource = resources.some((item) =>
        sameFile(item, filePath) &&
        String(item.accessLevel || '').toLowerCase() !== 'admin' &&
        (
          item.uploadedBy === teacher.name ||
          item.accessLevel === 'teachers' ||
          !Array.isArray(item.classes) ||
          item.classes.includes('All Classes') ||
          item.classes.some((className: string) => classNames.includes(className)) ||
          subjectNames.includes(item.subject)
        )
      );
      const hasDocument = documents.some((item) =>
        sameFile(item, filePath) &&
        ['all', 'teacher', 'teachers', 'staff'].includes(String(item.accessLevel || '').toLowerCase()) &&
        (
          !Array.isArray(item.allowedClasses) ||
          item.allowedClasses.length === 0 ||
          item.allowedClasses.includes('All Classes') ||
          classNames.some((className: string) => item.allowedClasses.includes(className))
        )
      );
      const assignmentFile = assignments.some((assignment) =>
        sameFile(assignment, filePath) &&
        (
          assignment.teacherId === user.teacherId ||
          assignment.teacherName === teacher.name ||
          assignment.author === teacher.name ||
          (classNames.includes(assignment.class) && subjectNames.includes(assignment.subject))
        )
      );
      const submissionFile = assignments.some((assignment) =>
        (assignment.submissions || []).some((submission: any) =>
          sameFile(submission, filePath) &&
          (
            assignment.teacherId === user.teacherId ||
            assignment.teacherName === teacher.name ||
            assignment.author === teacher.name ||
            (classNames.includes(assignment.class) && subjectNames.includes(assignment.subject))
          )
        )
      );
      return hasResource || hasDocument || assignmentFile || submissionFile ||
        teacher.avatarUrl === `/api/files/download/${filePath}` ||
        account?.avatarUrl === `/api/files/download/${filePath}`;
    }

    return false;
  },

  async getBootstrapPayload(user?: any) {
    const [classes, subjects] = await Promise.all([this.getClasses(), this.getSubjects()]);
    if (!user) {
      return {
        classes,
        subjects,
        students: [],
        teachers: [],
        timetable: [],
        alerts: [],
        attendance: {},
        grades: {},
        resources: [],
        equipment: [],
        maintenance: [],
        documents: [],
        announcements: [],
        availability: [],
        assignments: [],
        requests: []
      };
    }

    const [
      studentsResult,
      teachers,
      timetable,
      alerts,
      allAttendance,
      resources,
      equipmentResult,
      maintenanceResult,
      documents,
      announcements,
      availability,
      assignments,
      allRequests
    ] = await Promise.all([
      this.getStudents(),
      this.getTeachers(),
      this.getTimetableSlots(),
      this.getAlerts(user.role),
      this.getAttendance(),
      this.getResources(),
      this.getEquipment(),
      this.getMaintenance(),
      this.getDocuments(),
      this.getAnnouncements(),
      this.getTeacherAvailability(),
      this.getAssignments(),
      this.getRequests(user.role === 'student' ? user.studentId : undefined)
    ]);
    const allStudents = Array.isArray(studentsResult) ? studentsResult : studentsResult.data || [];
    const allTeachers = Array.isArray(teachers) ? teachers : teachers.data || [];
    const equipment = equipmentResult.data || [];
    const maintenance = maintenanceResult.data || [];

    if (user.role === 'student') {
      const studentObj = await this.getStudentDirectoryRecord(user.studentId);
      const studentClass = studentObj?.class || '';
      const enrolledSubjects = studentObj?.enrolledSubjects || [];
      const studentSubjects = subjects.filter((s) =>
        enrolledSubjects.length > 0
          ? enrolledSubjects.includes(s.name)
          : (s.allClasses || (Array.isArray(s.classes) && s.classes.includes(studentClass)))
      );
      const studentSubjectNames = studentSubjects.map((s) => s.name);
      const studentGrades = user.studentId ? await this.getGrades([user.studentId]) : {};
      const studentAttendance = await this.getAttendance(undefined, studentClass);
      const scopedAttendance = Object.fromEntries(Object.entries(studentAttendance)
        .filter(([, entry]: [string, any]) => entry.records?.[user.studentId])
        .map(([key, entry]: [string, any]) => [key, {
          ...entry,
          records: { [user.studentId]: entry.records[user.studentId] }
        }]));
      const classTeachers = allTeachers.filter((teacher) =>
        (teacher.assignedClasses || []).some((assignment: any) => assignment.class === studentClass)
      );

      return {
        classes: classes.filter((c) => !studentClass || c.name === studentClass),
        subjects: studentSubjects,
        students: studentObj ? [studentObj] : [],
        teachers: classTeachers
          .map(({ phone, email, qualification, staffId, ...safe }) => safe),
        timetable: timetable.filter((slot) => slot.class === studentClass || slot.class === 'All Classes'),
        alerts,
        attendance: scopedAttendance,
        grades: studentGrades,
        resources: resources.filter(
          (r) =>
            r.accessLevel === 'students' &&
            (r.allClasses || (r.classes && (r.classes.includes(studentClass) || r.classes.includes('All Classes')))) &&
            (!r.subject || r.subject === 'General' || studentSubjectNames.includes(r.subject))
        ),
        equipment: [],
        maintenance: [],
        documents: documents.filter((d) => ['all', 'student', 'students'].includes(String(d.accessLevel || '').toLowerCase())),
        announcements: announcements.filter((a) => !a.targetRole || a.targetRole === 'all' || a.targetRole === 'student'),
        availability: [],
        assignments: assignments.filter(
          (a) =>
            (!a.class || a.class === 'All Classes' || a.class === studentClass) &&
            (!a.subject || a.subject === 'General' || studentSubjectNames.includes(a.subject))
        ),
        requests: allRequests.filter((request) => request.studentId === user.studentId)
      };
    }

    if (user.role === 'teacher') {
      const teacherObj = await this.getTeacherDirectoryRecord(user.teacherId);
      const assigned = teacherObj?.assignedClasses || [];
      const assignedClassNames = Array.from(new Set(assigned.map((a: any) => a.class).filter(Boolean)));
      const assignedSubjectNames = Array.from(new Set(assigned.map((a: any) => a.subject).filter(Boolean)));

      const teacherSubjects = assignedSubjectNames.length > 0
        ? subjects.filter((s) => assignedSubjectNames.includes(s.name))
        : subjects;

      const teacherClasses = assignedClassNames.length > 0
        ? classes.filter((c) => assignedClassNames.includes(c.name))
        : [];

      const teacherStudents = assignedClassNames.length > 0
        ? allStudents.filter((s) => assignedClassNames.includes(s.class))
        : [];

      const scopedAttendance: Record<string, any> = {};
      Object.entries(allAttendance).forEach(([key, entry]: [string, any]) => {
        if (assignedClassNames.includes(entry.className)) scopedAttendance[key] = entry;
      });
      const teacherGrades = await this.getGrades(teacherStudents.map((student) => student.id));

      return {
        classes: teacherClasses,
        subjects: teacherSubjects,
        students: teacherStudents,
        teachers: allTeachers.map(({ email, phone, ...safe }) => safe),
        timetable: timetable.filter(
          (t) =>
            t.teacherId === user.teacherId ||
            (teacherObj?.name && t.teacherName === teacherObj.name) ||
            assignedClassNames.includes(t.class)
        ),
        alerts,
        attendance: scopedAttendance,
        grades: teacherGrades,
        resources: resources.filter(
          (r) =>
            r.uploadedBy === teacherObj?.name ||
            assignedSubjectNames.includes(r.subject) ||
            r.accessLevel === 'teachers' ||
            (r.classes && r.classes.some((c: string) => assignedClassNames.includes(c)))
        ),
        equipment,
        maintenance,
        documents: documents.filter((d) => d.accessLevel !== 'admin'),
        announcements: announcements.filter((a) => !a.targetRole || a.targetRole === 'all' || a.targetRole === 'teacher'),
        availability: availability.filter((slot) => slot.teacherId === user.teacherId),
        assignments: assignments.filter(
          (a) =>
            a.teacherId === user.teacherId ||
            a.author === teacherObj?.name ||
            (assignedClassNames.includes(a.class) && assignedSubjectNames.includes(a.subject))
        ),
        requests: allRequests.filter((request) => request.teacherId === user.teacherId)
      };
    }

    return {
      classes,
      subjects,
      students: allStudents,
      teachers: allTeachers,
      timetable,
      alerts,
      attendance: allAttendance,
      grades: await this.getGrades(),
      resources,
      equipment,
      maintenance,
      documents,
      announcements,
      availability,
      assignments,
      requests: allRequests
    };
  },

  async authenticateInDatabase(identifier: string, password: string) {
    const clean = String(identifier || '').trim().toLowerCase();
    if (!clean || !password) return null;
    const client = requireServerSupabase();
    let query = client.from('portal_users').select('*').ilike('email', quotePostgrestSearch(clean));
    let { data: user, error } = await query.maybeSingle();
    if (error) throw error;

    if (!user) {
      const { data: student, error: studentError } = await client.from('students')
        .select('id')
        .ilike('admission_number', quotePostgrestSearch(clean))
        .maybeSingle();
      if (studentError) throw studentError;
      if (student) {
        const result = await client.from('portal_users').select('*').eq('student_id', student.id).maybeSingle();
        if (result.error) throw result.error;
        user = result.data;
      }
    }

    if (!user) {
      const { data: teacher, error: teacherError } = await client.from('teachers')
        .select('id')
        .ilike('staff_id', quotePostgrestSearch(clean))
        .maybeSingle();
      if (teacherError) throw teacherError;
      if (teacher) {
        const result = await client.from('portal_users').select('*').eq('teacher_id', teacher.id).maybeSingle();
        if (result.error) throw result.error;
        user = result.data;
      }
    }

    if (!user || !verifyPassword(password, user.password_hash)) return null;
    const { password_hash: _ignored, student_id, teacher_id, ...safeUser } = user;
    return {
      ...safeUser,
      studentId: student_id || undefined,
      teacherId: teacher_id || undefined
    };
  },

  async isEmailTakenInDatabase(email: string, linkedId?: string) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return false;
    let query = requireServerSupabase().from('portal_users').select('id').ilike('email', quotePostgrestSearch(clean));
    if (linkedId) query = query.neq('id', linkedId);
    const { data, error } = await query.limit(1);
    if (error) throw error;
    return Boolean(data?.length);
  },

  async provisionPortalUserInDatabase({
    email,
    password,
    name,
    role,
    studentId,
    teacherId
  }: {
    email: string;
    password?: string;
    name: string;
    role: 'teacher' | 'student';
    studentId?: string;
    teacherId?: string;
  }) {
    const client = requireServerSupabase();
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return { error: 'A valid portal email address is required.' };

    const linkedColumn = studentId ? 'student_id' : 'teacher_id';
    const linkedValue = studentId || teacherId || '';
    const [{ data: linkedUser, error: linkedError }, taken] = await Promise.all([
      client.from('portal_users').select('id').eq(linkedColumn, linkedValue).maybeSingle(),
      this.isEmailTakenInDatabase(cleanEmail)
    ]);
    if (linkedError) throw linkedError;
    if (taken) {
      const { data: emailOwner, error } = await client.from('portal_users')
        .select('id')
        .ilike('email', quotePostgrestSearch(cleanEmail))
        .maybeSingle();
      if (error) throw error;
      if (!emailOwner || emailOwner.id !== linkedUser?.id) {
        return { error: `An account with email "${cleanEmail}" already exists.` };
      }
    }

    const rawPassword = String(password || '').trim().length >= 6
      ? String(password).trim()
      : `Alamin#${crypto.randomBytes(3).toString('hex')}`;
    const userRecord = {
      id: linkedUser?.id || `usr_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      email: cleanEmail,
      name: String(name || '').trim() || cleanEmail.split('@')[0],
      role,
      student_id: studentId || '',
      teacher_id: teacherId || '',
      password_hash: hashPassword(rawPassword),
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from('portal_users').upsert(userRecord, { onConflict: 'id' });
    if (error) throw error;
    return {
      credentials: {
        email: cleanEmail,
        temporaryPassword: rawPassword
      }
    };
  },

  async updatePortalAccountEmailInDatabase(
    role: 'teacher' | 'student',
    entityId: string,
    email: string,
    name: string
  ) {
    const client = requireServerSupabase();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const linkedColumn = role === 'student' ? 'student_id' : 'teacher_id';
    const { data: linkedUser, error: linkedError } = await client.from('portal_users')
      .select('id')
      .eq(linkedColumn, entityId)
      .maybeSingle();
    if (linkedError) throw linkedError;
    if (!linkedUser) return null;

    const taken = await this.isEmailTakenInDatabase(cleanEmail);
    if (taken) {
      const { data: owner, error } = await client.from('portal_users')
        .select('id')
        .ilike('email', quotePostgrestSearch(cleanEmail))
        .maybeSingle();
      if (error) throw error;
      if (owner?.id !== linkedUser.id) return { error: `An account with email "${cleanEmail}" already exists.` };
    }

    const { error } = await client.from('portal_users')
      .update({ email: cleanEmail, name: String(name || '').trim() })
      .eq('id', linkedUser.id);
    if (error) throw error;
    return null;
  },

  async getUserByIdFromDatabase(id: string) {
    const { data, error } = await requireServerSupabase()
      .from('portal_users')
      .select('id,email,name,role,student_id,teacher_id,avatar_url,created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      studentId: data.student_id || undefined,
      teacherId: data.teacher_id || undefined,
      avatarUrl: data.avatar_url || '',
      createdAt: data.created_at
    };
  },

  async updateUserAvatarInDatabase(userId: string, avatarUrl: string) {
    const client = requireServerSupabase();
    let { data: user, error } = await client.from('portal_users')
      .select('id,email,name,role,student_id,teacher_id,avatar_url,created_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!user) {
      const { data, error: lookupError } = await client.from('portal_users')
        .select('id,email,name,role,student_id,teacher_id,avatar_url,created_at')
        .eq('student_id', userId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      user = data;
    }
    if (!user) {
      const { data, error: lookupError } = await client.from('portal_users')
        .select('id,email,name,role,student_id,teacher_id,avatar_url,created_at')
        .eq('teacher_id', userId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      user = data;
    }
    if (!user) return null;
    const { data: updatedUser, error: updateError } = await client.from('portal_users')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)
      .select('id,email,name,role,student_id,teacher_id,avatar_url,created_at')
      .single();
    if (updateError) throw updateError;
    user = updatedUser;
    const entityTable = user.role === 'student' ? 'students' : user.role === 'teacher' ? 'teachers' : null;
    const entityId = user.student_id || user.teacher_id;
    if (entityTable && entityId) {
      const { error: entityError } = await client.from(entityTable).update({ avatar_url: avatarUrl }).eq('id', entityId);
      if (entityError) throw entityError;
    }
    broadcastChange('users', 'updated');
    if (entityTable) broadcastChange(entityTable, 'updated');
    const { student_id, teacher_id, ...safeUser } = user;
    return { ...safeUser, studentId: student_id || undefined, teacherId: teacher_id || undefined };
  },

  async getClasses() {
    const { data, error } = await requireServerSupabase().from('classes').select('*').order('name');
    if (error) throw error;
    return (data || []).map(mapClassRow);
  },

  async getDefaultClassName() {
    const classes = await this.getClasses();
    return classes[0]?.name || 'JSS 1';
  },

  async addClass(classData: { name: string; category?: string; classTeacherId?: string; classTeacherName?: string }) {
    const cleanName = String(classData.name || '').trim();
    if (!cleanName) return { error: 'Class name is required.' };
    const classes = await this.getClasses();
    const exists = classes.some((c) => c.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) return { error: `Class "${cleanName}" already exists.` };
    const newCls = {
      id: `cls-${Date.now()}`,
      name: cleanName,
      category: classData.category || (isSeniorClass(cleanName) ? 'Senior' : 'Junior'),
      classTeacherId: classData.classTeacherId || '',
      classTeacherName: classData.classTeacherName || ''
    };
    const { data, error } = await requireServerSupabase().from('classes').insert({
      id: newCls.id,
      name: newCls.name,
      category: newCls.category,
      class_teacher_id: newCls.classTeacherId,
      class_teacher_name: newCls.classTeacherName
    }).select('*').single();
    if (error) throw error;
    broadcastChange('classes', 'created');
    return mapClassRow(data);
  },

  async assignClassTeacher(classIdOrName: string, teacherId: string | null | undefined) {
    const classes = await this.getClasses();
    const cls = classes.find(
      (c) => c.id === classIdOrName || c.name.toLowerCase() === classIdOrName.toLowerCase()
    );
    if (!cls) return { error: `Class "${classIdOrName}" not found.` };

    const client = requireServerSupabase();
    const { data: targetTeacher, error: teacherError } = teacherId
      ? await client.from('teachers').select('id,name,class_teacher_of').eq('id', teacherId).maybeSingle()
      : { data: null, error: null };
    if (teacherError) throw teacherError;
    if (teacherId && !targetTeacher) return { error: 'Teacher not found.' };

    const teacherUpdates: PromiseLike<{ error: any }>[] = [];
    if (cls.classTeacherId && cls.classTeacherId !== teacherId) {
      const { data: oldTeacher, error } = await client
        .from('teachers')
        .select('id,class_teacher_of')
        .eq('id', cls.classTeacherId)
        .maybeSingle();
      if (error) throw error;
      if (oldTeacher) {
        teacherUpdates.push(client.from('teachers').update({
          class_teacher_of: (oldTeacher.class_teacher_of || []).filter((name: string) => name !== cls.name)
        }).eq('id', oldTeacher.id));
      }
    }
    if (targetTeacher) {
      const existingClasses = targetTeacher.class_teacher_of || [];
      if (!existingClasses.includes(cls.name)) {
        teacherUpdates.push(client.from('teachers').update({
          class_teacher_of: [...existingClasses, cls.name]
        }).eq('id', targetTeacher.id));
      }
    }
    const updates = await Promise.all(teacherUpdates);
    const failedTeacherUpdate = updates.find(({ error }) => error);
    if (failedTeacherUpdate?.error) throw failedTeacherUpdate.error;

    const nextClass = {
      ...cls,
      classTeacherId: targetTeacher?.id || '',
      classTeacherName: targetTeacher?.name || ''
    };
    const { data, error } = await client.from('classes').update({
      class_teacher_id: nextClass.classTeacherId,
      class_teacher_name: nextClass.classTeacherName
    }).eq('id', cls.id).select('*').single();
    if (error) throw error;

    broadcastChange('classes', 'updated');

    return mapClassRow(data);
  },

  async setTeacherClassTeacherOf(teacherId: string, classes: string[]) {
    const { data: teacher, error } = await requireServerSupabase()
      .from('teachers')
      .select('id,class_teacher_of')
      .eq('id', teacherId)
      .maybeSingle();
    if (error) throw error;
    if (!teacher) return { error: 'Teacher not found.' };

    const currentAssigned = teacher.class_teacher_of || [];
    const targetClasses = Array.isArray(classes) ? classes : [];

    for (const clsName of currentAssigned) {
      if (!targetClasses.includes(clsName)) {
        const result = await this.assignClassTeacher(clsName, null);
        if ((result as any).error) throw new Error((result as any).error);
      }
    }

    for (const clsName of targetClasses) {
      const result = await this.assignClassTeacher(clsName, teacherId);
      if ((result as any).error) throw new Error((result as any).error);
    }

    const updatedTeacher = await this.getTeacherDirectoryRecord(teacherId);
    return updatedTeacher ? { ...updatedTeacher, classTeacherOf: targetClasses } : { error: 'Teacher not found.' };
  },

  async deleteClass(id: string) {
    const classes = await this.getClasses();
    const existing = classes.find((c) => c.id === id);
    if (!existing) return false;
    if (existing.classTeacherId) {
      const { data: teacher, error: teacherError } = await requireServerSupabase()
        .from('teachers')
        .select('id,class_teacher_of')
        .eq('id', existing.classTeacherId)
        .maybeSingle();
      if (teacherError) throw teacherError;
      if (teacher) {
        const { error } = await requireServerSupabase().from('teachers').update({
          class_teacher_of: (teacher.class_teacher_of || []).filter((name: string) => name !== existing.name)
        }).eq('id', teacher.id);
        if (error) throw error;
      }
    }
    const { data, error } = await requireServerSupabase()
      .from('classes')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return false;
    broadcastChange('classes', 'deleted');
    return true;
  },

  async getSubjects() {
    const { data, error } = await requireServerSupabase().from('subjects').select('*').order('name');
    if (error) throw error;
    return (data || []).map(mapSubjectRow);
  },

  async getSubjectsForClass(className: string, department = '') {
    const subjects = await this.getSubjects();
    if (!className || className === 'All Classes') {
      return subjects.map((s) => s.name);
    }
    const senior = isSeniorClass(className);
    return subjects
      .filter((sub) => {
        const classMatch = sub.allClasses || (sub.classes || []).includes(className);
        if (!classMatch) return false;
        if (!senior || !department) return true;
        return sub.allDepartments || (sub.departments || []).includes(department);
      })
      .map((s) => s.name);
  },

  async addSubject(subjectData: any) {
    const cleanName = String(subjectData.name || '').trim();
    if (!cleanName) return null;
    const allClasses = Boolean(subjectData.allClasses);
    const existingClassNames = (await this.getClasses()).map((c: any) => c.name);
    const defaultClasses = existingClassNames.length > 0 ? existingClassNames : [...SCHOOL_CLASSES];
    const classes = allClasses ? defaultClasses : (subjectData.classes || []);
    const seniorOnly = !allClasses && classes.length > 0 && classes.every((c: string) => isSeniorClass(c));
    const allDepartments = seniorOnly ? Boolean(subjectData.allDepartments) : true;
    const departments = seniorOnly
      ? (allDepartments ? [...SSS_DEPARTMENTS] : (subjectData.departments || []))
      : [...SSS_DEPARTMENTS];

    const newSub = {
      id: subjectData.id || `sub_${Date.now()}`,
      name: cleanName,
      allClasses,
      classes,
      allDepartments,
      departments
    };
    const { data, error } = await requireServerSupabase().from('subjects').insert({
      id: newSub.id,
      name: newSub.name,
      all_classes: newSub.allClasses,
      classes: newSub.classes,
      all_departments: newSub.allDepartments,
      departments: newSub.departments
    }).select('*').single();
    if (error) throw error;
    broadcastChange('subjects', 'created');
    return mapSubjectRow(data);
  },

  async updateSubject(id: string, updates: any) {
    const client = requireServerSupabase();
    const [{ data: existing, error: existingError }, classes] = await Promise.all([
      client.from('subjects').select('*').eq('id', id).maybeSingle(),
      this.getClasses()
    ]);
    if (existingError) throw existingError;
    if (!existing) return null;
    const existingSubject = mapSubjectRow(existing);
    const existingClassNames = classes.map((c: any) => c.name);
    const defaultClasses = existingClassNames.length > 0 ? existingClassNames : [...SCHOOL_CLASSES];
    const merged = { ...existingSubject, ...updates };
    const allClasses = Boolean(merged.allClasses);
    const subjectClasses = allClasses ? defaultClasses : (merged.classes || []);
    const seniorOnly = !allClasses && subjectClasses.length > 0 && subjectClasses.every((c: string) => isSeniorClass(c));
    const allDepartments = seniorOnly ? Boolean(merged.allDepartments) : true;
    const departments = seniorOnly
      ? (allDepartments ? [...SSS_DEPARTMENTS] : (merged.departments || []))
      : [...SSS_DEPARTMENTS];
    const { data, error } = await client.from('subjects').update({
      name: String(merged.name || '').trim(),
      all_classes: allClasses,
      classes: subjectClasses,
      all_departments: allDepartments,
      departments
    }).eq('id', id).select('*').single();
    if (error) throw error;
    broadcastChange('subjects', 'updated');
    return mapSubjectRow(data);
  },

  async deleteSubject(id: string) {
    const { data, error } = await requireServerSupabase()
      .from('subjects')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return false;
    broadcastChange('subjects', 'deleted');
    return true;
  },

  async getStudents(options?: {
    search?: string;
    class?: string;
    department?: string;
    subject?: string;
    status?: string;
    page?: number;
    limit?: number;
    allowedClasses?: string[];
  }) {
    const client = requireServerSupabase();
    const paginated = Boolean(options?.page || options?.limit);
    const requestedPage = Number(options?.page);
    const requestedLimit = Number(options?.limit);
    const page = paginated
      ? Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
      : undefined;
    const limit = paginated
      ? Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(100, requestedLimit) : 10
      : undefined;
    const buildQuery = () => {
      let query = client.from('students').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (options?.allowedClasses !== undefined) {
        query = options.allowedClasses.length
          ? query.in('class', options.allowedClasses)
          : query.eq('id', '');
      }
      if (options?.class && options.class !== 'all') {
        query = query.ilike('class', quotePostgrestSearch(options.class.trim()));
      }
      if (options?.department && options.department !== 'all') {
        query = query.ilike('department', quotePostgrestSearch(options.department.trim()));
      }
      if (options?.subject && options.subject !== 'all') {
        query = query.contains('enrolled_subjects', [options.subject.trim()]);
      }
      if (options?.status && options.status !== 'all') {
        query = query.ilike('status', quotePostgrestSearch(options.status.trim()));
      }
      if (options?.search?.trim()) {
        const pattern = `"%${quotePostgrestSearch(options.search.trim())}%"`;
        query = query.or([
          `name.ilike.${pattern}`,
          `admission_number.ilike.${pattern}`,
          `email.ilike.${pattern}`,
          `parent_name.ilike.${pattern}`,
          `parent_phone.ilike.${pattern}`,
          `class.ilike.${pattern}`
        ].join(','));
      }
      if (page !== undefined && limit !== undefined) {
        query = query.range((page - 1) * limit, page * limit - 1);
      }
      return query;
    };

    const { data, error, count } = await buildQuery();
    if (error) throw error;
    const records = (data || []).map(mapStudentRow);
    if (!paginated) return records;

    const { data: classRows, error: classError } = await client.from('students').select('class');
    if (classError) throw classError;
    const classCounts: Record<string, number> = {};
    for (const row of classRows || []) {
      if (row.class) classCounts[row.class] = (classCounts[row.class] || 0) + 1;
    }
    return {
      data: records,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit!),
      classCounts
    };
  },

  async getStudentDirectoryRecord(id: string) {
    const { data, error } = await requireServerSupabase()
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapStudentRow(data) : null;
  },

  async createStudentInDatabase(studentData: any) {
    const {
      password: rawPassword,
      portalPassword,
      portalCredentials: _ignoredCredentials,
      ...input
    } = studentData || {};
    const client = requireServerSupabase();
    const className = input.class || 'JSS 1';
    const { count, error: countError } = await client.from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class', className);
    if (countError) throw countError;
    const admissionNumber = input.admissionNumber || generateAdmissionNumber(className, Array(count || 0).fill({ class: className }));
    const email = String(input.email || `${admissionNumber.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@student.alamin.sch.ng`)
      .trim()
      .toLowerCase();
    const student = {
      id: input.id || `s_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      ...input,
      name: String(input.name || '').trim(),
      admissionNumber,
      class: className,
      department: isSeniorClass(className) ? input.department || 'Science' : '',
      email,
      attendanceRate: input.attendanceRate ?? 0,
      gpa: input.gpa || '0.00',
      status: input.status || 'active'
    };
    const { data: row, error } = await client.from('students')
      .insert({ id: student.id, ...toStudentDatabaseRow(student) })
      .select('*')
      .single();
    if (error) throw error;

    let provisioned;
    try {
      provisioned = await this.provisionPortalUserInDatabase({
        email,
        password: portalPassword || rawPassword,
        name: student.name,
        role: 'student',
        studentId: student.id
      });
    } catch (provisionError) {
      const { error: rollbackError } = await client.from('students').delete().eq('id', student.id);
      if (rollbackError) console.error('[Al-Amin Store] Failed to roll back student after portal account provisioning failed:', rollbackError.message);
      throw provisionError;
    }
    if ('error' in provisioned) {
      const { error: rollbackError } = await client.from('students').delete().eq('id', student.id);
      if (rollbackError) console.error('[Al-Amin Store] Failed to roll back student after portal account provisioning failed:', rollbackError.message);
      return provisioned;
    }
    broadcastChange('students', 'created');
    return {
      ...mapStudentRow(row),
      ...(provisioned.credentials ? { portalCredentials: provisioned.credentials } : {})
    };
  },

  async updateStudentInDatabase(id: string, updates: any) {
    const client = requireServerSupabase();
    const existing = await this.getStudentDirectoryRecord(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    const updatePayload = toStudentDatabaseRow(merged);
    const { data, error } = await client.from('students')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const nextEmail = String(merged.email || '').trim().toLowerCase();
    if (nextEmail && nextEmail !== existing.email) {
      const emailUpdate = await this.updatePortalAccountEmailInDatabase('student', id, nextEmail, merged.name);
      if (emailUpdate && 'error' in emailUpdate) {
        const { error: rollbackError } = await client.from('students')
          .update({ email: existing.email })
          .eq('id', id);
        if (rollbackError) console.error('[Al-Amin Store] Failed to restore student email after portal account update failed:', rollbackError.message);
        return emailUpdate;
      }
    }
    broadcastChange('students', 'updated');
    return mapStudentRow(data);
  },

  async enrollStudentSubjectInDatabase(studentId: string, subject: string) {
    const student = await this.getStudentDirectoryRecord(studentId);
    if (!student) return null;
    const enrolledSubjects = student.enrolledSubjects || [];
    if (enrolledSubjects.includes(subject)) return student;
    return this.updateStudentInDatabase(studentId, { enrolledSubjects: [...enrolledSubjects, subject] });
  },

  async deleteStudentFromDatabase(id: string) {
    const client = requireServerSupabase();
    const { data, error } = await client.from('students').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return false;
    const { error: userError } = await client.from('portal_users').delete().eq('student_id', id);
    if (userError) throw userError;
    broadcastChange('students', 'deleted');
    return true;
  },

  async getTeachers(options?: {
    search?: string;
    class?: string;
    subject?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const client = requireServerSupabase();
    const paginated = Boolean(options?.page || options?.limit);
    const requestedPage = Number(options?.page);
    const requestedLimit = Number(options?.limit);
    const page = paginated
      ? Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
      : undefined;
    const limit = paginated
      ? Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(100, requestedLimit) : 10
      : undefined;
    let matchingTeacherIds: string[] | undefined;
    if (options?.class && options.class !== 'all') {
      const className = options.class.trim();
      const [{ data: assignedTeachers, error: assignedError }, { data: classTeachers, error: classTeacherError }] = await Promise.all([
        client.from('teachers').select('id').contains('assigned_classes', [{ class: className }]),
        client.from('teachers').select('id').contains('class_teacher_of', [className])
      ]);
      if (assignedError) throw assignedError;
      if (classTeacherError) throw classTeacherError;
      matchingTeacherIds = [...new Set([
        ...(assignedTeachers || []).map((teacher) => teacher.id),
        ...(classTeachers || []).map((teacher) => teacher.id)
      ])];
    }
    const buildQuery = () => {
      let query = client.from('teachers').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (options?.status && options.status !== 'all') {
        query = query.ilike('status', quotePostgrestSearch(options.status.trim()));
      }
      if (matchingTeacherIds) {
        query = matchingTeacherIds.length
          ? query.in('id', matchingTeacherIds)
          : query.eq('id', '');
      }
      if (options?.subject && options.subject !== 'all') {
        query = query.contains('assigned_classes', [{ subject: options.subject.trim() }]);
      }
      if (options?.search?.trim()) {
        const pattern = `"%${quotePostgrestSearch(options.search.trim())}%"`;
        query = query.or([
          `name.ilike.${pattern}`,
          `staff_id.ilike.${pattern}`,
          `email.ilike.${pattern}`,
          `qualification.ilike.${pattern}`
        ].join(','));
      }
      if (page !== undefined && limit !== undefined) {
        query = query.range((page - 1) * limit, page * limit - 1);
      }
      return query;
    };
    const { data, error, count } = await buildQuery();
    if (error) throw error;
    const records = (data || []).map(mapTeacherRow);
    if (!paginated) return records;

    const [{ count: totalTeachers, error: totalError }, { count: activeTeachers, error: activeError }, { data: allocationRows, error: allocationError }] = await Promise.all([
      client.from('teachers').select('id', { count: 'exact', head: true }),
      client.from('teachers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      client.from('teachers').select('assigned_classes')
    ]);
    if (totalError) throw totalError;
    if (activeError) throw activeError;
    if (allocationError) throw allocationError;
    const totalAllocations = (allocationRows || []).reduce(
      (total, teacher) => total + (Array.isArray(teacher.assigned_classes) ? teacher.assigned_classes.length : 0),
      0
    );
    return {
      data: records,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit!),
      stats: { totalTeachers: totalTeachers || 0, activeTeachers: activeTeachers || 0, totalAllocations }
    };
  },

  async getTeacherDirectoryRecord(id: string) {
    const { data, error } = await requireServerSupabase()
      .from('teachers')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapTeacherRow(data) : null;
  },

  async getTeacherDirectoryRecordByEmailOrId(email?: string, teacherId?: string) {
    const client = requireServerSupabase();
    if (teacherId) {
      const byId = await this.getTeacherDirectoryRecord(teacherId);
      if (byId) return byId;
    }
    if (!email) return null;
    const { data, error } = await client.from('teachers')
      .select('*')
      .ilike('email', quotePostgrestSearch(email.trim()))
      .maybeSingle();
    if (error) throw error;
    return data ? mapTeacherRow(data) : null;
  },

  async createTeacherInDatabase(teacherData: any) {
    const {
      password: rawPassword,
      portalPassword,
      portalCredentials: _ignoredCredentials,
      ...input
    } = teacherData || {};
    const client = requireServerSupabase();
    const { count, error: countError } = await client.from('teachers')
      .select('id', { count: 'exact', head: true });
    if (countError) throw countError;
    const staffId = input.staffId || `ASS/staff/${String((count || 0) + 1).padStart(3, '0')}`;
    const email = String(input.email || `${staffId.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@staff.alamin.sch.ng`)
      .trim()
      .toLowerCase();
    const teacher = {
      id: input.id || `t_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      ...input,
      name: String(input.name || '').trim(),
      staffId,
      email,
      status: input.status || 'active',
      assignedClasses: Array.isArray(input.assignedClasses) ? input.assignedClasses : [],
      classTeacherOf: Array.isArray(input.classTeacherOf) ? input.classTeacherOf : []
    };
    const { data: row, error } = await client.from('teachers')
      .insert({ id: teacher.id, ...toTeacherDatabaseRow(teacher) })
      .select('*')
      .single();
    if (error) throw error;

    let provisioned;
    try {
      provisioned = await this.provisionPortalUserInDatabase({
        email,
        password: portalPassword || rawPassword,
        name: teacher.name,
        role: 'teacher',
        teacherId: teacher.id
      });
    } catch (provisionError) {
      const { error: rollbackError } = await client.from('teachers').delete().eq('id', teacher.id);
      if (rollbackError) console.error('[Al-Amin Store] Failed to roll back teacher after portal account provisioning failed:', rollbackError.message);
      throw provisionError;
    }
    if ('error' in provisioned) {
      const { error: rollbackError } = await client.from('teachers').delete().eq('id', teacher.id);
      if (rollbackError) console.error('[Al-Amin Store] Failed to roll back teacher after portal account provisioning failed:', rollbackError.message);
      return provisioned;
    }
    broadcastChange('teachers', 'created');
    return {
      ...mapTeacherRow(row),
      ...(provisioned.credentials ? { portalCredentials: provisioned.credentials } : {})
    };
  },

  async updateTeacherInDatabase(id: string, updates: any) {
    const client = requireServerSupabase();
    const existing = await this.getTeacherDirectoryRecord(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    const { data, error } = await client.from('teachers')
      .update(toTeacherDatabaseRow(merged))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const nextEmail = String(merged.email || '').trim().toLowerCase();
    if (nextEmail && nextEmail !== existing.email) {
      const emailUpdate = await this.updatePortalAccountEmailInDatabase('teacher', id, nextEmail, merged.name);
      if (emailUpdate && 'error' in emailUpdate) {
        const { error: rollbackError } = await client.from('teachers')
          .update({ email: existing.email })
          .eq('id', id);
        if (rollbackError) console.error('[Al-Amin Store] Failed to restore teacher email after portal account update failed:', rollbackError.message);
        return emailUpdate;
      }
    }
    broadcastChange('teachers', 'updated');
    return mapTeacherRow(data);
  },

  async setPortalCredentialsInDatabase(
    role: 'teacher' | 'student',
    entityId: string,
    emailInput?: string,
    passwordInput?: string
  ) {
    const entity = role === 'student'
      ? await this.getStudentDirectoryRecord(entityId)
      : await this.getTeacherDirectoryRecord(entityId);
    if (!entity) return null;
    const email = String(emailInput || entity.email || '').trim().toLowerCase();
    if (!email) return { error: 'Email address is required to provision portal credentials.' };

    if (email !== entity.email) {
      const update = role === 'student'
        ? await this.updateStudentInDatabase(entityId, { email })
        : await this.updateTeacherInDatabase(entityId, { email });
      if (!update) return null;
      if ('error' in update) return update;
    }
    return this.provisionPortalUserInDatabase({
      email,
      password: passwordInput,
      name: entity.name,
      role,
      studentId: role === 'student' ? entityId : undefined,
      teacherId: role === 'teacher' ? entityId : undefined
    });
  },

  async assignTeacherClassInDatabase(teacherId: string, classSubject: { class: string; subject: string }) {
    const teacher = await this.getTeacherDirectoryRecord(teacherId);
    if (!teacher) return null;
    const assignedClasses = teacher.assignedClasses || [];
    if (assignedClasses.some((item: any) => item.class === classSubject.class && item.subject === classSubject.subject)) {
      return teacher;
    }
    return this.updateTeacherInDatabase(teacherId, {
      assignedClasses: [...assignedClasses, classSubject]
    });
  },

  async removeTeacherClassInDatabase(teacherId: string, classSubject: any) {
    const teacher = await this.getTeacherDirectoryRecord(teacherId);
    if (!teacher) return null;
    const targetClass = typeof classSubject === 'object' && classSubject
      ? classSubject.class || classSubject.className || ''
      : String(classSubject || '');
    const targetSubject = typeof classSubject === 'object' && classSubject
      ? classSubject.subject || classSubject.subjectName || ''
      : '';
    const assignedClasses = (teacher.assignedClasses || []).filter(
      (item: any) => !(item.class === targetClass && (!targetSubject || item.subject === targetSubject))
    );
    return this.updateTeacherInDatabase(teacherId, { assignedClasses });
  },

  async deleteTeacherFromDatabase(id: string) {
    const client = requireServerSupabase();
    const teacher = await this.getTeacherDirectoryRecord(id);
    if (!teacher) return false;
    const { error: classError } = await client.from('classes')
      .update({ class_teacher_id: '', class_teacher_name: '' })
      .eq('class_teacher_id', id);
    if (classError) throw classError;
    const { data, error } = await client.from('teachers')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return false;
    const { error: userError } = await client.from('portal_users').delete().eq('teacher_id', id);
    if (userError) throw userError;
    broadcastChange('teachers', 'deleted');
    broadcastChange('classes', 'updated');
    return true;
  },

  async getTimetableSlots(className?: string) {
    const client = requireServerSupabase();
    const queries = className
      ? [
        client.from('timetable_slots').select('*').eq('class', className),
        client.from('timetable_slots').select('*').eq('class', 'All Classes')
      ]
      : [client.from('timetable_slots').select('*')];
    const results = await Promise.all(queries);
    const failed = results.find(({ error }) => error);
    if (failed?.error) throw failed.error;
    return results.flatMap(({ data }) => mapDatabaseRows(data))
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  },

  async addTimetableSlot(slotData: any) {
    const defaultCls = await this.getDefaultClassName();
    const newSlot = {
      id: slotData.id || `tt_${Date.now()}`,
      type: 'lesson',
      class: slotData.class || defaultCls,
      ...slotData,
      updatedAt: new Date().toISOString()
    };
    const { data, error } = await requireServerSupabase().from('timetable_slots')
      .insert({
        ...toDatabaseRow(newSlot),
        title: newSlot.title || newSlot.subject || ''
      })
      .select('*')
      .single();
    if (error) throw error;
    broadcastChange('timetable_slots', 'created');
    return mapDatabaseRow(data);
  },

  async updateTimetableSlot(id: string, patch: any) {
    const { data, error } = await requireServerSupabase().from('timetable_slots')
      .update({
        ...toDatabaseRow({ ...patch, updatedAt: new Date().toISOString() }),
        ...(patch.title === undefined && patch.subject !== undefined ? { title: patch.subject } : {})
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    broadcastChange('timetable_slots', 'updated');
    return mapDatabaseRow(data);
  },

  async deleteTimetableSlot(id: string) {
    const { data, error } = await requireServerSupabase().from('timetable_slots')
      .delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return false;
    broadcastChange('timetable_slots', 'deleted');
    return true;
  },

  async rescheduleTeacherSlot(
    slotId: string,
    targetDay: string,
    targetStartTime: string,
    targetEndTime: string,
    actorTeacherName: string
  ) {
    const allSlots = await this.getTimetableSlots();
    const targetSlot = allSlots.find((s) => s.id === slotId);
    if (!targetSlot) return { success: false, message: 'Class period not found.' };

    const fixedBlock = allSlots.find(
      (s) =>
        s.id !== slotId &&
        s.day === targetDay &&
        s.class === 'All Classes' &&
        (s.type === 'break' || s.type === 'solat') &&
        slotsOverlap(s.startTime, s.endTime, targetStartTime, targetEndTime)
    );

    if (fixedBlock) {
      return {
        success: false,
        message: `Cannot schedule over ${fixedBlock.title} (${fixedBlock.startTime} – ${fixedBlock.endTime}).`
      };
    }

    const oldDay = targetSlot.day;
    const oldStart = targetSlot.startTime;
    const oldEnd = targetSlot.endTime;

    const occupiedLesson = allSlots.find(
      (s) =>
        s.id !== slotId &&
        s.day === targetDay &&
        s.class === targetSlot.class &&
        s.type === 'lesson' &&
        slotsOverlap(s.startTime, s.endTime, targetStartTime, targetEndTime)
    );

    const changedSlots: any[] = [];
    const affectedTeacher = occupiedLesson ? occupiedLesson.teacherName : null;

    allSlots.forEach((s) => {
      if (s.id === slotId) {
        const next = {
          ...s,
          day: targetDay,
          startTime: targetStartTime,
          endTime: targetEndTime,
          updatedBy: actorTeacherName,
          updatedAt: new Date().toISOString()
        };
        changedSlots.push(next);
        return;
      }
      if (occupiedLesson && s.id === occupiedLesson.id) {
        const next = {
          ...s,
          day: oldDay,
          startTime: oldStart,
          endTime: oldEnd,
          updatedBy: actorTeacherName,
          updatedAt: new Date().toISOString()
        };
        changedSlots.push(next);
        return;
      }
    });

    const timestamp = new Date().toISOString();
    const baseMsg = occupiedLesson
      ? `${actorTeacherName} rescheduled ${targetSlot.class} ${targetSlot.subject} from ${oldDay} (${oldStart}–${oldEnd}) to ${targetDay} (${targetStartTime}–${targetEndTime}), swapping with ${occupiedLesson.teacherName} (${occupiedLesson.subject}).`
      : `${actorTeacherName} rescheduled ${targetSlot.class} ${targetSlot.subject} from ${oldDay} (${oldStart}–${oldEnd}) to ${targetDay} (${targetStartTime}–${targetEndTime}).`;

    const newAlerts: any[] = [
      {
        id: `al_adm_${Date.now()}`,
        role: 'admin',
        targetClass: targetSlot.class,
        title: 'Teacher Timetable Update',
        message: baseMsg,
        createdAt: timestamp,
        read: false
      },
      {
        id: `al_stu_${Date.now() + 1}`,
        role: 'student',
        targetClass: targetSlot.class,
        title: `${targetSlot.class} Time Table Updated`,
        message: baseMsg,
        createdAt: timestamp,
        read: false
      }
    ];

    if (occupiedLesson && occupiedLesson.teacherName && occupiedLesson.teacherName !== actorTeacherName) {
      newAlerts.push({
        id: `al_tch_${Date.now() + 2}`,
        role: 'teacher',
        targetTeacher: occupiedLesson.teacherName,
        targetClass: targetSlot.class,
        title: 'Class Period Swapped / Rescheduled',
        message: `${actorTeacherName} moved ${targetSlot.class} ${targetSlot.subject} into ${targetDay} (${targetStartTime}–${targetEndTime}); your ${occupiedLesson.subject} class moved to ${oldDay} (${oldStart}–${oldEnd}).`,
        createdAt: timestamp,
        read: false
      });
    }

    const client = requireServerSupabase();
    const slotUpdates = await Promise.all(changedSlots.map((slot) => client.from('timetable_slots')
      .update({
        day: slot.day,
        start_time: slot.startTime,
        end_time: slot.endTime,
        updated_by: slot.updatedBy,
        updated_at: slot.updatedAt
      })
      .eq('id', slot.id)));
    const failedSlotUpdate = slotUpdates.find(({ error }) => error);
    if (failedSlotUpdate?.error) throw failedSlotUpdate.error;
    const { error: alertError } = await client.from('timetable_alerts').insert(newAlerts.map((alert) => ({
      id: alert.id,
      role: alert.role,
      target_class: alert.targetClass || '',
      target_teacher: alert.targetTeacher || '',
      title: alert.title,
      message: alert.message,
      read: alert.read,
      created_at: alert.createdAt
    })));
    if (alertError) throw alertError;
    broadcastChange('timetable_slots', 'updated');
    broadcastChange('timetable_alerts', 'created');

    return {
      success: true,
      wasOccupied: Boolean(occupiedLesson),
      affectedTeacher,
      message: baseMsg,
      alerts: newAlerts
    };
  },

  async getAlerts(role?: string) {
    let query = requireServerSupabase().from('timetable_alerts').select('*').order('created_at', { ascending: false });
    if (role) query = query.in('role', [role, 'all']);
    const { data, error } = await query;
    if (error) throw error;
    return mapDatabaseRows(data).map((alert) => ({
      ...alert,
      targetRole: alert.role,
      targetClass: alert.targetClass,
      targetTeacher: alert.targetTeacher
    }));
  },

  async dismissAlert(id: string) {
    const { data, error } = await requireServerSupabase().from('timetable_alerts')
      .delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return false;
    broadcastChange('timetable_alerts', 'deleted');
    return true;
  },

  async getAttendance(date?: string, className?: string) {
    let query = requireServerSupabase().from('attendance_records').select('*');
    if (date) query = query.eq('date', date);
    if (className) query = query.eq('class_name', className);
    const { data, error } = await query.order('date', { ascending: false });
    if (error) throw error;
    return Object.fromEntries((data || []).map((row) => [row.record_key, {
      date: row.date,
      className: row.class_name,
      submittedBy: row.submitted_by,
      timestamp: row.timestamp_label,
      records: row.records || {}
    }]));
  },

  async saveClassAttendance(date: string, className: string, submittedBy: string, records: Record<string, any>) {
    const key = `${date}_${className}`;
    const client = requireServerSupabase();
    const { data: classStudents, error: studentsError } = await client.from('students')
      .select('id')
      .eq('class', className);
    if (studentsError) throw studentsError;
    const binaryRecords: Record<string, 'present' | 'absent'> = {};

    (classStudents || []).forEach((student) => {
      const val = records ? records[student.id] : undefined;
      const isPresent = val === 'present' || val === true || val === 'Present' || val === 1;
      binaryRecords[student.id] = isPresent ? 'present' : 'absent';
    });

    if (records) {
      Object.entries(records).forEach(([id, val]) => {
        if (!(id in binaryRecords)) {
          const isPresent = val === 'present' || val === true || val === 'Present' || val === 1;
          binaryRecords[id] = isPresent ? 'present' : 'absent';
        }
      });
    }

    const entry = {
      date,
      className,
      submittedBy,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      records: binaryRecords
    };
    const { error } = await client.from('attendance_records').upsert({
      record_key: key,
      date,
      class_name: className,
      submitted_by: submittedBy,
      timestamp_label: entry.timestamp,
      records: entry.records,
      updated_at: new Date().toISOString()
    }, { onConflict: 'record_key' });
    if (error) throw error;

    const { data: attendanceRows, error: attendanceError } = await client.from('attendance_records')
      .select('records')
      .eq('class_name', className);
    if (attendanceError) throw attendanceError;
    const rates = (classStudents || []).map((student) => {
      const history = (attendanceRows || []).map((row) => row.records?.[student.id]).filter(Boolean);
      const present = history.filter((status) => status === 'present' || status === true || status === 'Present').length;
      return client.from('students').update({
        attendance_rate: history.length ? Math.round((present / history.length) * 100) : 0
      }).eq('id', student.id);
    });
    const rateResults = await Promise.all(rates);
    const failedRateUpdate = rateResults.find(({ error: updateError }) => updateError);
    if (failedRateUpdate?.error) throw failedRateUpdate.error;

    broadcastChange('attendance_records', 'updated');
    return entry;
  },

  async getStudentAttendanceHistory(studentId: string) {
    const student = await this.getStudentDirectoryRecord(studentId);
    if (!student) return {
      student: null, logs: [], totalDays: 0, presentCount: 0, lateCount: 0,
      absentCount: 0, attendanceRate: 0, punctualityRate: 0
    };
    const { data, error } = await requireServerSupabase().from('attendance_records')
      .select('date,class_name,submitted_by,timestamp_label,records')
      .eq('class_name', student.class)
      .order('date', { ascending: false });
    if (error) throw error;
    const logs: any[] = [];
    (data || []).forEach((entry) => {
      if (entry.records && entry.records[studentId]) {
        const rawStatus = entry.records[studentId];
        const status = (rawStatus === 'present' || rawStatus === true || rawStatus === 'Present') ? 'present' : 'absent';
        logs.push({
          date: entry.date,
          className: entry.class_name,
          status,
          submittedBy: entry.submitted_by,
          timestamp: entry.timestamp_label
        });
      }
    });
    logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const total = logs.length;
    const presentCount = logs.filter((l) => l.status === 'present').length;
    const absentCount = logs.filter((l) => l.status === 'absent').length;
    const rate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    return {
      student,
      logs,
      totalDays: total,
      presentCount,
      lateCount: 0,
      absentCount,
      attendanceRate: rate,
      punctualityRate: rate
    };
  },

  async getGrades(studentIds?: string[]) {
    if (studentIds && studentIds.length === 0) return {};
    let query = requireServerSupabase().from('grades').select('*');
    if (studentIds) query = query.in('student_id', studentIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).reduce((result: Record<string, any>, row) => {
      const key = `${row.student_id}_${row.session}_${row.term}_${row.subject}`;
      result[row.student_id] ||= {};
      result[row.student_id][key] = {
        ca1: Number(row.ca1),
        ca2: Number(row.ca2),
        exam: Number(row.exam),
        total: Number(row.total),
        grade: row.grade,
        remark: row.remark,
        session: row.session,
        term: row.term,
        subject: row.subject
      };
      return result;
    }, {});
  },

  async saveGrade(studentId: string, term: string, subject: string, gradeEntry: any, session = '2026/2027') {
    const key = `${studentId}_${session}_${term}_${subject}`;
    const ca1 = Number(gradeEntry.ca1 || 0);
    const ca2 = Number(gradeEntry.ca2 || 0);
    const exam = Number(gradeEntry.exam || 0);
    const total = ca1 + ca2 + exam;
    const computed = computeGrade(total);
    const entry = {
      ca1,
      ca2,
      exam,
      total,
      grade: computed.grade,
      remark: String(gradeEntry.remark || '').trim() || computed.remark,
      session,
      term
    };
    const { error } = await requireServerSupabase().from('grades').upsert({
      grade_key: key,
      student_id: studentId,
      session,
      term,
      subject,
      ca1,
      ca2,
      exam,
      total,
      grade: entry.grade,
      remark: entry.remark,
      updated_at: new Date().toISOString()
    }, { onConflict: 'grade_key' });
    if (error) throw error;
    broadcastChange('grades', 'updated');
    return entry;
  },

  async getStudentSubjectGrade(studentId: string, term: string, subject: string, session = '2026/2027') {
    const sessionKey = `${studentId}_${session}_${term}_${subject}`;
    const { data, error } = await requireServerSupabase().from('grades')
      .select('ca1,ca2,exam,total,grade,remark,session,term')
      .eq('grade_key', sessionKey)
      .maybeSingle();
    if (error) throw error;
    if (data) return {
      ca1: Number(data.ca1), ca2: Number(data.ca2), exam: Number(data.exam),
      total: Number(data.total), grade: data.grade, remark: data.remark,
      session: data.session, term: data.term, isRecorded: true
    };

    return {
      ca1: 0,
      ca2: 0,
      exam: 0,
      total: 0,
      grade: '-',
      remark: 'Not Graded',
      isRecorded: false
    };
  },

  async getStudentReportCard(studentId: string, term = 'Term1', session = '2026/2027') {
    const rawStudent = await this.getStudentDirectoryRecord(studentId);
    if (!rawStudent) return null;
    const student = {
      ...rawStudent,
      dateOfBirth: rawStudent.dateOfBirth || rawStudent.dob || 'Not Provided'
    };
    const validClassSubjects = await this.getSubjectsForClass(student.class, student.department);
    const subjects = (student.enrolledSubjects && student.enrolledSubjects.length > 0)
      ? student.enrolledSubjects.filter((s: string) => validClassSubjects.includes(s))
      : validClassSubjects.slice(0, 6);
    const effectiveSubjects = subjects.length > 0 ? subjects : validClassSubjects.slice(0, 6);

    const client = requireServerSupabase();
    const { data: classStudents, error: studentsError } = await client.from('students')
      .select('id')
      .eq('class', student.class);
    if (studentsError) throw studentsError;
    const classStudentIds = (classStudents || []).map((item) => item.id);
    const gradeRows = classStudentIds.length
      ? await client.from('grades').select('student_id,subject,ca1,ca2,exam,total,grade,remark')
        .in('student_id', classStudentIds)
        .eq('session', session)
        .eq('term', term)
      : { data: [], error: null };
    if (gradeRows.error) throw gradeRows.error;
    const scoreMap = new Map<string, any>();
    (gradeRows.data || []).forEach((row) => scoreMap.set(`${row.student_id}_${row.subject}`, {
      ca1: Number(row.ca1), ca2: Number(row.ca2), exam: Number(row.exam),
      total: Number(row.total), grade: row.grade, remark: row.remark, isRecorded: true
    }));
    const scoreFor = (id: string, subjectName: string) => scoreMap.get(`${id}_${subjectName}`) || {
      ca1: 0, ca2: 0, exam: 0, total: 0, grade: '-', remark: 'Not Graded', isRecorded: false
    };
    const subjectScores = effectiveSubjects.map((sub: string) => {
      const score = scoreFor(studentId, sub);
      let position = '-';
      if (score.total > 0 && classStudentIds.length > 0) {
        const totals = classStudentIds
          .map((id) => scoreFor(id, sub).total)
          .sort((a, b) => b - a);
        const rankNum = Math.max(1, totals.indexOf(score.total) + 1);
        const suffix = rankNum === 1 ? 'st' : rankNum === 2 ? 'nd' : rankNum === 3 ? 'rd' : 'th';
        position = `${rankNum}${suffix}`;
      }
      return { subject: sub, ...score, position };
    });

    const recordedScores = subjectScores.filter((r: any) => r.total > 0 || r.isRecorded);
    const totalObtained = subjectScores.reduce((sum: number, r: any) => sum + r.total, 0);
    const maxTotal = subjectScores.length * 100;
    const average = recordedScores.length > 0 ? (totalObtained / recordedScores.length).toFixed(1) : '0.0';
    const att = await this.getStudentAttendanceHistory(studentId);
    const avgNum = parseFloat(average);
    const overallRemark =
      recordedScores.length === 0
        ? 'Pending Assessment'
        : avgNum >= 75
        ? 'Distinction'
        : avgNum >= 65
        ? 'Very Good'
        : avgNum >= 50
        ? 'Credit Pass'
        : 'Needs Improvement';
    const termLabelMap: Record<string, string> = {
      Term1: 'First Term',
      Term2: 'Second Term',
      Term3: 'Third Term'
    };

    let position = '-';
    if (recordedScores.length > 0 && classStudentIds.length > 0) {
      const cohortTotals = classStudentIds
        .map((id) =>
          effectiveSubjects.reduce(
            (sum: number, sub: string) => sum + scoreFor(id, sub).total,
            0
          )
        )
        .sort((a, b) => b - a);
      const rankNum = Math.max(1, cohortTotals.indexOf(totalObtained) + 1);
      const suffix = rankNum === 1 ? 'st' : rankNum === 2 ? 'nd' : rankNum === 3 ? 'rd' : 'th';
      position = `${rankNum}${suffix} out of ${classStudentIds.length}`;
    }

    return {
      student,
      term: termLabelMap[term] || term,
      termKey: term,
      session,
      subjectScores,
      subjectRows: subjectScores,
      totalObtained,
      totalScore: totalObtained,
      maxTotal,
      maxObtainable: maxTotal,
      average,
      position,
      overallRemark,
      daysSchoolOpened: att.totalDays,
      daysPresent: att.presentCount + att.lateCount,
      attendance: att,
      classTeacherRemark:
        recordedScores.length > 0
          ? `${student.name} has recorded assessments across ${recordedScores.length} subject(s) in ${student.class}.`
          : 'No assessment grades have been recorded for this term yet.',
      principalRemark:
        recordedScores.length > 0
          ? 'Keep striving for academic excellence and good character.'
          : 'Pending completion of term continuous assessments and examinations.',
      nextTermBegins: 'Monday, 12th January 2027'
    };
  },

  async getResources() {
    const { data, error } = await requireServerSupabase().from('resources').select('*').order('upload_date', { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => ({
      ...mapDatabaseRow(row),
      allClasses: (row.classes || []).includes('All Classes'),
      classes: row.classes || ['All Classes']
    }));
  },

  async addResource(data: any) {
    const newItem = {
      id: data.id || `res_${Date.now()}`,
      uploadDate: new Date().toISOString().split('T')[0],
      downloads: 0,
      status: 'active',
      ...data
    };
    const { data: row, error } = await requireServerSupabase().from('resources')
      .insert({
        id: newItem.id,
        title: newItem.title,
        type: newItem.type || 'document',
        subject: newItem.subject || '',
        description: newItem.description || '',
        classes: newItem.classes || ['All Classes'],
        access_level: newItem.accessLevel || 'students',
        file_name: newItem.fileName || '',
        file_size: newItem.fileSize || '',
        file_path: newItem.filePath || '',
        file_url: newItem.fileUrl || '',
        uploaded_by: newItem.uploadedBy || '',
        upload_date: newItem.uploadDate,
        downloads: newItem.downloads,
        status: newItem.status
      })
      .select('*')
      .single();
    if (error) throw error;
    broadcastChange('resources', 'created');
    return { ...mapDatabaseRow(row), allClasses: (row.classes || []).includes('All Classes') };
  },

  async updateResource(id: string, patch: any) {
    const payload = toDatabaseRow(patch);
    delete payload.all_classes;
    const { data, error } = await requireServerSupabase().from('resources')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    broadcastChange('resources', 'updated');
    return { ...mapDatabaseRow(data), allClasses: (data.classes || []).includes('All Classes') };
  },

  async deleteResource(id: string) {
    const { data, error } = await requireServerSupabase().from('resources')
      .delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return false;
    broadcastChange('resources', 'deleted');
    return true;
  },

  async getEquipment(search = '', page?: number, limit?: number) {
    const client = requireServerSupabase();
    const escapedSearch = search.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const buildQuery = (requestedPage = page) => {
      let query = client.from('equipment').select('*', { count: 'exact' }).order('name', { ascending: true });
      if (search) {
        const pattern = `"%${escapedSearch}%"`;
        query = query.or(`name.ilike.${pattern},category.ilike.${pattern},location.ilike.${pattern}`);
      }
      if (requestedPage !== undefined && limit !== undefined) {
        query = query.range((requestedPage - 1) * limit, requestedPage * limit - 1);
      }
      return query;
    };

    let { data, error, count } = await buildQuery();
    if (error) throw error;

    if (page !== undefined && limit !== undefined && count !== null) {
      const totalPages = Math.ceil(count / limit);
      const lastPage = Math.max(totalPages, 1);
      const normalizedPage = Math.min(page, lastPage);
      if (normalizedPage !== page) {
        ({ data, error } = await buildQuery(normalizedPage));
        if (error) throw error;
        page = normalizedPage;
      }
    }

    return { data: (data || []).map(mapEquipmentRow), total: count || 0, page, limit };
  },

  async addEquipment(data: any) {
    const newItem = {
      id: data.id || `eq_${Date.now()}`,
      addedDate: new Date().toISOString().split('T')[0],
      available: Number(data.available ?? data.quantity ?? 1),
      quantity: Number(data.quantity ?? 1),
      ...data
    };
    const { data: row, error } = await requireServerSupabase().from('equipment').insert({
      id: newItem.id,
      name: newItem.name,
      category: newItem.category || 'Laboratory',
      quantity: newItem.quantity,
      available: newItem.available,
      location: newItem.location || '',
      condition: newItem.condition || 'Good',
      added_date: newItem.addedDate
    }).select('*').single();
    if (error) throw error;
    broadcastChange('equipment', 'created');
    return mapEquipmentRow(row);
  },

  async deleteEquipment(id: string) {
    const { data, error } = await requireServerSupabase()
      .from('equipment')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return false;
    broadcastChange('equipment', 'deleted');
    return true;
  },

  async getMaintenance(search = '', page?: number, limit?: number) {
    const client = requireServerSupabase();
    const escapedSearch = search.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    let query = client.from('maintenance_requests').select('*', { count: 'exact' })
      .order('reported_date', { ascending: false });
    if (search) {
      query = query.or(`item_name.ilike."%${escapedSearch}%",issue.ilike."%${escapedSearch}%"`);
    }
    if (page !== undefined && limit !== undefined) {
      query = query.range((page - 1) * limit, page * limit - 1);
    }
    let { data, error, count } = await query;
    if (error) throw error;
    if (page !== undefined && limit !== undefined && count !== null) {
      const normalizedPage = Math.min(page, Math.max(Math.ceil(count / limit), 1));
      if (normalizedPage !== page) {
        let retry = client.from('maintenance_requests').select('*', { count: 'exact' })
          .order('reported_date', { ascending: false });
        if (search) {
          retry = retry.or(`item_name.ilike."%${escapedSearch}%",issue.ilike."%${escapedSearch}%"`);
        }
        ({ data, error } = await retry.range((normalizedPage - 1) * limit, normalizedPage * limit - 1));
        if (error) throw error;
        page = normalizedPage;
      }
    }
    const { count: openCount, error: countError } = await client
      .from('maintenance_requests')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'completed');
    if (countError) throw countError;
    return { data: (data || []).map(mapMaintenanceRow), total: count || 0, openCount: openCount || 0, page, limit };
  },

  async addMaintenance(data: any) {
    const newItem = {
      id: data.id || `mnt_${Date.now()}`,
      reportedDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      ...data
    };
    const { data: row, error } = await requireServerSupabase().from('maintenance_requests').insert({
      id: newItem.id,
      item_name: newItem.itemName,
      issue: newItem.issue || '',
      priority: newItem.priority || 'medium',
      status: newItem.status,
      reported_date: newItem.reportedDate,
      reported_by: newItem.reportedBy || ''
    }).select('*').single();
    if (error) throw error;
    broadcastChange('maintenance_requests', 'created');
    return mapMaintenanceRow(row);
  },

  async updateMaintenanceStatus(id: string, status: string) {
    const { data, error } = await requireServerSupabase().from('maintenance_requests')
      .update({ status })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    broadcastChange('maintenance_requests', 'updated');
    return mapMaintenanceRow(data);
  },

  async getDocuments() {
    const { data, error } = await requireServerSupabase().from('documents').select('*').order('upload_date', { ascending: false });
    if (error) throw error;
    return mapDatabaseRows(data);
  },

  async addDocument(data: any) {
    const newDoc = {
      id: data.id || `doc_${Date.now()}`,
      uploadDate: new Date().toISOString().split('T')[0],
      downloads: 0,
      status: 'active',
      allowedClasses: ['All Classes'],
      accessLevel: 'all',
      ...data
    };
    const { data: row, error } = await requireServerSupabase().from('documents').insert({
      id: newDoc.id,
      name: newDoc.name,
      category: newDoc.category || 'Policy & Handbook',
      type: newDoc.type || 'PDF',
      size: newDoc.size || '',
      file_name: newDoc.fileName || '',
      file_path: newDoc.filePath || '',
      file_url: newDoc.fileUrl || '',
      folder_id: newDoc.folderId || newDoc.category || '',
      access_level: newDoc.accessLevel,
      allowed_classes: newDoc.allowedClasses,
      description: newDoc.description || '',
      uploaded_by: newDoc.uploadedBy || '',
      upload_date: newDoc.uploadDate,
      downloads: newDoc.downloads,
      status: newDoc.status
    }).select('*').single();
    if (error) throw error;
    broadcastChange('documents', 'created');
    return mapDatabaseRow(row);
  },

  async updateDocumentAccess(id: string, accessLevel: string, allowedClasses = ['All Classes']) {
    const { data, error } = await requireServerSupabase().from('documents')
      .update({ access_level: accessLevel, allowed_classes: allowedClasses })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    broadcastChange('documents', 'updated');
    return mapDatabaseRow(data);
  },

  async deleteDocument(id: string) {
    const { data, error } = await requireServerSupabase().from('documents').delete()
      .eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return false;
    broadcastChange('documents', 'deleted');
    return true;
  },

  async getAnnouncements() {
    const { data, error } = await requireServerSupabase().from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => ({
      ...mapDatabaseRow(row),
      targetAudiences: row.target_audiences || ['Everyone']
    }));
  },

  async addAnnouncement(data: any) {
    const newAnn = {
      id: data.id || `ann_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      views: 0,
      status: 'published',
      isPinned: false,
      attachments: [],
      targetAudiences: ['Everyone'],
      ...data
    };
    const { data: row, error } = await requireServerSupabase().from('announcements').insert({
      id: newAnn.id,
      title: newAnn.title,
      content: newAnn.content,
      type: newAnn.type || 'general',
      priority: newAnn.priority || 'medium',
      author: newAnn.author || '',
      author_role: newAnn.authorRole || '',
      date: newAnn.date,
      event_date: newAnn.eventDate || '',
      event_time: newAnn.eventTime || '',
      location: newAnn.location || '',
      is_pinned: newAnn.isPinned,
      status: newAnn.status,
      target_audiences: newAnn.targetAudiences,
      attachments: newAnn.attachments,
      views: newAnn.views
    }).select('*').single();
    if (error) throw error;
    broadcastChange('announcements', 'created');
    return { ...mapDatabaseRow(row), targetAudiences: row.target_audiences || ['Everyone'] };
  },

  async updateAnnouncement(id: string, patch: any) {
    const payload = toDatabaseRow(patch);
    if (patch.targetAudience !== undefined && patch.targetAudiences === undefined) {
      payload.target_audiences = patch.targetAudience;
      delete payload.target_audience;
    }
    const { data, error } = await requireServerSupabase().from('announcements')
      .update(payload).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return null;
    broadcastChange('announcements', 'updated');
    return { ...mapDatabaseRow(data), targetAudiences: data.target_audiences || ['Everyone'] };
  },

  async deleteAnnouncement(id: string) {
    const { data, error } = await requireServerSupabase().from('announcements').delete()
      .eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return false;
    broadcastChange('announcements', 'deleted');
    return true;
  },

  async getTeacherAvailability(teacherId?: string) {
    let query = requireServerSupabase().from('teacher_availability').select('*').order('day').order('start_time');
    if (teacherId) query = query.eq('teacher_id', teacherId);
    const { data, error } = await query;
    if (error) throw error;
    return mapDatabaseRows(data);
  },

  async addTeacherAvailabilitySlot(slot: any) {
    const newSlot = {
      id: slot.id || `av_${Date.now()}`,
      isAvailable: true,
      ...slot
    };
    const { data, error } = await requireServerSupabase().from('teacher_availability').insert({
      id: newSlot.id,
      teacher_id: newSlot.teacherId || '',
      teacher_name: newSlot.teacherName || '',
      day: newSlot.day || 'Monday',
      start_time: newSlot.startTime || '14:20',
      end_time: newSlot.endTime || '15:50',
      is_available: Boolean(newSlot.isAvailable),
      note: newSlot.note || ''
    }).select('*').single();
    if (error) throw error;
    broadcastChange('teacher_availability', 'created');
    return mapDatabaseRow(data);
  },

  async toggleTeacherAvailabilitySlot(id: string, teacherId?: string) {
    const client = requireServerSupabase();
    let lookup = client.from('teacher_availability').select('is_available').eq('id', id);
    if (teacherId) lookup = lookup.eq('teacher_id', teacherId);
    const { data: existing, error: lookupError } = await lookup.maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return null;
    let update = client.from('teacher_availability').update({ is_available: !existing.is_available }).eq('id', id);
    if (teacherId) update = update.eq('teacher_id', teacherId);
    const { data, error } = await update.select('*').single();
    if (error) throw error;
    broadcastChange('teacher_availability', 'updated');
    return mapDatabaseRow(data);
  },

  async deleteTeacherAvailabilitySlot(id: string, teacherId?: string) {
    let query = requireServerSupabase().from('teacher_availability').delete().eq('id', id);
    if (teacherId) query = query.eq('teacher_id', teacherId);
    const { data, error } = await query.select('id').maybeSingle();
    if (error) throw error;
    if (!data) return false;
    broadcastChange('teacher_availability', 'deleted');
    return true;
  },

  async getAssignments() {
    const { data, error } = await requireServerSupabase().from('assignments')
      .select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return mapDatabaseRows(data);
  },

  async getAssignmentById(id: string) {
    const { data, error } = await requireServerSupabase().from('assignments')
      .select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapDatabaseRow(data) : null;
  },

  async addAssignment(data: any) {
    const defaultClass = await this.getDefaultClassName();
    const newItem = {
      id: data.id || `asg_${Date.now()}`,
      status: 'published',
      submittedStudents: 0,
      totalStudents: 35,
      submissions: [],
      class: data.class || defaultClass,
      ...data
    };
    const { data: row, error } = await requireServerSupabase().from('assignments').insert({
      id: newItem.id,
      title: newItem.title,
      subject: newItem.subject || '',
      class: newItem.class || defaultClass,
      description: newItem.description || '',
      due_date: newItem.dueDate || '',
      total_marks: Number(newItem.totalMarks ?? newItem.maxMarks ?? 20),
      max_marks: Number(newItem.maxMarks ?? newItem.totalMarks ?? 20),
      type: newItem.type || 'homework',
      status: newItem.status,
      teacher_name: newItem.teacherName || '',
      attachment_name: newItem.attachmentName || '',
      attachment_size: newItem.attachmentSize || '',
      attachment_path: newItem.attachmentPath || '',
      attachment_url: newItem.attachmentUrl || '',
      attachments: newItem.attachments || (newItem.attachmentName ? [newItem.attachmentName] : []),
      submitted_students: newItem.submittedStudents,
      total_students: newItem.totalStudents,
      submissions: newItem.submissions
    }).select('*').single();
    if (error) throw error;
    broadcastChange('assignments', 'created');
    return mapDatabaseRow(row);
  },

  async updateAssignment(id: string, patch: any) {
    const payload = toDatabaseRow(patch);
    if (patch.maxMarks !== undefined && patch.totalMarks === undefined) payload.total_marks = patch.maxMarks;
    if (patch.totalMarks !== undefined && patch.maxMarks === undefined) payload.max_marks = patch.totalMarks;
    const { data, error } = await requireServerSupabase().from('assignments')
      .update(payload).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return null;
    broadcastChange('assignments', 'updated');
    return mapDatabaseRow(data);
  },

  async deleteAssignment(id: string) {
    const { data, error } = await requireServerSupabase().from('assignments')
      .delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return false;
    broadcastChange('assignments', 'deleted');
    return true;
  },

  async submitStudentAssignment(
    assignmentId: string,
    student: { id: string; name: string },
    payload: { notes?: string; fileName?: string; fileUrl?: string; filePath?: string }
  ) {
    const existing = await this.getAssignmentById(assignmentId);
    if (!existing) return null;
    const existingSubs = existing.submissions || [];
    const already = existingSubs.find((sub: any) => sub.studentId === student.id);
    const entry = {
      id: already?.id || `sub_${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      status: 'submitted',
      submittedAt: new Date().toISOString().split('T')[0],
      notes: payload.notes || '',
      fileName: payload.fileName || already?.fileName || '',
      fileUrl: payload.fileUrl || already?.fileUrl || '',
      filePath: payload.filePath || already?.filePath || '',
      grade: already?.grade ?? null,
      feedback: payload.notes
        ? `Student note: "${payload.notes}"`
        : already?.feedback || 'Submission received for review.'
    };
    const nextSubs = already
      ? existingSubs.map((sub: any) => (sub.studentId === student.id ? entry : sub))
      : [...existingSubs, entry];
    return this.updateAssignment(assignmentId, {
      submissions: nextSubs,
      submittedStudents: nextSubs.length
    });
  },

  async getRequests(studentId?: string) {
    let query = requireServerSupabase().from('student_requests').select('*').order('submitted_date', { ascending: false });
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error) throw error;
    return mapDatabaseRows(data);
  },

  async addRequest(reqData: any) {
    const newReq = {
      id: reqData.id || `req_${Date.now()}`,
      status: 'pending',
      submittedDate: new Date().toISOString(),
      ...reqData
    };
    const { data, error } = await requireServerSupabase().from('student_requests').insert({
      id: newReq.id,
      student_id: newReq.studentId || '',
      student_name: newReq.studentName || '',
      admission_number: newReq.admissionNumber || '',
      class: newReq.class || '',
      title: newReq.title || '',
      subject: newReq.subject || '',
      request_type: newReq.requestType || 'booking',
      priority: newReq.priority || 'medium',
      status: newReq.status,
      submitted_date: newReq.submittedDate,
      preferred_date: newReq.preferredDate || '',
      preferred_time: newReq.preferredTime || '',
      duration: newReq.duration || '',
      preferred_teacher: newReq.preferredTeacher || '',
      message: newReq.message || '',
      staff_response: newReq.staffResponse || '',
      reviewed_at: newReq.reviewedAt || ''
    }).select('*').single();
    if (error) throw error;
    broadcastChange('student_requests', 'created');
    return mapDatabaseRow(data);
  },

  async updateRequestStatus(id: string, status: string, staffResponse = '') {
    const client = requireServerSupabase();
    const { data: existing, error: lookupError } = await client.from('student_requests')
      .select('staff_response').eq('id', id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return null;
    const { data, error } = await client.from('student_requests').update({
      status,
      staff_response: staffResponse || existing.staff_response || '',
      reviewed_at: new Date().toISOString()
    }).eq('id', id).select('*').single();
    if (error) throw error;
    broadcastChange('student_requests', 'updated');
    return mapDatabaseRow(data);
  },

  async getEnquiries() {
    const { data, error } = await requireServerSupabase().from('enquiries').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return mapDatabaseRows(data);
  },

  async addEnquiry(kind: string, payload: any) {
    const entry = {
      id: `${kind}_${Date.now()}`,
      kind,
      parentName: payload.parentName || '',
      studentName: payload.studentName || '',
      email: payload.email || '',
      phone: payload.phone || '',
      yearLevel: payload.yearLevel || '',
      subject: payload.subject || '',
      preferredDate: payload.preferredDate || '',
      preferredTime: payload.preferredTime || '',
      meetingType: payload.meetingType || '',
      message: payload.message || '',
      createdAt: new Date().toISOString()
    };
    const { data, error } = await requireServerSupabase().from('enquiries').insert({
      id: entry.id,
      kind: entry.kind,
      parent_name: entry.parentName,
      student_name: entry.studentName,
      email: entry.email,
      phone: entry.phone,
      year_level: entry.yearLevel,
      subject: entry.subject,
      preferred_date: entry.preferredDate,
      preferred_time: entry.preferredTime,
      meeting_type: entry.meetingType,
      message: entry.message,
      created_at: entry.createdAt
    }).select('*').single();
    if (error) throw error;
    broadcastChange('enquiries', 'created');
    return mapDatabaseRow(data);
  },

  async getDirectMessages() {
    const { data, error } = await requireServerSupabase().from('direct_messages').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return mapDatabaseRows(data);
  },

  async addDirectMessage(data: any) {
    const entry = {
      id: data.id || `m_${Date.now()}`,
      senderId: data.senderId || '',
      senderName: data.senderName || 'Admin',
      recipient: data.recipient || '',
      role: data.role || 'Recipient',
      subject: data.subject || '',
      content: data.content || '',
      sentDate: data.sentDate || new Date().toISOString().split('T')[0],
      status: data.status || 'delivered',
      createdAt: new Date().toISOString()
    };
    const { data: row, error } = await requireServerSupabase().from('direct_messages').insert({
      id: entry.id,
      sender_id: entry.senderId,
      sender_name: entry.senderName,
      recipient: entry.recipient,
      role: entry.role,
      subject: entry.subject,
      content: entry.content,
      sent_date: entry.sentDate,
      status: entry.status,
      created_at: entry.createdAt
    }).select('*').single();
    if (error) throw error;
    broadcastChange('direct_messages', 'created');
    return mapDatabaseRow(row);
  },

  async getStaffLeaves(teacherId?: string) {
    let query = requireServerSupabase().from('staff_leaves').select('*').order('created_at', { ascending: false });
    if (teacherId) query = query.eq('teacher_id', teacherId);
    const { data, error } = await query;
    if (error) throw error;
    return mapDatabaseRows(data);
  },

  async addStaffLeave(data: any) {
    const entry = {
      id: data.id || `leave-${Date.now()}`,
      teacherId: data.teacherId || '',
      teacherName: data.teacherName || '',
      type: data.type || 'Casual Leave',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      days: Number(data.days || 1),
      reason: data.reason || '',
      status: data.status || 'pending',
      submittedDate: data.submittedDate || new Date().toISOString().split('T')[0],
      approvedBy: data.approvedBy || 'Pending Review',
      createdAt: new Date().toISOString()
    };
    const { data: row, error } = await requireServerSupabase().from('staff_leaves').insert({
      id: entry.id,
      teacher_id: entry.teacherId,
      teacher_name: entry.teacherName,
      type: entry.type,
      start_date: entry.startDate,
      end_date: entry.endDate,
      days: entry.days,
      reason: entry.reason,
      status: entry.status,
      submitted_date: entry.submittedDate,
      approved_by: entry.approvedBy,
      created_at: entry.createdAt
    }).select('*').single();
    if (error) throw error;
    broadcastChange('staff_leaves', 'created');
    return mapDatabaseRow(row);
  },

  async updateStaffLeaveStatus(id: string, status: string, approvedBy = '') {
    const payload: Record<string, string> = { status };
    if (approvedBy) payload.approved_by = approvedBy;
    const { data, error } = await requireServerSupabase().from('staff_leaves')
      .update(payload).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return null;
    broadcastChange('staff_leaves', 'updated');
    return mapDatabaseRow(data);
  },

  async getHelpTickets(studentId?: string) {
    let query = requireServerSupabase().from('help_tickets').select('*').order('created_date', { ascending: false });
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error) throw error;
    return mapDatabaseRows(data);
  },

  async addHelpTicket(data: any) {
    const entry = {
      id: data.id || String(Date.now()),
      studentId: data.studentId || '',
      studentName: data.studentName || '',
      subject: data.subject || '',
      description: data.description || '',
      category: data.category || 'Academic Support',
      priority: data.priority || 'medium',
      status: data.status || 'open',
      assignedTo: data.assignedTo || 'Student Affairs Desk',
      createdDate: data.createdDate || new Date().toISOString().split('T')[0],
      lastUpdated: data.lastUpdated || new Date().toISOString().split('T')[0],
      responses: data.responses || [],
      createdAt: new Date().toISOString()
    };
    const { data: row, error } = await requireServerSupabase().from('help_tickets').insert({
      id: entry.id,
      student_id: entry.studentId,
      student_name: entry.studentName,
      subject: entry.subject,
      description: entry.description,
      category: entry.category,
      priority: entry.priority,
      status: entry.status,
      assigned_to: entry.assignedTo,
      created_date: entry.createdDate,
      last_updated: entry.lastUpdated,
      responses: entry.responses,
      created_at: entry.createdAt
    }).select('*').single();
    if (error) throw error;
    broadcastChange('help_tickets', 'created');
    return mapDatabaseRow(row);
  },

  async addHelpTicketReply(ticketId: string, reply: any, studentId?: string) {
    const client = requireServerSupabase();
    let lookup = client.from('help_tickets').select('responses').eq('id', ticketId);
    if (studentId) lookup = lookup.eq('student_id', studentId);
    const { data: existing, error: lookupError } = await lookup.maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return null;
    const { data, error } = await client.from('help_tickets').update({
      responses: [...(existing.responses || []), reply],
      last_updated: new Date().toISOString().split('T')[0]
    }).eq('id', ticketId).select('*').single();
    if (error) throw error;
    broadcastChange('help_tickets', 'updated');
    return mapDatabaseRow(data);
  },

  async findPortalUserForIdentifier(identifier: string) {
    const clean = String(identifier || '').trim().toLowerCase();
    if (!clean) return null;
    const client = requireServerSupabase();
    const { data: byEmail, error: emailError } = await client.from('portal_users')
      .select('id,email,student_id,teacher_id')
      .ilike('email', quotePostgrestSearch(clean))
      .maybeSingle();
    if (emailError) throw emailError;
    if (byEmail) return byEmail;

    const { data: student, error: studentError } = await client.from('students')
      .select('id')
      .ilike('admission_number', quotePostgrestSearch(clean))
      .maybeSingle();
    if (studentError) throw studentError;
    if (student) {
      const { data, error } = await client.from('portal_users')
        .select('id,email,student_id,teacher_id')
        .eq('student_id', student.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
    }

    const { data: teacher, error: teacherError } = await client.from('teachers')
      .select('id')
      .ilike('staff_id', quotePostgrestSearch(clean))
      .maybeSingle();
    if (teacherError) throw teacherError;
    if (!teacher) return null;
    const { data, error } = await client.from('portal_users')
      .select('id,email,student_id,teacher_id')
      .eq('teacher_id', teacher.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async generatePasswordResetOtp(identifier: string) {
    const now = Date.now();
    passwordResetOtps.forEach((entry, email) => {
      if (now >= entry.expiresAt) passwordResetOtps.delete(email);
    });
    const clean = String(identifier || '').trim().toLowerCase();
    if (!clean) return null;

    const user = await this.findPortalUserForIdentifier(clean);
    if (!user) return null;

    const otp = String(crypto.randomInt(100000, 1000000));
    passwordResetOtps.set(user.email.toLowerCase(), {
      email: user.email.toLowerCase(),
      code: otp,
      expiresAt: Date.now() + 15 * 60 * 1000,
      failedAttempts: 0
    });

    return { email: user.email, otp };
  },

  discardPasswordResetOtp(email: string) {
    passwordResetOtps.delete(String(email || '').toLowerCase());
  },

  async resetPasswordWithOtp(identifier: string, otp: string, newPassword: string) {
    const clean = String(identifier || '').trim().toLowerCase();
    const cleanOtp = String(otp || '').trim();
    const cleanPassword = String(newPassword || '').trim();

    if (!cleanPassword || cleanPassword.length < 12) {
      return { error: 'New password must be at least 12 characters.' };
    }

    const user = await this.findPortalUserForIdentifier(clean);
    if (!user) return { error: 'Invalid or expired OTP verification code.' };

    const stored = passwordResetOtps.get(user.email.toLowerCase());
    if (!stored || Date.now() > stored.expiresAt) {
      passwordResetOtps.delete(user.email.toLowerCase());
      return { error: 'Invalid or expired OTP verification code.' };
    }
    const providedCode = Buffer.from(cleanOtp);
    const expectedCode = Buffer.from(stored.code);
    if (
      providedCode.length !== expectedCode.length ||
      !crypto.timingSafeEqual(providedCode, expectedCode)
    ) {
      stored.failedAttempts += 1;
      if (stored.failedAttempts >= 5) passwordResetOtps.delete(user.email.toLowerCase());
      return { error: 'Invalid or expired OTP verification code.' };
    }

    const { error } = await requireServerSupabase().from('portal_users')
      .update({ password_hash: hashPassword(cleanPassword), updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;
    passwordResetOtps.delete(user.email.toLowerCase());

    return { success: true, message: 'Password has been reset successfully. You can now log in.' };
  },

  async getPromotionCandidates(currentSession = '2026/2027') {
    const client = requireServerSupabase();
    const [{ data: students, error: studentsError }, { data: grades, error: gradesError }] = await Promise.all([
      client.from('students').select('id,name,admission_number,class,department'),
      client.from('grades').select('student_id,total').eq('session', currentSession)
    ]);
    if (studentsError) throw studentsError;
    if (gradesError) throw gradesError;
    const gradesByStudent = new Map<string, number[]>();
    (grades || []).forEach((grade) => {
      const studentGrades = gradesByStudent.get(grade.student_id) || [];
      studentGrades.push(Number(grade.total) || 0);
      gradesByStudent.set(grade.student_id, studentGrades);
    });
    return (students || []).map((student) => {
      const subjectScores = gradesByStudent.get(student.id) || [];
      const avg = subjectScores.length > 0
        ? Math.round(subjectScores.reduce((a, b) => a + b, 0) / subjectScores.length)
        : 0;

      let nextClass = student.class;
      let defaultAction: 'promote' | 'repeat' | 'graduate' = 'promote';

      if (student.class === 'JSS 1') nextClass = 'JSS 2';
      else if (student.class === 'JSS 2') nextClass = 'JSS 3';
      else if (student.class === 'JSS 3') nextClass = 'SSS 1';
      else if (student.class === 'SSS 1') nextClass = 'SSS 2';
      else if (student.class === 'SSS 2') nextClass = 'SSS 3';
      else if (student.class === 'SSS 3') {
        nextClass = 'Graduated';
        defaultAction = 'graduate';
      }

      if (defaultAction !== 'graduate' && avg < 45 && subjectScores.length > 0) {
        defaultAction = 'repeat';
      }

      return {
        id: student.id,
        name: student.name,
        admissionNumber: student.admission_number,
        currentClass: student.class,
        department: student.department || '',
        averageScore: avg,
        suggestedClass: nextClass,
        suggestedAction: defaultAction
      };
    });
  },

  async executeSessionRollover({
    nextSession,
    promotions
  }: {
    nextSession: string;
    promotions: Array<{
      studentId: string;
      action: 'promote' | 'repeat' | 'graduate';
      targetClass?: string;
      department?: string;
    }>;
  }) {
    let promotedCount = 0;
    let repeatCount = 0;
    let graduatedCount = 0;

    const client = requireServerSupabase();
    for (const promotion of promotions) {
      const { data: student, error: lookupError } = await client.from('students')
        .select('id').eq('id', promotion.studentId).maybeSingle();
      if (lookupError) throw lookupError;
      if (!student) continue;
      if (promotion.action === 'graduate') {
        const { error } = await client.from('students').update({ status: 'Graduated' }).eq('id', student.id);
        if (error) throw error;
        graduatedCount++;
      } else if (promotion.action === 'repeat') {
        repeatCount++;
      } else if (promotion.action === 'promote') {
        const update: Record<string, string> = { class: promotion.targetClass || '' };
        if (promotion.department) update.department = promotion.department;
        if (!update.class) {
          const { data: current, error } = await client.from('students').select('class').eq('id', student.id).single();
          if (error) throw error;
          update.class = current.class;
        }
        const { error } = await client.from('students').update(update).eq('id', student.id);
        if (error) throw error;
        promotedCount++;
      }
    }

    broadcastChange('students', 'updated');
    return {
      success: true,
      nextSession,
      promotedCount,
      repeatCount,
      graduatedCount,
      totalProcessed: promotions.length
    };
  },

  async getSettings() {
    const { data, error } = await requireServerSupabase().from('institution_settings')
      .select('*').eq('id', 'current').maybeSingle();
    if (error) throw error;
    return data ? mapDatabaseRow(data) : {
      institutionName: 'Al-Amin Group of Schools',
      establishedYear: '2010',
      officialEmail: 'info@alaminschools.edu.ng',
      phone: '+234 803 456 7890',
      address: 'Al-Amin Campus, 14 Ahmadu Bello Way, Nassarawa GRA',
      website: 'www.alaminschools.edu.ng',
      registrationNumber: 'ASS-2010-008920',
      timezone: 'wat',
      currentSession: '2026/2027',
      currentTerm: 'Term 1'
    };
  },

  async updateSettings(data: any) {
    const settings = {
      ...await this.getSettings(),
      ...(data || {}),
      updatedAt: new Date().toISOString()
    };
    const { data: row, error } = await requireServerSupabase().from('institution_settings').upsert({
      id: 'current',
      ...toDatabaseRow(settings)
    }, { onConflict: 'id' }).select('*').single();
    if (error) throw error;
    broadcastChange('settings');
    return mapDatabaseRow(row);
  }
};
