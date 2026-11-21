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
    } else if (!errUsers) {
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
      console.log('[Al-Amin Store] Provisioned initial admin user to Supabase portal_users.');
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
        enrolledSubjects: s.enrolled_subjects || [],
        attendanceRate: s.attendance_rate || 0,
        gpa: s.gpa || '0.00',
        avatarUrl: s.avatar_url || '',
        status: s.status || 'active'
      }));
    }

    const { data: teachers } = await serverSupabase.from('teachers').select('*');
    if (teachers && teachers.length > 0) {
      db.teachers = teachers.map((t: any) => ({
        id: t.id,
        name: t.name,
        staffId: t.staff_id,
        email: t.email,
        phone: t.phone,
        qualification: t.qualification,
        assignedClasses: t.assigned_classes || [],
        formTeacherOf: t.form_teacher_of || '',
        avatarUrl: t.avatar_url || '',
        status: t.status || 'active'
      }));
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
        category: c.category || (isSeniorClass(c.name) ? 'Senior' : 'Junior')
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
      const studentGrades = user.studentId ? (db.grades[user.studentId] || {}) : {};

      const scopedAttendance: Record<string, any> = {};
      Object.keys(db.attendance || {}).forEach((date) => {
        const classRecords = db.attendance[date]?.[studentClass] || [];
        const studentRecord = classRecords.filter((r: any) => r.studentId === user.studentId);
        if (studentRecord.length > 0) {
          if (!scopedAttendance[date]) scopedAttendance[date] = {};
          scopedAttendance[date][studentClass] = studentRecord;
        }
      });

      return {
        classes: db.classes || [],
        subjects: db.subjects.filter((s) => s.allClasses || (Array.isArray(s.classes) && s.classes.includes(studentClass))),
        students: studentObj ? [studentObj] : [],
        teachers: db.teachers.map(({ phone, email, qualification, staffId, ...safe }) => safe),
        timetable: db.timetable.filter((t) => t.class === studentClass),
        alerts: db.alerts.filter((a) => !a.targetRole || a.targetRole === 'all' || a.targetRole === 'student'),
        attendance: scopedAttendance,
        grades: { [user.studentId]: studentGrades },
        resources: db.resources.filter((r) => !r.class || r.class === studentClass),
        equipment: [],
        maintenance: [],
        documents: db.documents.filter((d) => d.access === 'all' || d.access === 'student'),
        announcements: db.announcements.filter((a) => !a.targetRole || a.targetRole === 'all' || a.targetRole === 'student'),
        availability: db.availability,
        assignments: db.assignments.filter((a) => !a.class || a.class === studentClass),
        requests: db.requests.filter((r) => r.studentId === user.studentId)
      };
    }

    if (user.role === 'teacher') {
      const teacherObj = db.teachers.find((t) => t.id === user.teacherId) || null;
      const assigned = teacherObj?.assignedClasses || [];
      const assignedClassNames = assigned.map((a: any) => a.class);
      return {
        classes: db.classes || [],
        subjects: db.subjects,
        students: db.students.filter((s) => assignedClassNames.includes(s.class)),
        teachers: db.teachers,
        timetable: db.timetable.filter((t) => t.teacherId === user.teacherId || assignedClassNames.includes(t.class)),
        alerts: db.alerts.filter((a) => !a.targetRole || a.targetRole === 'all' || a.targetRole === 'teacher'),
        attendance: db.attendance,
        grades: db.grades,
        resources: db.resources,
        equipment: db.equipment,
        maintenance: db.maintenance,
        documents: db.documents.filter((d) => d.access !== 'admin'),
        announcements: db.announcements.filter((a) => !a.targetRole || a.targetRole === 'all' || a.targetRole === 'teacher'),
        availability: db.availability.filter((a) => a.teacherId === user.teacherId),
        assignments: db.assignments.filter((a) => a.teacherId === user.teacherId || assignedClassNames.includes(a.class)),
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

  addClass(classData: { name: string; category?: string }) {
    const cleanName = String(classData.name || '').trim();
    if (!cleanName) return { error: 'Class name is required.' };
    const exists = (db.classes || []).some((c) => c.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) return { error: `Class "${cleanName}" already exists.` };
    const newCls = {
      id: `cls-${Date.now()}`,
      name: cleanName,
      category: classData.category || (isSeniorClass(cleanName) ? 'Senior' : 'Junior')
    };
    db.classes = [...(db.classes || []), newCls];
    supabaseMirrorUpsert('classes', {
      id: newCls.id,
      name: newCls.name,
      category: newCls.category
    });
    broadcastChange('classes', 'created');
    return newCls;
  },

  deleteClass(id: string) {
    const existing = (db.classes || []).find((c) => c.id === id);
    if (!existing) return false;
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

  getStudents() {
    return db.students;
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
      enrolled_subjects: newStudent.enrolledSubjects || [],
      attendance_rate: newStudent.attendanceRate,
      gpa: String(newStudent.gpa),
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
      enrolled_subjects: target.enrolledSubjects || [],
      attendance_rate: target.attendanceRate ?? 100,
      gpa: String(target.gpa || '3.80'),
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

  getTeachers() {
    return db.teachers;
  },

  getTeacherById(id: string) {
    return db.teachers.find((t) => t.id === id) || null;
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
      assigned_classes: newTeacher.assignedClasses,
      form_teacher_of: newTeacher.formTeacherOf || '',
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
      assigned_classes: target.assignedClasses || [],
      form_teacher_of: target.formTeacherOf || '',
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

  removeTeacherClass(teacherId: string, classSubject: { class: string; subject: string }) {
    const teacher = this.getTeacherById(teacherId);
    if (!teacher) return null;
    const next = (teacher.assignedClasses || []).filter(
      (ac: any) => !(ac.class === classSubject.class && ac.subject === classSubject.subject)
    );
    return this.updateTeacher(teacherId, { assignedClasses: next });
  },

  deleteTeacher(id: string) {
    const before = db.teachers.length;
    db.teachers = db.teachers.filter((t) => t.id !== id);
    if (db.teachers.length === before) return false;
    const linkedUserIds = db.users.filter((u) => u.teacherId === id).map((u) => u.id);
    db.users = db.users.filter((u) => u.teacherId !== id);
    persistDb();
    supabaseMirrorDelete('teachers', id);
    linkedUserIds.forEach((uid) => supabaseMirrorDelete('portal_users', uid));
    broadcastChange('teachers', 'deleted');
    return true;
  },

  getTimetableSlots(className?: string) {
    const sorted = [...db.timetable].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    if (!className) return sorted;
    return sorted.filter((s) => s.class === className || s.class === 'All Classes');
  },

  addTimetableSlot(slotData: any) {
    const newSlot = {
      id: slotData.id || `tt_${Date.now()}`,
      type: 'lesson',
      class: 'SSS 2',
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

  saveClassAttendance(date: string, className: string, submittedBy: string, records: Record<string, string>) {
    const key = `${date}_${className}`;
    const entry = {
      date,
      className,
      submittedBy,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      records: records || {}
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
    broadcastChange('attendance_records', 'updated');
    return entry;
  },

  getStudentAttendanceHistory(studentId: string) {
    const logs: any[] = [];
    Object.values(db.attendance).forEach((entry: any) => {
      if (entry.records && entry.records[studentId]) {
        logs.push({
          date: entry.date,
          className: entry.className,
          status: entry.records[studentId],
          submittedBy: entry.submittedBy,
          timestamp: entry.timestamp
        });
      }
    });
    logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const total = logs.length || 1;
    const presentCount = logs.filter((l) => l.status === 'present').length;
    const lateCount = logs.filter((l) => l.status === 'late').length;
    const absentCount = logs.filter((l) => l.status === 'absent').length;
    const student = this.getStudentById(studentId);
    const rate = logs.length > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;
    const punctuality = logs.length > 0 ? Math.round((presentCount / total) * 100) : 0;

    return {
      student,
      logs,
      totalDays: logs.length,
      presentCount,
      lateCount,
      absentCount,
      attendanceRate: rate,
      punctualityRate: punctuality
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
    let position = 'N/A';
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
    const newItem = {
      id: data.id || `asg_${Date.now()}`,
      status: 'published',
      submittedStudents: 0,
      totalStudents: 35,
      submissions: [],
      ...data
    };
    db.assignments = [newItem, ...db.assignments];
    persistDb();
    supabaseMirrorUpsert('assignments', {
      id: newItem.id,
      title: newItem.title,
      subject: newItem.subject || '',
      class: newItem.class || 'SSS 2',
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
    supabaseMirrorUpsert('assignments', {
      id: target.id,
      title: target.title,
      subject: target.subject || '',
      class: target.class || 'SSS 2',
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
    const user = db.users.find((u) => u.id === userId);
    if (!user) return null;
    user.avatarUrl = avatarUrl;

    if (user.studentId) {
      const student = db.students.find((s) => s.id === user.studentId);
      if (student) {
        student.avatarUrl = avatarUrl;
        supabaseMirrorUpsert('students', { id: student.id, avatar_url: avatarUrl });
      }
    }
    if (user.teacherId) {
      const teacher = db.teachers.find((t) => t.id === user.teacherId);
      if (teacher) {
        teacher.avatarUrl = avatarUrl;
        supabaseMirrorUpsert('teachers', { id: teacher.id, avatar_url: avatarUrl });
      }
    }

    supabaseMirrorUpsert('portal_users', { id: user.id, avatar_url: avatarUrl });
    broadcastChange('users', 'updated');
    const { passwordHash: _ignored, ...safeUser } = user;
    return safeUser;
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
  }
};
