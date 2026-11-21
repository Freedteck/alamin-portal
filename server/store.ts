import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SCHOOL_CLASSES,
  SSS_DEPARTMENTS,
  computeGrade,
  createInitialDbSnapshot,
  createInitialUsers,
  generateAdmissionNumber,
  hashPassword,
  isSeniorClass,
  verifyPassword
} from './seed.ts';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
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

export interface SchoolDatabase {
  users: any[];
  classes: any[];
  subjects: any[];
  students: any[];
  teachers: any[];
  timetable: any[];
  alerts: any[];
  attendance: Record<string, any>;
  grades: Record<string, any>;
  resources: any[];
  equipment: any[];
  maintenance: any[];
  documents: any[];
  announcements: any[];
  availability: any[];
  assignments: any[];
  requests: any[];
  enquiries: any[];
  messages: any[];
  leaves: any[];
  tickets: any[];
  settings?: Record<string, any>;
}

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

function ensureDirectories() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let db: SchoolDatabase = createInitialDbSnapshot();

async function hydrateFromSupabaseIfAvailable() {
  if (!serverSupabase) return;
  try {
    const { data: users, error: errUsers } = await serverSupabase.from('portal_users').select('*');
    if (!errUsers && users && users.length > 0) {
      db.users = users.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        studentId: u.student_id,
        teacherId: u.teacher_id,
        avatarUrl: u.avatar_url || '',
        passwordHash: u.password_hash,
        createdAt: u.created_at
      }));
    }

    const hasAdmin = db.users && db.users.some((u) => u.role === 'admin');
    if (!errUsers && (!users || users.length === 0 || !hasAdmin)) {
      const initialUsers = createInitialUsers();
      await serverSupabase.from('portal_users').upsert(
        initialUsers.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          password_hash: u.passwordHash,
          avatar_url: ''
        }))
      );
      initialUsers.forEach((u) => {
        if (!db.users.some((existing) => existing.id === u.id || existing.email === u.email)) {
          db.users.push(u);
        }
      });
      console.log(`[Al-Amin Store] Provisioned initial admin user (${initialUsers[0]?.email}) to Supabase portal_users.`);
    }

    const { data: students } = await serverSupabase.from('students').select('*');
    if (students && students.length > 0) {
      db.students = students.map((s: any) => ({
        id: s.id,
        name: s.name,
        admissionNumber: s.admission_number,
        class: s.class,
        department: s.department,
        gender: s.gender,
        dob: s.dob,
        stateOfOrigin: s.state_of_origin,
        lga: s.lga,
        address: s.address,
        email: s.email,
        parentName: s.parent_name,
        parentPhone: s.parent_phone,
        parentEmail: s.parent_email,
        parentOccupation: s.parent_occupation || '',
        parentRelationship: s.parent_relationship || '',
        emergencyContact: s.emergency_contact || {},
        enrolledSubjects: s.enrolled_subjects || [],
        attendanceRate: s.attendance_rate || 0,
        gpa: s.gpa || '0.00',
        avatarUrl: s.avatar_url || '',
        status: s.status || 'active'
      }));
    }

    const { data: teachers } = await serverSupabase.from('teachers').select('*');
    if (teachers && teachers.length > 0) {
      db.teachers = teachers.map((t: any) => {
        const rawClassTeacher = t.class_teacher_of ?? t.form_teacher_of;
        let classTeacherOf: string[] = [];
        if (Array.isArray(rawClassTeacher)) {
          classTeacherOf = rawClassTeacher.filter(Boolean);
        } else if (typeof rawClassTeacher === 'string' && rawClassTeacher.trim()) {
          try {
            const parsed = JSON.parse(rawClassTeacher);
            classTeacherOf = Array.isArray(parsed) ? parsed.filter(Boolean) : [rawClassTeacher.trim()];
          } catch {
            classTeacherOf = [rawClassTeacher.trim()];
          }
        }
        return {
          id: t.id,
          name: t.name,
          staffId: t.staff_id,
          email: t.email,
          phone: t.phone,
          qualification: t.qualification,
          address: t.address || '',
          dateOfBirth: t.date_of_birth || '',
          startDate: t.start_date || '',
          position: t.position || 'Subject Teacher',
          department: t.department || 'Academic Faculty',
          emergencyContact: t.emergency_contact || {},
          assignedClasses: t.assigned_classes || [],
          classTeacherOf,
          avatarUrl: t.avatar_url || '',
          status: t.status || 'active'
        };
      });
    }

    const { data: subjects } = await serverSupabase.from('subjects').select('*');
    if (subjects && subjects.length > 0) {
      db.subjects = subjects.map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        allClasses: sub.all_classes,
        classes: sub.classes || [],
        allDepartments: sub.all_departments,
        departments: sub.departments || []
      }));
    }

    const { data: classes } = await serverSupabase.from('classes').select('*');
    if (classes && classes.length > 0) {
      db.classes = classes.map((c: any) => ({
        id: c.id,
        name: c.name,
        category: c.category || (isSeniorClass(c.name) ? 'Senior' : 'Junior'),
        classTeacherId: c.class_teacher_id || '',
        classTeacherName: c.class_teacher_name || ''
      }));
    }

    const { data: settings } = await serverSupabase.from('institution_settings').select('*').limit(1).maybeSingle();
    if (settings) {
      db.settings = {
        institutionName: settings.institution_name,
        establishedYear: settings.established_year,
        officialEmail: settings.official_email,
        phone: settings.phone,
        address: settings.address,
        website: settings.website,
        registrationNumber: settings.registration_number,
        timezone: settings.timezone,
        dateFormat: settings.date_format,
        academicTerm: settings.academic_term,
        currentSession: settings.current_session,
        currentTerm: settings.current_term,
        language: settings.language,
        emailNotifications: settings.email_notifications,
        smsAlerts: settings.sms_alerts,
        maintenanceMode: settings.maintenance_mode,
        updatedAt: settings.updated_at
      };
    }

    const { data: messages } = await serverSupabase.from('direct_messages').select('*');
    if (messages && messages.length > 0) {
      db.messages = messages.map((m: any) => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        recipient: m.recipient,
        role: m.role,
        subject: m.subject,
        content: m.content,
        sentDate: m.sent_date,
        status: m.status,
        createdAt: m.created_at
      }));
    }

    const { data: leaves } = await serverSupabase.from('staff_leaves').select('*');
    if (leaves && leaves.length > 0) {
      db.leaves = leaves.map((l: any) => ({
        id: l.id,
        teacherId: l.teacher_id,
        teacherName: l.teacher_name,
        type: l.type,
        startDate: l.start_date,
        endDate: l.end_date,
        days: l.days,
        reason: l.reason,
        status: l.status,
        submittedDate: l.submitted_date,
        approvedBy: l.approved_by,
        createdAt: l.created_at
      }));
    }

    const { data: tickets } = await serverSupabase.from('help_tickets').select('*');
    if (tickets && tickets.length > 0) {
      db.tickets = tickets.map((tk: any) => ({
        id: tk.id,
        studentId: tk.student_id,
        studentName: tk.student_name,
        subject: tk.subject,
        description: tk.description,
        category: tk.category,
        priority: tk.priority,
        status: tk.status,
        assignedTo: tk.assigned_to,
        createdDate: tk.created_date,
        lastUpdated: tk.last_updated,
        responses: tk.responses || [],
        createdAt: tk.created_at
      }));
    }

    console.log(`[Al-Amin Store] Successfully hydrated state from Supabase PostgreSQL tables.`);
  } catch (err: any) {
    console.log(`[Al-Amin Store] Supabase tables not yet created or ready (${err?.message}). Running in-memory mode.`);
  }
}

hydrateFromSupabaseIfAvailable();

function persistDb() {
  // Pure in-memory cache, synchronized directly with Supabase PostgreSQL.
  // No local JSON files are stored.
}

function supabaseMirrorUpsert(table: string, rowOrRows: any, onConflict = 'id') {
  if (!serverSupabase) return;
  const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
  if (rows.length === 0) return;
  serverSupabase
    .from(table)
    .upsert(rows, { onConflict })
    .then(() => {});
}

function supabaseMirrorDelete(table: string, id: string, idCol = 'id') {
  if (!serverSupabase || !id) return;
  serverSupabase
    .from(table)
    .delete()
    .eq(idCol, id)
    .then(() => {});
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
  ensureDirectories();
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

  if (serverSupabase) {
    const { error } = await serverSupabase.storage
      .from(SUPABASE_BUCKET)
      .upload(relativePath, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: false
      });

    if (!error) {
      const { data: pub } = serverSupabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(relativePath);
      return {
        fileName: file.originalname,
        fileSize: sizeLabel,
        filePath: relativePath,
        fileUrl: pub?.publicUrl || `/api/files/download/${relativePath}`
      };
    }
  }

  const folderDir = path.join(UPLOADS_DIR, safeFolder);
  if (!fs.existsSync(folderDir)) fs.mkdirSync(folderDir, { recursive: true });
  fs.writeFileSync(path.join(folderDir, storedName), file.buffer);

  return {
    fileName: file.originalname,
    fileSize: sizeLabel,
    filePath: relativePath,
    fileUrl: `/api/files/download/${safeFolder}/${storedName}`
  };
}

export function resolveLocalUploadPath(folder: string, filename: string): string | null {
  const safeFolder = String(folder || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeFile = path.basename(String(filename || ''));
  if (!safeFolder || !safeFile) return null;
  const fullPath = path.join(UPLOADS_DIR, safeFolder, safeFile);
  return fs.existsSync(fullPath) ? fullPath : null;
}

interface PasswordResetOtp {
  email: string;
  code: string;
  expiresAt: number;
}
const passwordResetOtps = new Map<string, PasswordResetOtp>();

export const backendStore = {
  getStorageMode() {
    return isServerSupabaseConfigured ? 'supabase-postgres' : 'server-json-store';
  },

  getBootstrapPayload(user?: any) {
    if (!user) {
      return {
        classes: db.classes || [],
        subjects: db.subjects,
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

    if (user.role === 'student') {
      const studentObj = db.students.find((s) => s.id === user.studentId) || null;
      const studentClass = studentObj?.class || '';
      const enrolledSubjects = studentObj?.enrolledSubjects || [];
      const studentGrades = user.studentId ? (db.grades[user.studentId] || {}) : {};

      const scopedAttendance: Record<string, any> = {};
      Object.keys(db.attendance || {}).forEach((key) => {
        const entry = db.attendance[key];
        if (entry && entry.records && entry.records[user.studentId]) {
          scopedAttendance[key] = entry;
        }
      });

      const studentSubjects = db.subjects.filter((s) =>
        enrolledSubjects.length > 0
          ? enrolledSubjects.includes(s.name)
          : (s.allClasses || (Array.isArray(s.classes) && s.classes.includes(studentClass)))
      );
      const studentSubjectNames = studentSubjects.map((s) => s.name);

      return {
        classes: (db.classes || []).filter((c) => !studentClass || c.name === studentClass),
        subjects: studentSubjects,
        students: studentObj ? [studentObj] : [],
        teachers: db.teachers
          .filter((t) => (t.assignedClasses || []).some((ac: any) => ac.class === studentClass))
          .map(({ phone, email, qualification, staffId, ...safe }) => safe),
        timetable: db.timetable.filter((t) => t.class === studentClass),
        alerts: db.alerts.filter((a) => !a.targetRole || a.targetRole === 'all' || a.targetRole === 'student'),
        attendance: scopedAttendance,
        grades: { [user.studentId]: studentGrades },
        resources: db.resources.filter(
          (r) =>
            r.accessLevel === 'students' &&
            (r.allClasses || (r.classes && r.classes.includes(studentClass))) &&
            (!r.subject || r.subject === 'General' || studentSubjectNames.includes(r.subject))
        ),
        equipment: [],
        maintenance: [],
        documents: db.documents.filter((d) => d.access === 'all' || d.access === 'student'),
        announcements: db.announcements.filter((a) => !a.targetRole || a.targetRole === 'all' || a.targetRole === 'student'),
        availability: db.availability,
        assignments: db.assignments.filter(
          (a) =>
            (!a.class || a.class === 'All Classes' || a.class === studentClass) &&
            (!a.subject || a.subject === 'General' || studentSubjectNames.includes(a.subject))
        ),
        requests: db.requests.filter((r) => r.studentId === user.studentId)
      };
    }

    if (user.role === 'teacher') {
      const teacherObj = db.teachers.find((t) => t.id === user.teacherId) || null;
      const assigned = teacherObj?.assignedClasses || [];
      const assignedClassNames = Array.from(new Set(assigned.map((a: any) => a.class).filter(Boolean)));
      const assignedSubjectNames = Array.from(new Set(assigned.map((a: any) => a.subject).filter(Boolean)));

      const teacherSubjects = assignedSubjectNames.length > 0
        ? db.subjects.filter((s) => assignedSubjectNames.includes(s.name))
        : db.subjects;

      const teacherClasses = assignedClassNames.length > 0
        ? (db.classes || []).filter((c) => assignedClassNames.includes(c.name))
        : (db.classes || []);

      const teacherStudents = assignedClassNames.length > 0
        ? db.students.filter((s) => assignedClassNames.includes(s.class))
        : db.students;

      const scopedAttendance: Record<string, any> = {};
      Object.keys(db.attendance || {}).forEach((key) => {
        const entry = db.attendance[key];
        if (
          assignedClassNames.length === 0 ||
          assignedClassNames.includes(entry?.className) ||
          assignedClassNames.includes(entry?.class)
        ) {
          scopedAttendance[key] = entry;
        }
      });

      return {
        classes: teacherClasses,
        subjects: teacherSubjects,
        students: teacherStudents,
        teachers: db.teachers,
        timetable: db.timetable.filter(
          (t) =>
            t.teacherId === user.teacherId ||
            (teacherObj?.name && t.teacher === teacherObj.name) ||
            assignedClassNames.includes(t.class)
        ),
        alerts: db.alerts.filter((a) => !a.targetRole || a.targetRole === 'all' || a.targetRole === 'teacher'),
        attendance: scopedAttendance,
        grades: db.grades,
        resources: db.resources.filter(
          (r) =>
            r.uploadedBy === teacherObj?.name ||
            assignedSubjectNames.includes(r.subject) ||
            r.accessLevel === 'teachers' ||
            (r.classes && r.classes.some((c: string) => assignedClassNames.includes(c)))
        ),
        equipment: db.equipment,
        maintenance: db.maintenance,
        documents: db.documents.filter((d) => d.access !== 'admin'),
        announcements: db.announcements.filter((a) => !a.targetRole || a.targetRole === 'all' || a.targetRole === 'teacher'),
        availability: db.availability.filter((a) => a.teacherId === user.teacherId),
        assignments: db.assignments.filter(
          (a) =>
            a.teacherId === user.teacherId ||
            a.author === teacherObj?.name ||
            (assignedClassNames.includes(a.class) && assignedSubjectNames.includes(a.subject))
        ),
        requests: db.requests.filter((r) => r.teacherId === user.teacherId)
      };
    }

    // Admin role receives complete data
    return {
      classes: db.classes || [],
      subjects: db.subjects,
      students: db.students,
      teachers: db.teachers,
      timetable: db.timetable,
      alerts: db.alerts,
      attendance: db.attendance,
      grades: db.grades,
      resources: db.resources,
      equipment: db.equipment,
      maintenance: db.maintenance,
      documents: db.documents,
      announcements: db.announcements,
      availability: db.availability,
      assignments: db.assignments,
      requests: db.requests
    };
  },

  authenticate(identifier: string, password: string) {
    const clean = String(identifier || '').trim().toLowerCase();
    if (!clean) return null;
    let user = db.users.find((u) => u.email.toLowerCase() === clean);
    if (!user) {
      const matchedStudent = db.students.find(
        (s) => String(s.admissionNumber || '').trim().toLowerCase() === clean
      );
      if (matchedStudent) {
        user = db.users.find((u) => u.studentId === matchedStudent.id);
      }
    }
    if (!user) {
      const matchedTeacher = db.teachers.find(
        (t) => String(t.staffId || '').trim().toLowerCase() === clean
      );
      if (matchedTeacher) {
        user = db.users.find((u) => u.teacherId === matchedTeacher.id);
      }
    }
    if (!user) return null;
    if (!verifyPassword(password, user.passwordHash)) return null;
    const { passwordHash: _ignored, ...safeUser } = user;
    return safeUser;
  },

  provisionPortalUser({
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
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { error: 'A valid portal email address is required.' };
    }

    const existing = db.users.find(
      (u) =>
        u.email.toLowerCase() === cleanEmail &&
        !(studentId && u.studentId === studentId) &&
        !(teacherId && u.teacherId === teacherId)
    );
    if (existing) {
      return { error: `An account with email "${cleanEmail}" already exists.` };
    }

    const rawPassword =
      String(password || '').trim().length >= 6
        ? String(password || '').trim()
        : `Alamin#${crypto.randomBytes(3).toString('hex')}`;

    const existingLinkedIndex = db.users.findIndex(
      (u) => (studentId && u.studentId === studentId) || (teacherId && u.teacherId === teacherId)
    );

    const userRecord = {
      id: existingLinkedIndex >= 0 ? db.users[existingLinkedIndex].id : `usr_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      email: cleanEmail,
      name: String(name || '').trim() || cleanEmail.split('@')[0],
      role,
      ...(studentId ? { studentId } : {}),
      ...(teacherId ? { teacherId } : {}),
      passwordHash: hashPassword(rawPassword)
    };

    if (existingLinkedIndex >= 0) {
      db.users[existingLinkedIndex] = userRecord;
    } else {
      db.users.push(userRecord);
    }
    persistDb();
    supabaseMirrorUpsert('portal_users', {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
      student_id: userRecord.studentId || '',
      teacher_id: userRecord.teacherId || '',
      password_hash: userRecord.passwordHash,
      updated_at: new Date().toISOString()
    });
    const { passwordHash: _ignored, ...safeUser } = userRecord;
    return {
      user: safeUser,
      credentials: {
        email: cleanEmail,
        temporaryPassword: rawPassword
      }
    };
  },

  setPortalCredentials(
    role: 'teacher' | 'student',
    entityId: string,
    emailInput?: string,
    passwordInput?: string
  ) {
    const entity = role === 'student' ? this.getStudentById(entityId) : this.getTeacherById(entityId);
    if (!entity) return null;
    const email = String(emailInput || entity.email || '').trim().toLowerCase();
    if (!email) {
      return { error: 'Email address is required to provision portal credentials.' };
    }
    if (entity.email !== email) {
      if (role === 'student') {
        this.updateStudent(entityId, { email });
      } else {
        this.updateTeacher(entityId, { email });
      }
    }
    return this.provisionPortalUser({
      email,
      password: passwordInput,
      name: entity.name,
      role,
      studentId: role === 'student' ? entityId : undefined,
      teacherId: role === 'teacher' ? entityId : undefined
    });
  },

  isEmailTaken(email: string) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return false;
    return db.users.some((u) => u.email.toLowerCase() === clean);
  },

  getUserById(id: string) {
    const user = db.users.find((u) => u.id === id);
    if (!user) return null;
    const { passwordHash: _ignored, ...safeUser } = user;
    return safeUser;
  },

  getClasses() {
    return db.classes || [];
  },

  addClass(classData: { name: string; category?: string; classTeacherId?: string; classTeacherName?: string }) {
    const cleanName = String(classData.name || '').trim();
    if (!cleanName) return { error: 'Class name is required.' };
    const exists = (db.classes || []).some((c) => c.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) return { error: `Class "${cleanName}" already exists.` };
    const newCls = {
      id: `cls-${Date.now()}`,
      name: cleanName,
      category: classData.category || (isSeniorClass(cleanName) ? 'Senior' : 'Junior'),
      classTeacherId: classData.classTeacherId || '',
      classTeacherName: classData.classTeacherName || ''
    };
    db.classes = [...(db.classes || []), newCls];
    supabaseMirrorUpsert('classes', {
      id: newCls.id,
      name: newCls.name,
      category: newCls.category,
      class_teacher_id: newCls.classTeacherId,
      class_teacher_name: newCls.classTeacherName
    });
    broadcastChange('classes', 'created');
    return newCls;
  },

  assignClassTeacher(classIdOrName: string, teacherId: string | null | undefined) {
    const cls = (db.classes || []).find(
      (c) => c.id === classIdOrName || c.name.toLowerCase() === classIdOrName.toLowerCase()
    );
    if (!cls) return { error: `Class "${classIdOrName}" not found.` };

    const oldTeacherId = cls.classTeacherId;
    const targetTeacher = teacherId ? this.getTeacherById(teacherId) : null;
    if (teacherId && !targetTeacher) {
      return { error: 'Teacher not found.' };
    }

    // 1. Remove this class from previous teacher's classTeacherOf list
    if (oldTeacherId && oldTeacherId !== teacherId) {
      const oldTeacher = this.getTeacherById(oldTeacherId);
      if (oldTeacher) {
        const updatedClasses = (oldTeacher.classTeacherOf || []).filter((c: string) => c !== cls.name);
        this.updateTeacher(oldTeacher.id, { classTeacherOf: updatedClasses });
      }
    }

    // 2. Add this class to new teacher's classTeacherOf list
    if (targetTeacher) {
      const existingClasses = targetTeacher.classTeacherOf || [];
      if (!existingClasses.includes(cls.name)) {
        this.updateTeacher(targetTeacher.id, { classTeacherOf: [...existingClasses, cls.name] });
      }
      cls.classTeacherId = targetTeacher.id;
      cls.classTeacherName = targetTeacher.name;
    } else {
      cls.classTeacherId = '';
      cls.classTeacherName = '';
    }

    supabaseMirrorUpsert('classes', {
      id: cls.id,
      name: cls.name,
      category: cls.category,
      class_teacher_id: cls.classTeacherId || '',
      class_teacher_name: cls.classTeacherName || ''
    });
    broadcastChange('classes', 'updated');

    return cls;
  },

  setTeacherClassTeacherOf(teacherId: string, classes: string[]) {
    const teacher = this.getTeacherById(teacherId);
    if (!teacher) return { error: 'Teacher not found.' };

    const currentAssigned = teacher.classTeacherOf || [];
    const targetClasses = Array.isArray(classes) ? classes : [];

    // Remove from classes no longer in the list
    currentAssigned.forEach((clsName: string) => {
      if (!targetClasses.includes(clsName)) {
        this.assignClassTeacher(clsName, null);
      }
    });

    // Assign to classes in the new list
    targetClasses.forEach((clsName: string) => {
      this.assignClassTeacher(clsName, teacherId);
    });

    return this.getTeacherById(teacherId);
  },

  deleteClass(id: string) {
    const existing = (db.classes || []).find((c) => c.id === id);
    if (!existing) return false;
    if (existing.classTeacherId) {
      const teacher = this.getTeacherById(existing.classTeacherId);
      if (teacher) {
        const updatedClasses = (teacher.classTeacherOf || []).filter((c: string) => c !== existing.name);
        this.updateTeacher(teacher.id, { classTeacherOf: updatedClasses });
      }
    }
    db.classes = (db.classes || []).filter((c) => c.id !== id);
    supabaseMirrorDelete('classes', id);
    broadcastChange('classes', 'deleted');
    return true;
  },

  getSubjects() {
    return db.subjects;
  },

  getSubjectsForClass(className: string, department = '') {
    if (!className || className === 'All Classes') {
      return db.subjects.map((s) => s.name);
    }
    const senior = isSeniorClass(className);
    return db.subjects
      .filter((sub) => {
        const classMatch = sub.allClasses || (sub.classes || []).includes(className);
        if (!classMatch) return false;
        if (!senior || !department) return true;
        return sub.allDepartments || (sub.departments || []).includes(department);
      })
      .map((s) => s.name);
  },

  addSubject(subjectData: any) {
    const cleanName = String(subjectData.name || '').trim();
    if (!cleanName) return null;
    const allClasses = Boolean(subjectData.allClasses);
    const existingClassNames = (db.classes || []).map((c: any) => c.name);
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
    db.subjects.push(newSub);
    persistDb();
    supabaseMirrorUpsert('subjects', {
      id: newSub.id,
      name: newSub.name,
      all_classes: newSub.allClasses,
      classes: newSub.classes,
      all_departments: newSub.allDepartments,
      departments: newSub.departments
    });
    broadcastChange('subjects', 'created');
    return newSub;
  },

  updateSubject(id: string, updates: any) {
    let target: any = null;
    const existingClassNames = (db.classes || []).map((c: any) => c.name);
    const defaultClasses = existingClassNames.length > 0 ? existingClassNames : [...SCHOOL_CLASSES];
    db.subjects = db.subjects.map((sub) => {
      if (sub.id !== id) return sub;
      const merged = { ...sub, ...updates };
      const allClasses = Boolean(merged.allClasses);
      const classes = allClasses ? defaultClasses : (merged.classes || []);
      const seniorOnly = !allClasses && classes.length > 0 && classes.every((c: string) => isSeniorClass(c));
      const allDepartments = seniorOnly ? Boolean(merged.allDepartments) : true;
      const departments = seniorOnly
        ? (allDepartments ? [...SSS_DEPARTMENTS] : (merged.departments || []))
        : [...SSS_DEPARTMENTS];
      target = {
        ...merged,
        name: String(merged.name || '').trim(),
        allClasses,
        classes,
        allDepartments,
        departments
      };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('subjects', {
      id: target.id,
      name: target.name,
      all_classes: target.allClasses,
      classes: target.classes,
      all_departments: target.allDepartments,
      departments: target.departments
    });
    broadcastChange('subjects', 'updated');
    return target;
  },

  deleteSubject(id: string) {
    const before = db.subjects.length;
    db.subjects = db.subjects.filter((s) => s.id !== id);
    if (db.subjects.length === before) return false;
    persistDb();
    supabaseMirrorDelete('subjects', id);
    broadcastChange('subjects', 'deleted');
    return true;
  },

  getStudents(options?: {
    search?: string;
    class?: string;
    department?: string;
    subject?: string;
    status?: string;
    page?: number;
    limit?: number;
    allowedClasses?: string[];
  }) {
    let list = db.students || [];

    if (options?.allowedClasses && options.allowedClasses.length > 0) {
      list = list.filter((s) => options.allowedClasses!.includes(s.class));
    }

    if (options?.class && options.class !== 'all') {
      const cls = options.class.toLowerCase().trim();
      list = list.filter((s) => (s.class || '').toLowerCase().trim() === cls);
    }

    if (options?.department && options.department !== 'all') {
      const dept = options.department.toLowerCase().trim();
      list = list.filter((s) => (s.department || '').toLowerCase().trim() === dept);
    }

    if (options?.subject && options.subject !== 'all') {
      const sub = options.subject.toLowerCase().trim();
      list = list.filter((s) =>
        (s.enrolledSubjects || []).some((es: string) => es.toLowerCase().trim() === sub)
      );
    }

    if (options?.status && options.status !== 'all') {
      const st = options.status.toLowerCase().trim();
      list = list.filter((s) => (s.status || '').toLowerCase().trim() === st);
    }

    if (options?.search) {
      const term = options.search.toLowerCase().trim();
      list = list.filter((s) =>
        (s.name || '').toLowerCase().includes(term) ||
        (s.admissionNumber || '').toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term) ||
        (s.parentName || '').toLowerCase().includes(term) ||
        (s.parentPhone || '').toLowerCase().includes(term) ||
        (s.class || '').toLowerCase().includes(term)
      );
    }

    const total = list.length;

    if (options?.page || options?.limit) {
      const page = Math.max(1, Number(options.page || 1));
      const limit = Math.max(1, Math.min(100, Number(options.limit || 10)));
      const offset = (page - 1) * limit;
      const data = list.slice(offset, offset + limit);

      const classCounts: Record<string, number> = {};
      for (const s of (db.students || [])) {
        if (s.class) {
          classCounts[s.class] = (classCounts[s.class] || 0) + 1;
        }
      }

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        classCounts
      };
    }

    return list;
  },

  getStudentById(id: string) {
    return db.students.find((s) => s.id === id) || null;
  },

  addStudent(studentData: any) {
    const {
      password: rawPass,
      portalPassword: rawPortalPass,
      portalCredentials: _ignoredCreds,
      ...cleanStudentData
    } = studentData || {};

    const admissionNumber =
      cleanStudentData.admissionNumber || generateAdmissionNumber(cleanStudentData.class || 'JSS 1', db.students);
    const defaultPortalEmail = `${admissionNumber.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@student.alamin.sch.ng`;
    const portalEmail = String(cleanStudentData.email || defaultPortalEmail).trim().toLowerCase();

    const newStudent = {
      id: cleanStudentData.id || `s_${Date.now()}`,
      ...cleanStudentData,
      email: portalEmail,
      department: isSeniorClass(cleanStudentData.class) ? cleanStudentData.department || 'Science' : '',
      admissionNumber,
      attendanceRate: cleanStudentData.attendanceRate ?? 0,
      gpa: cleanStudentData.gpa || '0.00',
      status: cleanStudentData.status || 'active',
      createdAt: new Date().toISOString()
    };
    db.students = [newStudent, ...db.students];
    persistDb();

    const provisioned = this.provisionPortalUser({
      email: portalEmail,
      password: rawPortalPass || rawPass,
      name: newStudent.name,
      role: 'student',
      studentId: newStudent.id
    });

    supabaseMirrorUpsert('students', {
      id: newStudent.id,
      name: newStudent.name,
      admission_number: newStudent.admissionNumber,
      class: newStudent.class,
      department: newStudent.department,
      gender: newStudent.gender || 'Male',
      dob: newStudent.dob || newStudent.dateOfBirth || '',
      state_of_origin: newStudent.stateOfOrigin || '',
      lga: newStudent.lga || '',
      address: newStudent.address || '',
      email: newStudent.email || '',
      parent_name: newStudent.parentName || '',
      parent_phone: newStudent.parentPhone || '',
      parent_email: newStudent.parentEmail || '',
      parent_occupation: newStudent.parentOccupation || '',
      parent_relationship: newStudent.parentRelationship || '',
      emergency_contact: newStudent.emergencyContact || {},
      enrolled_subjects: newStudent.enrolledSubjects || [],
      attendance_rate: newStudent.attendanceRate,
      gpa: String(newStudent.gpa),
      avatar_url: newStudent.avatarUrl || '',
      status: newStudent.status
    });
    broadcastChange('students', 'created');
    return {
      ...newStudent,
      ...('credentials' in provisioned && provisioned.credentials ? { portalCredentials: provisioned.credentials } : {})
    };
  },

  updateStudent(id: string, updates: any) {
    let target: any = null;
    db.students = db.students.map((s) => {
      if (s.id !== id) return s;
      target = { ...s, ...updates };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('students', {
      id: target.id,
      name: target.name,
      admission_number: target.admissionNumber,
      class: target.class,
      department: target.department || '',
      gender: target.gender || 'Male',
      dob: target.dob || target.dateOfBirth || '',
      state_of_origin: target.stateOfOrigin || '',
      lga: target.lga || '',
      address: target.address || '',
      email: target.email || '',
      parent_name: target.parentName || '',
      parent_phone: target.parentPhone || '',
      parent_email: target.parentEmail || '',
      parent_occupation: target.parentOccupation || '',
      parent_relationship: target.parentRelationship || '',
      emergency_contact: target.emergencyContact || {},
      enrolled_subjects: target.enrolledSubjects || [],
      attendance_rate: target.attendanceRate ?? 100,
      gpa: String(target.gpa || '3.80'),
      avatar_url: target.avatarUrl || '',
      status: target.status || 'active'
    });
    broadcastChange('students', 'updated');
    return target;
  },

  enrollStudentSubject(studentId: string, subject: string) {
    const student = this.getStudentById(studentId);
    if (!student) return null;
    const existing = student.enrolledSubjects || [];
    if (existing.includes(subject)) return student;
    return this.updateStudent(studentId, { enrolledSubjects: [...existing, subject] });
  },

  deleteStudent(id: string) {
    const before = db.students.length;
    db.students = db.students.filter((s) => s.id !== id);
    if (db.students.length === before) return false;
    const linkedUserIds = db.users.filter((u) => u.studentId === id).map((u) => u.id);
    db.users = db.users.filter((u) => u.studentId !== id);
    persistDb();
    supabaseMirrorDelete('students', id);
    linkedUserIds.forEach((uid) => supabaseMirrorDelete('portal_users', uid));
    broadcastChange('students', 'deleted');
    return true;
  },

  getTeachers(options?: {
    search?: string;
    class?: string;
    subject?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    let list = db.teachers || [];

    if (options?.status && options.status !== 'all') {
      const st = options.status.toLowerCase().trim();
      list = list.filter((t) => (t.status || '').toLowerCase().trim() === st);
    }

    if (options?.class && options.class !== 'all') {
      const cls = options.class.toLowerCase().trim();
      list = list.filter((t) =>
        (t.assignedClasses || []).some((ac: any) => (ac.class || '').toLowerCase().trim() === cls) ||
        (t.classTeacherOf || []).some((c: string) => c.toLowerCase().trim() === cls)
      );
    }

    if (options?.subject && options.subject !== 'all') {
      const sub = options.subject.toLowerCase().trim();
      list = list.filter((t) =>
        (t.assignedClasses || []).some((ac: any) => (ac.subject || '').toLowerCase().trim() === sub)
      );
    }

    if (options?.search) {
      const term = options.search.toLowerCase().trim();
      list = list.filter((t) =>
        (t.name || '').toLowerCase().includes(term) ||
        (t.staffId || '').toLowerCase().includes(term) ||
        (t.email || '').toLowerCase().includes(term) ||
        (t.qualification || '').toLowerCase().includes(term)
      );
    }

    const total = list.length;

    if (options?.page || options?.limit) {
      const page = Math.max(1, Number(options.page || 1));
      const limit = Math.max(1, Math.min(100, Number(options.limit || 10)));
      const offset = (page - 1) * limit;
      const data = list.slice(offset, offset + limit);

      const totalTeachers = (db.teachers || []).length;
      const activeTeachers = (db.teachers || []).filter((t) => t.status === 'active').length;
      const totalAllocations = (db.teachers || []).reduce(
        (acc, t) => acc + (t.assignedClasses ? t.assignedClasses.length : 0),
        0
      );

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: {
          totalTeachers,
          activeTeachers,
          totalAllocations
        }
      };
    }

    return list;
  },

  getTeacherById(id: string) {
    return db.teachers.find((t) => t.id === id) || null;
  },

  getTeacherByEmailOrId(email?: string, teacherId?: string) {
    if (teacherId) {
      const t = db.teachers.find((tch) => tch.id === teacherId);
      if (t) return t;
    }
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const t = db.teachers.find((tch) => tch.email && tch.email.trim().toLowerCase() === cleanEmail);
      if (t) return t;
    }
    return null;
  },

  addTeacher(teacherData: any) {
    const {
      password: rawPass,
      portalPassword: rawPortalPass,
      portalCredentials: _ignoredCreds,
      ...cleanTeacherData
    } = teacherData || {};

    const nextNum = db.teachers.length + 1;
    const staffId = cleanTeacherData.staffId || `ASS/staff/${String(nextNum).padStart(3, '0')}`;
    const defaultEmail = `${staffId.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@staff.alamin.sch.ng`;
    const portalEmail = String(cleanTeacherData.email || defaultEmail).trim().toLowerCase();

    const newTeacher = {
      id: cleanTeacherData.id || `t_${Date.now()}`,
      staffId,
      status: 'active',
      assignedClasses: [],
      classTeacherOf: Array.isArray(cleanTeacherData.classTeacherOf) ? cleanTeacherData.classTeacherOf : [],
      ...cleanTeacherData,
      email: portalEmail
    };
    db.teachers = [newTeacher, ...db.teachers];
    persistDb();

    const provisioned = this.provisionPortalUser({
      email: portalEmail,
      password: rawPortalPass || rawPass,
      name: newTeacher.name,
      role: 'teacher',
      teacherId: newTeacher.id
    });

    supabaseMirrorUpsert('teachers', {
      id: newTeacher.id,
      name: newTeacher.name,
      staff_id: newTeacher.staffId,
      email: newTeacher.email || '',
      phone: newTeacher.phone || '',
      qualification: newTeacher.qualification || '',
      address: newTeacher.address || '',
      date_of_birth: newTeacher.dateOfBirth || '',
      start_date: newTeacher.startDate || '',
      position: newTeacher.position || 'Subject Teacher',
      department: newTeacher.department || 'Academic Faculty',
      emergency_contact: newTeacher.emergencyContact || {},
      assigned_classes: newTeacher.assignedClasses,
      class_teacher_of: newTeacher.classTeacherOf || [],
      avatar_url: newTeacher.avatarUrl || '',
      status: newTeacher.status
    });
    broadcastChange('teachers', 'created');
    return {
      ...newTeacher,
      ...('credentials' in provisioned && provisioned.credentials ? { portalCredentials: provisioned.credentials } : {})
    };
  },

  updateTeacher(id: string, updates: any) {
    let target: any = null;
    db.teachers = db.teachers.map((t) => {
      if (t.id !== id) return t;
      target = { ...t, ...updates };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('teachers', {
      id: target.id,
      name: target.name,
      staff_id: target.staffId || '',
      email: target.email || '',
      phone: target.phone || '',
      qualification: target.qualification || '',
      address: target.address || '',
      date_of_birth: target.dateOfBirth || '',
      start_date: target.startDate || '',
      position: target.position || 'Subject Teacher',
      department: target.department || 'Academic Faculty',
      emergency_contact: target.emergencyContact || {},
      assigned_classes: target.assignedClasses || [],
      class_teacher_of: target.classTeacherOf || [],
      avatar_url: target.avatarUrl || '',
      status: target.status || 'active'
    });
    broadcastChange('teachers', 'updated');
    return target;
  },

  assignTeacherClass(teacherId: string, classSubject: { class: string; subject: string }) {
    const teacher = this.getTeacherById(teacherId);
    if (!teacher) return null;
    const existing = teacher.assignedClasses || [];
    const already = existing.some(
      (ac: any) => ac.class === classSubject.class && ac.subject === classSubject.subject
    );
    if (already) return teacher;
    return this.updateTeacher(teacherId, { assignedClasses: [...existing, classSubject] });
  },

  removeTeacherClass(teacherId: string, classSubject: any) {
    const teacher = this.getTeacherById(teacherId);
    if (!teacher) return null;
    const targetClass =
      typeof classSubject === 'object' && classSubject
        ? classSubject.class || classSubject.className || ''
        : String(classSubject || '');
    const targetSubject =
      typeof classSubject === 'object' && classSubject
        ? classSubject.subject || classSubject.subjectName || ''
        : '';
    const next = (teacher.assignedClasses || []).filter(
      (ac: any) => !(ac.class === targetClass && (!targetSubject || ac.subject === targetSubject))
    );
    return this.updateTeacher(teacherId, { assignedClasses: next });
  },

  deleteTeacher(id: string) {
    const before = db.teachers.length;
    const target = this.getTeacherById(id);
    db.teachers = db.teachers.filter((t) => t.id !== id);
    if (db.teachers.length === before) return false;

    // Clear class_teacher on any classes this teacher owned
    (db.classes || []).forEach((c) => {
      if (c.classTeacherId === id) {
        c.classTeacherId = '';
        c.classTeacherName = '';
        supabaseMirrorUpsert('classes', {
          id: c.id,
          name: c.name,
          category: c.category,
          class_teacher_id: '',
          class_teacher_name: ''
        });
      }
    });

    const linkedUserIds = db.users.filter((u) => u.teacherId === id).map((u) => u.id);
    db.users = db.users.filter((u) => u.teacherId !== id);
    persistDb();
    supabaseMirrorDelete('teachers', id);
    linkedUserIds.forEach((uid) => supabaseMirrorDelete('portal_users', uid));
    broadcastChange('teachers', 'deleted');
    broadcastChange('classes', 'updated');
    return true;
  },

  getTimetableSlots(className?: string) {
    const sorted = [...db.timetable].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    if (!className) return sorted;
    return sorted.filter((s) => s.class === className || s.class === 'All Classes');
  },

  addTimetableSlot(slotData: any) {
    const defaultCls = (db.classes && db.classes[0]?.name) || 'JSS 1';
    const newSlot = {
      id: slotData.id || `tt_${Date.now()}`,
      type: 'lesson',
      class: slotData.class || defaultCls,
      ...slotData,
      updatedAt: new Date().toISOString()
    };
    db.timetable.push(newSlot);
    persistDb();
    supabaseMirrorUpsert('timetable_slots', {
      id: newSlot.id,
      class: newSlot.class,
      day: newSlot.day,
      start_time: newSlot.startTime,
      end_time: newSlot.endTime,
      type: newSlot.type,
      title: newSlot.title || newSlot.subject || '',
      subject: newSlot.subject || '',
      teacher_id: newSlot.teacherId || '',
      teacher_name: newSlot.teacherName || '',
      notes: newSlot.notes || '',
      updated_by: newSlot.updatedBy || '',
      updated_at: newSlot.updatedAt
    });
    broadcastChange('timetable_slots', 'created');
    return newSlot;
  },

  updateTimetableSlot(id: string, patch: any) {
    let target: any = null;
    db.timetable = db.timetable.map((s) => {
      if (s.id !== id) return s;
      target = { ...s, ...patch, updatedAt: new Date().toISOString() };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('timetable_slots', {
      id: target.id,
      class: target.class,
      day: target.day,
      start_time: target.startTime,
      end_time: target.endTime,
      type: target.type,
      title: target.title || target.subject || '',
      subject: target.subject || '',
      teacher_id: target.teacherId || '',
      teacher_name: target.teacherName || '',
      notes: target.notes || '',
      updated_by: target.updatedBy || '',
      updated_at: target.updatedAt
    });
    broadcastChange('timetable_slots', 'updated');
    return target;
  },

  deleteTimetableSlot(id: string) {
    const before = db.timetable.length;
    db.timetable = db.timetable.filter((s) => s.id !== id);
    if (db.timetable.length === before) return false;
    persistDb();
    supabaseMirrorDelete('timetable_slots', id);
    broadcastChange('timetable_slots', 'deleted');
    return true;
  },

  rescheduleTeacherSlot(
    slotId: string,
    targetDay: string,
    targetStartTime: string,
    targetEndTime: string,
    actorTeacherName: string
  ) {
    const targetSlot = db.timetable.find((s) => s.id === slotId);
    if (!targetSlot) return { success: false, message: 'Class period not found.' };

    const fixedBlock = db.timetable.find(
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

    const occupiedLesson = db.timetable.find(
      (s) =>
        s.id !== slotId &&
        s.day === targetDay &&
        s.class === targetSlot.class &&
        s.type === 'lesson' &&
        slotsOverlap(s.startTime, s.endTime, targetStartTime, targetEndTime)
    );

    const changedSlots: any[] = [];
    const affectedTeacher = occupiedLesson ? occupiedLesson.teacherName : null;

    db.timetable = db.timetable.map((s) => {
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
        return next;
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
        return next;
      }
      return s;
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

    db.alerts = [...newAlerts, ...db.alerts];
    persistDb();
    supabaseMirrorUpsert(
      'timetable_slots',
      changedSlots.map((s) => ({
        id: s.id,
        class: s.class,
        day: s.day,
        start_time: s.startTime,
        end_time: s.endTime,
        type: s.type,
        title: s.title || s.subject || '',
        subject: s.subject || '',
        teacher_id: s.teacherId || '',
        teacher_name: s.teacherName || '',
        notes: s.notes || '',
        updated_by: s.updatedBy || '',
        updated_at: s.updatedAt
      }))
    );
    supabaseMirrorUpsert(
      'timetable_alerts',
      newAlerts.map((a) => ({
        id: a.id,
        role: a.role,
        target_class: a.targetClass || '',
        target_teacher: a.targetTeacher || '',
        title: a.title,
        message: a.message,
        read: a.read,
        created_at: a.createdAt
      }))
    );
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

  getAlerts() {
    return db.alerts;
  },

  dismissAlert(id: string) {
    const before = db.alerts.length;
    db.alerts = db.alerts.filter((a) => a.id !== id);
    if (db.alerts.length === before) return false;
    persistDb();
    supabaseMirrorDelete('timetable_alerts', id);
    broadcastChange('timetable_alerts', 'deleted');
    return true;
  },

  getAttendance() {
    return db.attendance;
  },

  saveClassAttendance(date: string, className: string, submittedBy: string, records: Record<string, any>) {
    const key = `${date}_${className}`;
    const classStudents = (db.students || []).filter((s) => s.class === className);
    const binaryRecords: Record<string, 'present' | 'absent'> = {};

    // For every student in this class: marked present if checked/present, else absent!
    classStudents.forEach((student) => {
      const val = records ? records[student.id] : undefined;
      const isPresent = val === 'present' || val === true || val === 'Present' || val === 1;
      binaryRecords[student.id] = isPresent ? 'present' : 'absent';
    });

    // Also include any other student records passed
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
    db.attendance[key] = entry;
    persistDb();
    supabaseMirrorUpsert(
      'attendance_records',
      {
        record_key: key,
        date,
        class_name: className,
        submitted_by: submittedBy,
        timestamp_label: entry.timestamp,
        records: entry.records,
        updated_at: new Date().toISOString()
      },
      'record_key'
    );

    // Update attendance_rate on students in this class
    classStudents.forEach((st) => {
      const history = this.getStudentAttendanceHistory(st.id);
      st.attendanceRate = history.attendanceRate;
      supabaseMirrorUpsert('students', {
        id: st.id,
        name: st.name,
        attendance_rate: st.attendanceRate
      });
    });

    broadcastChange('attendance_records', 'updated');
    return entry;
  },

  getStudentAttendanceHistory(studentId: string) {
    const logs: any[] = [];
    Object.values(db.attendance).forEach((entry: any) => {
      if (entry.records && entry.records[studentId]) {
        const rawStatus = entry.records[studentId];
        const status = (rawStatus === 'present' || rawStatus === true || rawStatus === 'Present') ? 'present' : 'absent';
        logs.push({
          date: entry.date,
          className: entry.className,
          status,
          submittedBy: entry.submittedBy,
          timestamp: entry.timestamp
        });
      }
    });
    logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const total = logs.length;
    const presentCount = logs.filter((l) => l.status === 'present').length;
    const absentCount = logs.filter((l) => l.status === 'absent').length;
    const student = this.getStudentById(studentId);
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

  getGrades() {
    return db.grades;
  },

  saveGrade(studentId: string, term: string, subject: string, gradeEntry: any, session = '2026/2027') {
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
    db.grades[key] = entry;
    persistDb();
    supabaseMirrorUpsert(
      'grades',
      {
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
      },
      'grade_key'
    );
    broadcastChange('grades', 'updated');
    return entry;
  },

  getStudentSubjectGrade(studentId: string, term: string, subject: string, session = '2026/2027') {
    const sessionKey = `${studentId}_${session}_${term}_${subject}`;
    if (db.grades[sessionKey]) return { ...db.grades[sessionKey], isRecorded: true };
    const legacyKey = `${studentId}_${term}_${subject}`;
    if (session === '2026/2027' && db.grades[legacyKey]) return { ...db.grades[legacyKey], isRecorded: true };

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

  getStudentReportCard(studentId: string, term = 'Term1', session = '2026/2027') {
    const rawStudent = this.getStudentById(studentId);
    if (!rawStudent) return null;
    const student = {
      ...rawStudent,
      dateOfBirth: rawStudent.dateOfBirth || rawStudent.dob || 'Not Provided'
    };
    const validClassSubjects = this.getSubjectsForClass(student.class, student.department);
    const subjects = (student.enrolledSubjects && student.enrolledSubjects.length > 0)
      ? student.enrolledSubjects.filter((s: string) => validClassSubjects.includes(s))
      : validClassSubjects.slice(0, 6);
    const effectiveSubjects = subjects.length > 0 ? subjects : validClassSubjects.slice(0, 6);

    const subjectScores = effectiveSubjects.map((sub: string) => {
      const score = this.getStudentSubjectGrade(studentId, term, sub, session);
      const classStudents = db.students.filter((s) => s.class === student.class);
      let position = '-';
      if (score.total > 0 && classStudents.length > 0) {
        const totals = classStudents
          .map((cs) => this.getStudentSubjectGrade(cs.id, term, sub, session).total)
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
    const att = this.getStudentAttendanceHistory(studentId);
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

    const classStudents = db.students.filter((s) => s.class === student.class);
    let position = '-';
    if (recordedScores.length > 0 && classStudents.length > 0) {
      const cohortTotals = classStudents
        .map((cs) =>
          effectiveSubjects.reduce(
            (sum: number, sub: string) => sum + this.getStudentSubjectGrade(cs.id, term, sub, session).total,
            0
          )
        )
        .sort((a, b) => b - a);
      const rankNum = Math.max(1, cohortTotals.indexOf(totalObtained) + 1);
      const suffix = rankNum === 1 ? 'st' : rankNum === 2 ? 'nd' : rankNum === 3 ? 'rd' : 'th';
      position = `${rankNum}${suffix} out of ${classStudents.length}`;
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

  getResources() {
    return db.resources;
  },

  addResource(data: any) {
    const newItem = {
      id: data.id || `res_${Date.now()}`,
      uploadDate: new Date().toISOString().split('T')[0],
      downloads: 0,
      status: 'active',
      ...data
    };
    db.resources = [newItem, ...db.resources];
    persistDb();
    supabaseMirrorUpsert('resources', {
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
    });
    broadcastChange('resources', 'created');
    return newItem;
  },

  updateResource(id: string, patch: any) {
    let target: any = null;
    db.resources = db.resources.map((r) => {
      if (r.id !== id) return r;
      target = { ...r, ...patch };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('resources', {
      id: target.id,
      title: target.title,
      type: target.type || 'document',
      subject: target.subject || '',
      description: target.description || '',
      classes: target.classes || ['All Classes'],
      access_level: target.accessLevel || 'students',
      file_name: target.fileName || '',
      file_size: target.fileSize || '',
      file_path: target.filePath || '',
      file_url: target.fileUrl || '',
      uploaded_by: target.uploadedBy || '',
      upload_date: target.uploadDate || '',
      downloads: target.downloads ?? 0,
      status: target.status || 'active'
    });
    broadcastChange('resources', 'updated');
    return target;
  },

  deleteResource(id: string) {
    const before = db.resources.length;
    db.resources = db.resources.filter((r) => r.id !== id);
    if (db.resources.length === before) return false;
    persistDb();
    supabaseMirrorDelete('resources', id);
    broadcastChange('resources', 'deleted');
    return true;
  },

  getEquipment() {
    return db.equipment;
  },

  addEquipment(data: any) {
    const newItem = {
      id: data.id || `eq_${Date.now()}`,
      addedDate: new Date().toISOString().split('T')[0],
      available: Number(data.available ?? data.quantity ?? 1),
      quantity: Number(data.quantity ?? 1),
      ...data
    };
    db.equipment = [newItem, ...db.equipment];
    persistDb();
    supabaseMirrorUpsert('equipment', {
      id: newItem.id,
      name: newItem.name,
      category: newItem.category || 'Laboratory',
      quantity: newItem.quantity,
      available: newItem.available,
      location: newItem.location || '',
      condition: newItem.condition || 'Good',
      added_date: newItem.addedDate
    });
    broadcastChange('equipment', 'created');
    return newItem;
  },

  deleteEquipment(id: string) {
    const before = db.equipment.length;
    db.equipment = db.equipment.filter((e) => e.id !== id);
    if (db.equipment.length === before) return false;
    persistDb();
    supabaseMirrorDelete('equipment', id);
    broadcastChange('equipment', 'deleted');
    return true;
  },

  getMaintenance() {
    return db.maintenance;
  },

  addMaintenance(data: any) {
    const newItem = {
      id: data.id || `mnt_${Date.now()}`,
      reportedDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      ...data
    };
    db.maintenance = [newItem, ...db.maintenance];
    persistDb();
    supabaseMirrorUpsert('maintenance_requests', {
      id: newItem.id,
      item_name: newItem.itemName,
      issue: newItem.issue || '',
      priority: newItem.priority || 'medium',
      status: newItem.status,
      reported_date: newItem.reportedDate,
      reported_by: newItem.reportedBy || ''
    });
    broadcastChange('maintenance_requests', 'created');
    return newItem;
  },

  updateMaintenanceStatus(id: string, status: string) {
    let target: any = null;
    db.maintenance = db.maintenance.map((m) => {
      if (m.id !== id) return m;
      target = { ...m, status };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('maintenance_requests', {
      id: target.id,
      item_name: target.itemName,
      issue: target.issue || '',
      priority: target.priority || 'medium',
      status: target.status,
      reported_date: target.reportedDate || '',
      reported_by: target.reportedBy || ''
    });
    broadcastChange('maintenance_requests', 'updated');
    return target;
  },

  getDocuments() {
    return db.documents;
  },

  addDocument(data: any) {
    const newDoc = {
      id: data.id || `doc_${Date.now()}`,
      uploadDate: new Date().toISOString().split('T')[0],
      downloads: 0,
      status: 'active',
      allowedClasses: ['All Classes'],
      accessLevel: 'all',
      ...data
    };
    db.documents = [newDoc, ...db.documents];
    persistDb();
    supabaseMirrorUpsert('documents', {
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
    });
    broadcastChange('documents', 'created');
    return newDoc;
  },

  updateDocumentAccess(id: string, accessLevel: string, allowedClasses = ['All Classes']) {
    let target: any = null;
    db.documents = db.documents.map((d) => {
      if (d.id !== id) return d;
      target = { ...d, accessLevel, allowedClasses };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('documents', {
      id: target.id,
      name: target.name,
      category: target.category || 'Policy & Handbook',
      type: target.type || 'PDF',
      size: target.size || '',
      file_name: target.fileName || '',
      file_path: target.filePath || '',
      file_url: target.fileUrl || '',
      folder_id: target.folderId || target.category || '',
      access_level: target.accessLevel,
      allowed_classes: target.allowedClasses,
      description: target.description || '',
      uploaded_by: target.uploadedBy || '',
      upload_date: target.uploadDate || '',
      downloads: target.downloads ?? 0,
      status: target.status || 'active'
    });
    broadcastChange('documents', 'updated');
    return target;
  },

  deleteDocument(id: string) {
    const before = db.documents.length;
    db.documents = db.documents.filter((d) => d.id !== id);
    if (db.documents.length === before) return false;
    persistDb();
    supabaseMirrorDelete('documents', id);
    broadcastChange('documents', 'deleted');
    return true;
  },

  getAnnouncements() {
    return db.announcements;
  },

  addAnnouncement(data: any) {
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
    db.announcements = [newAnn, ...db.announcements];
    persistDb();
    supabaseMirrorUpsert('announcements', {
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
    });
    broadcastChange('announcements', 'created');
    return newAnn;
  },

  updateAnnouncement(id: string, patch: any) {
    let target: any = null;
    db.announcements = db.announcements.map((a) => {
      if (a.id !== id) return a;
      target = { ...a, ...patch };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('announcements', {
      id: target.id,
      title: target.title,
      content: target.content,
      type: target.type || 'general',
      priority: target.priority || 'medium',
      author: target.author || '',
      author_role: target.authorRole || '',
      date: target.date || '',
      event_date: target.eventDate || '',
      event_time: target.eventTime || '',
      location: target.location || '',
      is_pinned: Boolean(target.isPinned),
      status: target.status || 'published',
      target_audiences: target.targetAudiences || ['Everyone'],
      attachments: target.attachments || [],
      views: target.views ?? 0
    });
    broadcastChange('announcements', 'updated');
    return target;
  },

  deleteAnnouncement(id: string) {
    const before = db.announcements.length;
    db.announcements = db.announcements.filter((a) => a.id !== id);
    if (db.announcements.length === before) return false;
    persistDb();
    supabaseMirrorDelete('announcements', id);
    broadcastChange('announcements', 'deleted');
    return true;
  },

  getTeacherAvailability() {
    return db.availability;
  },

  addTeacherAvailabilitySlot(slot: any) {
    const newSlot = {
      id: slot.id || `av_${Date.now()}`,
      isAvailable: true,
      ...slot
    };
    db.availability.push(newSlot);
    persistDb();
    supabaseMirrorUpsert('teacher_availability', {
      id: newSlot.id,
      teacher_id: newSlot.teacherId || '',
      teacher_name: newSlot.teacherName || '',
      day: newSlot.day || 'Monday',
      start_time: newSlot.startTime || '14:20',
      end_time: newSlot.endTime || '15:50',
      is_available: Boolean(newSlot.isAvailable),
      note: newSlot.note || ''
    });
    broadcastChange('teacher_availability', 'created');
    return newSlot;
  },

  toggleTeacherAvailabilitySlot(id: string) {
    let target: any = null;
    db.availability = db.availability.map((s) => {
      if (s.id !== id) return s;
      target = { ...s, isAvailable: !s.isAvailable };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('teacher_availability', {
      id: target.id,
      teacher_id: target.teacherId || '',
      teacher_name: target.teacherName || '',
      day: target.day || 'Monday',
      start_time: target.startTime || '14:20',
      end_time: target.endTime || '15:50',
      is_available: Boolean(target.isAvailable),
      note: target.note || ''
    });
    broadcastChange('teacher_availability', 'updated');
    return target;
  },

  deleteTeacherAvailabilitySlot(id: string) {
    const before = db.availability.length;
    db.availability = db.availability.filter((s) => s.id !== id);
    if (db.availability.length === before) return false;
    persistDb();
    supabaseMirrorDelete('teacher_availability', id);
    broadcastChange('teacher_availability', 'deleted');
    return true;
  },

  getAssignments() {
    return db.assignments;
  },

  addAssignment(data: any) {
    const defaultClass = (db.classes && db.classes[0]?.name) || 'JSS 1';
    const newItem = {
      id: data.id || `asg_${Date.now()}`,
      status: 'published',
      submittedStudents: 0,
      totalStudents: 35,
      submissions: [],
      class: data.class || defaultClass,
      ...data
    };
    db.assignments = [newItem, ...db.assignments];
    persistDb();
    supabaseMirrorUpsert('assignments', {
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
    });
    broadcastChange('assignments', 'created');
    return newItem;
  },

  updateAssignment(id: string, patch: any) {
    let target: any = null;
    db.assignments = db.assignments.map((a) => {
      if (a.id !== id) return a;
      target = { ...a, ...patch };
      return target;
    });
    if (!target) return null;
    persistDb();
    const defaultClass = (db.classes && db.classes[0]?.name) || 'JSS 1';
    supabaseMirrorUpsert('assignments', {
      id: target.id,
      title: target.title,
      subject: target.subject || '',
      class: target.class || defaultClass,
      description: target.description || '',
      due_date: target.dueDate || '',
      total_marks: Number(target.totalMarks ?? target.maxMarks ?? 20),
      max_marks: Number(target.maxMarks ?? target.totalMarks ?? 20),
      type: target.type || 'homework',
      status: target.status || 'published',
      teacher_name: target.teacherName || '',
      attachment_name: target.attachmentName || '',
      attachment_size: target.attachmentSize || '',
      attachment_path: target.attachmentPath || '',
      attachment_url: target.attachmentUrl || '',
      attachments: target.attachments || [],
      submitted_students: Number(target.submittedStudents ?? (target.submissions?.length || 0)),
      total_students: Number(target.totalStudents ?? 35),
      submissions: target.submissions || []
    });
    broadcastChange('assignments', 'updated');
    return target;
  },

  deleteAssignment(id: string) {
    const before = db.assignments.length;
    db.assignments = db.assignments.filter((a) => a.id !== id);
    if (db.assignments.length === before) return false;
    persistDb();
    supabaseMirrorDelete('assignments', id);
    broadcastChange('assignments', 'deleted');
    return true;
  },

  submitStudentAssignment(
    assignmentId: string,
    student: { id: string; name: string },
    payload: { notes?: string; fileName?: string; fileUrl?: string; filePath?: string }
  ) {
    const existing = db.assignments.find((a) => a.id === assignmentId);
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

  getRequests() {
    return db.requests;
  },

  addRequest(reqData: any) {
    const newReq = {
      id: reqData.id || `req_${Date.now()}`,
      status: 'pending',
      submittedDate: new Date().toISOString(),
      ...reqData
    };
    db.requests = [newReq, ...db.requests];
    persistDb();
    supabaseMirrorUpsert('student_requests', {
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
    });
    broadcastChange('student_requests', 'created');
    return newReq;
  },

  updateRequestStatus(id: string, status: string, staffResponse = '') {
    let target: any = null;
    db.requests = db.requests.map((r) => {
      if (r.id !== id) return r;
      target = {
        ...r,
        status,
        staffResponse: staffResponse || r.staffResponse || '',
        reviewedAt: new Date().toISOString()
      };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('student_requests', {
      id: target.id,
      student_id: target.studentId || '',
      student_name: target.studentName || '',
      admission_number: target.admissionNumber || '',
      class: target.class || '',
      title: target.title || '',
      subject: target.subject || '',
      request_type: target.requestType || 'booking',
      priority: target.priority || 'medium',
      status: target.status,
      submitted_date: target.submittedDate || '',
      preferred_date: target.preferredDate || '',
      preferred_time: target.preferredTime || '',
      duration: target.duration || '',
      preferred_teacher: target.preferredTeacher || '',
      message: target.message || '',
      staff_response: target.staffResponse || '',
      reviewed_at: target.reviewedAt || ''
    });
    broadcastChange('student_requests', 'updated');
    return target;
  },

  getEnquiries() {
    return db.enquiries;
  },

  addEnquiry(kind: string, payload: any) {
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
    db.enquiries = [entry, ...db.enquiries];
    persistDb();
    supabaseMirrorUpsert('enquiries', {
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
    });
    broadcastChange('enquiries', 'created');
    return entry;
  },

  getDirectMessages() {
    return db.messages || [];
  },

  addDirectMessage(data: any) {
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
    db.messages = [entry, ...(db.messages || [])];
    persistDb();
    supabaseMirrorUpsert('direct_messages', {
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
    });
    broadcastChange('direct_messages', 'created');
    return entry;
  },

  getStaffLeaves(teacherId?: string) {
    const list = db.leaves || [];
    if (!teacherId) return list;
    return list.filter((l) => l.teacherId === teacherId);
  },

  addStaffLeave(data: any) {
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
    db.leaves = [entry, ...(db.leaves || [])];
    persistDb();
    supabaseMirrorUpsert('staff_leaves', {
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
    });
    broadcastChange('staff_leaves', 'created');
    return entry;
  },

  updateStaffLeaveStatus(id: string, status: string, approvedBy = '') {
    let target: any = null;
    db.leaves = (db.leaves || []).map((l) => {
      if (l.id !== id) return l;
      target = { ...l, status, approvedBy: approvedBy || l.approvedBy };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('staff_leaves', {
      id: target.id,
      teacher_id: target.teacherId,
      teacher_name: target.teacherName,
      type: target.type,
      start_date: target.startDate,
      end_date: target.endDate,
      days: target.days,
      reason: target.reason,
      status: target.status,
      submitted_date: target.submittedDate,
      approved_by: target.approvedBy
    });
    broadcastChange('staff_leaves', 'updated');
    return target;
  },

  getHelpTickets(studentId?: string) {
    const list = db.tickets || [];
    if (!studentId) return list;
    return list.filter((tk) => tk.studentId === studentId);
  },

  addHelpTicket(data: any) {
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
    db.tickets = [entry, ...(db.tickets || [])];
    persistDb();
    supabaseMirrorUpsert('help_tickets', {
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
    });
    broadcastChange('help_tickets', 'created');
    return entry;
  },

  addHelpTicketReply(ticketId: string, reply: any) {
    let target: any = null;
    db.tickets = (db.tickets || []).map((tk) => {
      if (tk.id !== ticketId) return tk;
      const responses = [...(tk.responses || []), reply];
      target = { ...tk, responses, lastUpdated: new Date().toISOString().split('T')[0] };
      return target;
    });
    if (!target) return null;
    persistDb();
    supabaseMirrorUpsert('help_tickets', {
      id: target.id,
      student_id: target.studentId,
      student_name: target.studentName,
      subject: target.subject,
      description: target.description,
      category: target.category,
      priority: target.priority,
      status: target.status,
      assigned_to: target.assignedTo,
      created_date: target.createdDate,
      last_updated: target.lastUpdated,
      responses: target.responses
    });
    broadcastChange('help_tickets', 'updated');
    return target;
  },

  generatePasswordResetOtp(identifier: string) {
    const clean = String(identifier || '').trim().toLowerCase();
    if (!clean) return { error: 'Please enter your email, student admission number, or staff ID.' };

    let user = db.users.find((u) => u.email.toLowerCase() === clean);
    if (!user) {
      const student = db.students.find(
        (s) => String(s.admissionNumber || '').trim().toLowerCase() === clean
      );
      if (student) user = db.users.find((u) => u.studentId === student.id);
    }
    if (!user) {
      const teacher = db.teachers.find(
        (t) => String(t.staffId || '').trim().toLowerCase() === clean
      );
      if (teacher) user = db.users.find((u) => u.teacherId === teacher.id);
    }

    if (!user) {
      return { error: 'No portal account found matching this identifier.' };
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    passwordResetOtps.set(user.email.toLowerCase(), {
      email: user.email.toLowerCase(),
      code: otp,
      expiresAt: Date.now() + 15 * 60 * 1000
    });

    console.log(`[Al-Amin Auth] Password reset OTP generated for ${user.email}: ${otp}`);

    return {
      success: true,
      email: user.email,
      maskedEmail: user.email.replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => `${a}***${c}`),
      otp
    };
  },

  resetPasswordWithOtp(identifier: string, otp: string, newPassword: string) {
    const clean = String(identifier || '').trim().toLowerCase();
    const cleanOtp = String(otp || '').trim();
    const cleanPassword = String(newPassword || '').trim();

    if (!cleanPassword || cleanPassword.length < 6) {
      return { error: 'New password must be at least 6 characters.' };
    }

    let user = db.users.find((u) => u.email.toLowerCase() === clean);
    if (!user) {
      const student = db.students.find(
        (s) => String(s.admissionNumber || '').trim().toLowerCase() === clean
      );
      if (student) user = db.users.find((u) => u.studentId === student.id);
    }
    if (!user) {
      const teacher = db.teachers.find(
        (t) => String(t.staffId || '').trim().toLowerCase() === clean
      );
      if (teacher) user = db.users.find((u) => u.teacherId === teacher.id);
    }

    if (!user) return { error: 'User account not found.' };

    const stored = passwordResetOtps.get(user.email.toLowerCase());
    if (!stored || stored.code !== cleanOtp || Date.now() > stored.expiresAt) {
      return { error: 'Invalid or expired OTP verification code.' };
    }

    user.passwordHash = hashPassword(cleanPassword);
    passwordResetOtps.delete(user.email.toLowerCase());

    supabaseMirrorUpsert('portal_users', {
      id: user.id,
      email: user.email,
      password_hash: user.passwordHash,
      updated_at: new Date().toISOString()
    });

    return { success: true, message: 'Password has been reset successfully. You can now log in.' };
  },

  updateUserAvatar(userId: string, avatarUrl: string) {
    let user = db.users.find((u) => u.id === userId);
    if (!user) {
      user = db.users.find((u) => u.teacherId === userId || u.studentId === userId);
    }
    if (user) {
      user.avatarUrl = avatarUrl;
      supabaseMirrorUpsert('portal_users', { id: user.id, avatar_url: avatarUrl });
      broadcastChange('users', 'updated');
    }

    const student = db.students.find((s) => s.id === userId || (user && s.id === user.studentId));
    if (student) {
      student.avatarUrl = avatarUrl;
      supabaseMirrorUpsert('students', { id: student.id, avatar_url: avatarUrl });
      broadcastChange('students', 'updated');
    }

    const teacher = db.teachers.find((t) => t.id === userId || (user && t.id === user.teacherId));
    if (teacher) {
      teacher.avatarUrl = avatarUrl;
      supabaseMirrorUpsert('teachers', { id: teacher.id, avatar_url: avatarUrl });
      broadcastChange('teachers', 'updated');
    }

    if (user) {
      const { passwordHash: _ignored, ...safeUser } = user;
      return safeUser;
    }
    return { id: userId, avatarUrl };
  },

  getPromotionCandidates(currentSession = '2026/2027') {
    return (db.students || []).map((student) => {
      const studentGrades = db.grades[student.id] || {};
      const subjectScores = Object.values(studentGrades).map((g: any) => Number(g.total) || 0);
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
        admissionNumber: student.admissionNumber,
        currentClass: student.class,
        department: student.department || '',
        averageScore: avg,
        suggestedClass: nextClass,
        suggestedAction: defaultAction
      };
    });
  },

  executeSessionRollover({
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

    promotions.forEach((p) => {
      const student = db.students.find((s) => s.id === p.studentId);
      if (!student) return;

      if (p.action === 'graduate') {
        student.status = 'Graduated';
        graduatedCount++;
      } else if (p.action === 'repeat') {
        repeatCount++;
      } else if (p.action === 'promote') {
        student.class = p.targetClass || student.class;
        if (p.department) student.department = p.department;
        promotedCount++;
      }

      supabaseMirrorUpsert('students', {
        id: student.id,
        class: student.class,
        department: student.department || '',
        status: student.status || 'active'
      });
    });

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

  getSettings() {
    return (
      db.settings || {
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
      }
    );
  },

  updateSettings(data: any) {
    db.settings = {
      ...this.getSettings(),
      ...(data || {}),
      updatedAt: new Date().toISOString()
    };
    persistDb();
    supabaseMirrorUpsert('institution_settings', {
      id: 'current',
      institution_name: db.settings.institutionName,
      established_year: db.settings.establishedYear,
      official_email: db.settings.officialEmail,
      phone: db.settings.phone,
      address: db.settings.address,
      website: db.settings.website,
      registration_number: db.settings.registrationNumber,
      timezone: db.settings.timezone,
      date_format: db.settings.dateFormat || 'dd-mm-yyyy',
      academic_term: db.settings.academicTerm || 'first-term',
      current_session: db.settings.currentSession || '2026/2027',
      current_term: db.settings.currentTerm || 'Term 1',
      language: db.settings.language || 'en',
      email_notifications: db.settings.emailNotifications ?? true,
      sms_alerts: db.settings.smsAlerts ?? false,
      maintenance_mode: db.settings.maintenanceMode ?? false,
      updated_at: db.settings.updatedAt
    });
    broadcastChange('settings');
    return db.settings;
  }
};
