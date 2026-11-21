import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import {
  requireAuth,
  requireRole,
  signAuthToken,
  type AuthenticatedRequest
} from './auth.ts';
import {
  backendStore,
  resolveLocalUploadPath,
  subscribeServerEvents,
  uploadFileToBackendStorage
} from './store.ts';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

const paramStr = (val: string | string[] | undefined): string =>
  Array.isArray(val) ? String(val[0] || '') : String(val || '');

const paginateList = <T,>(items: T[], req: Request, extra: Record<string, unknown> = {}) => {
  const query = req.query as Record<string, string | undefined>;
  if (!query.page && !query.limit) return items;

  const requestedPage = Number(query.page);
  const requestedLimit = Number(query.limit);
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 100)
    : 20;
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const page = Math.min(
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    Math.max(totalPages, 1)
  );

  return {
    data: items.slice((page - 1) * limit, page * limit),
    total,
    page,
    limit,
    totalPages,
    ...extra
  };
};

/* ── System & Health ─────────────────────────────────────────────────────── */

router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Al-Amin Group of Schools REST API',
    docs: '/api/docs',
    health: '/api/health',
    version: '1.0.0'
  });
});

router.get('/ping', (_req: Request, res: Response) => {
  res.json({ pong: true, time: new Date().toISOString() });
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Al-Amin Group of Schools REST API',
    storageMode: backendStore.getStorageMode(),
    timestamp: new Date().toISOString()
  });
});

router.get('/bootstrap', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json(backendStore.getBootstrapPayload(req.user));
});

router.get('/events', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ resource: 'system', action: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const unsubscribe = subscribeServerEvents((evt) => {
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

/* ── Auth ────────────────────────────────────────────────────────────────── */

router.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const user = backendStore.authenticate(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (user.role === 'teacher') {
    const teacher = backendStore.getTeacherByEmailOrId(user.email, user.teacherId);
    if (teacher) {
      (user as any).classTeacherOf = teacher.classTeacherOf || [];
      (user as any).teacherId = teacher.id;
    }
  }
  const token = signAuthToken(user);
  res.json({ token, user });
});

router.post('/auth/register', (_req: Request, res: Response) => {
  return res.status(403).json({
    error: 'Self-registration is disabled. Only the School Administrator can add teacher and student accounts.'
  });
});

router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const freshUser = req.user ? backendStore.getUserById(req.user.id) : null;
  const user = freshUser || req.user;
  if (user && user.role === 'teacher') {
    const teacher = backendStore.getTeacherByEmailOrId(user.email, user.teacherId);
    if (teacher) {
      (user as any).classTeacherOf = teacher.classTeacherOf || [];
      (user as any).teacherId = teacher.id;
    }
  }
  res.json({ user });
});

router.post('/auth/logout', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.post('/auth/forgot-password', (req: Request, res: Response) => {
  const { identifier } = req.body || {};
  const result = backendStore.generatePasswordResetOtp(identifier);
  if (result.error) {
    return res.status(404).json(result);
  }
  res.json(result);
});

router.post('/auth/reset-password', (req: Request, res: Response) => {
  const { identifier, otp, newPassword } = req.body || {};
  const result = backendStore.resetPasswordWithOtp(identifier, otp, newPassword);
  if (result.error) {
    return res.status(400).json(result);
  }
  res.json(result);
});

const handleAvatarUpload = async (req: AuthenticatedRequest, res: Response) => {
  let file = req.file;
  if (!file && req.files) {
    if (Array.isArray(req.files) && req.files.length > 0) {
      file = req.files[0];
    } else if (typeof req.files === 'object') {
      const filesObj = req.files as Record<string, Express.Multer.File[]>;
      const firstKey = Object.keys(filesObj)[0];
      if (firstKey && filesObj[firstKey]?.[0]) {
        file = filesObj[firstKey][0];
      }
    }
  }

  const rawUrl = req.body?.avatarUrl || req.body?.imageUrl || req.body?.photoUrl || req.body?.image;
  if (!file && !rawUrl) {
    return res.status(400).json({ error: 'No image file or photo URL provided.' });
  }

  try {
    let avatarUrl = rawUrl || '';
    if (file) {
      const uploaded = await uploadFileToBackendStorage('avatars', file);
      avatarUrl = uploaded.fileUrl || `/files/download/${uploaded.filePath}`;
    }

    const targetUserId = paramStr(req.params.id) || req.user?.id || '';
    if (!targetUserId) {
      return res.status(400).json({ error: 'User target could not be identified.' });
    }

    const updatedUser = backendStore.updateUserAvatar(targetUserId, avatarUrl);
    res.json({ success: true, avatarUrl, user: updatedUser });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update avatar photo.' });
  }
};

const avatarEndpoints = [
  '/auth/profile/avatar',
  '/auth/avatar',
  '/profile/avatar',
  '/profile/picture',
  '/profile/photo',
  '/users/avatar',
  '/users/profile/avatar',
  '/avatar'
];

avatarEndpoints.forEach((routePath) => {
  router.post(routePath, requireAuth, upload.any(), handleAvatarUpload);
  router.put(routePath, requireAuth, upload.any(), handleAvatarUpload);
  router.patch(routePath, requireAuth, upload.any(), handleAvatarUpload);
});

router.post('/teachers/:id/avatar', requireAuth, upload.any(), handleAvatarUpload);
router.put('/teachers/:id/avatar', requireAuth, upload.any(), handleAvatarUpload);
router.post('/students/:id/avatar', requireAuth, upload.any(), handleAvatarUpload);
router.put('/students/:id/avatar', requireAuth, upload.any(), handleAvatarUpload);
router.post('/users/:id/avatar', requireAuth, upload.any(), handleAvatarUpload);
router.put('/users/:id/avatar', requireAuth, upload.any(), handleAvatarUpload);

/* ── Classes ─────────────────────────────────────────────────────────────── */

router.get('/classes', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getClasses());
});

router.post('/classes', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const result = backendStore.addClass(req.body || {});
  if ((result as any).error) {
    return res.status(400).json(result);
  }
  res.status(201).json(result);
});

router.post('/classes/:id/class-teacher', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { teacherId } = req.body || {};
  const classIdOrName = paramStr(req.params.id);
  const result = backendStore.assignClassTeacher(classIdOrName, teacherId);
  if ((result as any).error) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.put('/classes/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const classIdOrName = paramStr(req.params.id);
  const { teacherId, classTeacherId } = req.body || {};
  const targetTeacherId = classTeacherId !== undefined ? classTeacherId : teacherId;
  if (targetTeacherId !== undefined) {
    const result = backendStore.assignClassTeacher(classIdOrName, targetTeacherId);
    if ((result as any).error) {
      return res.status(400).json(result);
    }
    return res.json(result);
  }
  res.json({ ok: true });
});

router.delete('/classes/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const ok = backendStore.deleteClass(paramStr(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Class not found.' });
  res.json({ ok: true });
});

/* ── Subjects ────────────────────────────────────────────────────────────── */

router.get('/subjects', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  let subjects = backendStore.getSubjects();
  if (req.user?.role === 'student') {
    const student = backendStore.getStudentById(req.user.studentId || '');
    const enrolled = student?.enrolledSubjects || [];
    if (enrolled.length > 0) {
      subjects = subjects.filter((s: any) => enrolled.includes(s.name));
    } else {
      const studentClass = student?.class || '';
      subjects = subjects.filter(
        (s: any) => s.allClasses || (Array.isArray(s.classes) && s.classes.includes(studentClass))
      );
    }
  } else if (req.user?.role === 'teacher') {
    const teacher = backendStore.getTeacherById(req.user.teacherId || '');
    const assigned = teacher?.assignedClasses || [];
    const assignedSubjects = Array.from(new Set(assigned.map((a: any) => a.subject).filter(Boolean)));
    if (assignedSubjects.length > 0) {
      subjects = subjects.filter((s: any) => assignedSubjects.includes(s.name));
    }
  }

  const { class: className, department } = req.query as Record<string, string | undefined>;
  if (className) {
    subjects = subjects.filter((subject: any) =>
      subject.allClasses || (Array.isArray(subject.classes) && subject.classes.includes(className))
    );
  }
  if (department) {
    subjects = subjects.filter((subject: any) =>
      subject.allDepartments || !Array.isArray(subject.departments) || subject.departments.includes(department)
    );
  }
  res.json(subjects);
});

router.post('/subjects', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const created = backendStore.addSubject(req.body || {});
  if (!created) {
    return res.status(400).json({ error: 'Subject name is required.' });
  }
  res.status(201).json(created);
});

router.put('/subjects/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const updated = backendStore.updateSubject(paramStr(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: 'Subject not found.' });
  res.json(updated);
});

router.delete('/subjects/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.deleteSubject(id);
  if (!deleted) return res.status(404).json({ error: 'Subject not found.' });
  res.json({ ok: true, id });
});

/* ── Students ────────────────────────────────────────────────────────────── */

router.get('/students', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === 'student') {
    const student = backendStore.getStudentById(req.user.studentId || '');
    return res.json(student ? [student] : []);
  }

  const { search, class: className, department, subject, status, page, limit } = req.query as Record<string, string>;
  let allowedClasses: string[] | undefined = undefined;

  if (req.user?.role === 'teacher') {
    const teacher = backendStore.getTeacherById(req.user.teacherId || '');
    const teacherClasses = (teacher?.assignedClasses || []).map((ac: any) => ac.class);
    if (teacherClasses.length > 0) {
      allowedClasses = teacherClasses;
    }
  }

  const result = backendStore.getStudents({
    search,
    class: className,
    department,
    subject,
    status,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    allowedClasses
  });

  res.json(result);
});

router.get('/students/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const targetId = paramStr(req.params.id);
  if (req.user?.role === 'student' && req.user.studentId !== targetId) {
    return res.status(403).json({ error: 'Access denied. You can only view your own student record.' });
  }
  const student = backendStore.getStudentById(targetId);
  if (!student) return res.status(404).json({ error: 'Student not found.' });
  res.json(student);
});

router.post('/students', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { name, email, portalPassword, password } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Student name is required.' });
  const suppliedPassword = portalPassword || password;
  if (suppliedPassword && String(suppliedPassword).trim().length < 6) {
    return res.status(400).json({ error: 'Portal password must be at least 6 characters.' });
  }
  if (email && backendStore.isEmailTaken(email)) {
    return res.status(409).json({ error: `A portal account with email "${email}" already exists.` });
  }
  const created = backendStore.addStudent(req.body);
  res.status(201).json(created);
});

router.put('/students/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const updated = backendStore.updateStudent(paramStr(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: 'Student not found.' });
  res.json(updated);
});

router.post('/students/:id/credentials', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (password && String(password).trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const result = backendStore.setPortalCredentials('student', paramStr(req.params.id), email, password);
  if (!result) return res.status(404).json({ error: 'Student not found.' });
  if ('error' in result) return res.status(409).json({ error: result.error });
  res.json(result);
});

router.post('/students/:id/enroll-subject', requireAuth, (req: Request, res: Response) => {
  const { subject } = req.body || {};
  if (!subject) return res.status(400).json({ error: 'Subject name is required.' });
  const updated = backendStore.enrollStudentSubject(paramStr(req.params.id), subject);
  if (!updated) return res.status(404).json({ error: 'Student not found.' });
  res.json(updated);
});

router.delete('/students/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.deleteStudent(id);
  if (!deleted) return res.status(404).json({ error: 'Student not found.' });
  res.json({ ok: true, id });
});

/* ── Teachers ────────────────────────────────────────────────────────────── */

router.get('/teachers', requireAuth, (req: Request, res: Response) => {
  const { search, class: className, subject, status, page, limit } = req.query as Record<string, string>;
  const result = backendStore.getTeachers({
    search,
    class: className,
    subject,
    status,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined
  });
  res.json(result);
});

router.get('/teachers/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can access their teacher profile.' });
  }
  const teacher = backendStore.getTeacherByEmailOrId(req.user.email, req.user.teacherId);
  if (!teacher) return res.status(404).json({ error: 'Teacher profile not found.' });
  res.json(teacher);
});

router.get('/teachers/:id', requireAuth, (req: Request, res: Response) => {
  const teacher = backendStore.getTeacherById(paramStr(req.params.id));
  if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });
  res.json(teacher);
});

router.post('/teachers', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { name, email, portalPassword, password } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Teacher name is required.' });
  if (!email) return res.status(400).json({ error: 'Teacher school email is required.' });
  const suppliedPassword = portalPassword || password;
  if (suppliedPassword && String(suppliedPassword).trim().length < 6) {
    return res.status(400).json({ error: 'Portal password must be at least 6 characters.' });
  }
  if (backendStore.isEmailTaken(email)) {
    return res.status(409).json({ error: `A portal account with email "${email}" already exists.` });
  }
  const created = backendStore.addTeacher(req.body);
  res.status(201).json(created);
});

router.post('/teachers/:id/credentials', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (password && String(password).trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const result = backendStore.setPortalCredentials('teacher', paramStr(req.params.id), email, password);
  if (!result) return res.status(404).json({ error: 'Teacher not found.' });
  if ('error' in result) return res.status(409).json({ error: result.error });
  res.json(result);
});

router.put('/teachers/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const updated = backendStore.updateTeacher(paramStr(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: 'Teacher not found.' });
  res.json(updated);
});

router.post('/teachers/:id/assign-class', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const body = req.body || {};
  const className = String(body.class || body.className || body.classSubject?.class || '');
  const subject = String(body.subject || body.subjectName || body.classSubject?.subject || '');
  if (!className || !subject) {
    return res.status(400).json({ error: 'Both class and subject are required.' });
  }
  const updated = backendStore.assignTeacherClass(paramStr(req.params.id), { class: className, subject });
  if (!updated) return res.status(404).json({ error: 'Teacher not found.' });
  res.json(updated);
});

router.delete('/teachers/:id/assign-class', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  let className = String(req.body?.class || req.query?.class || '');
  let subject = String(req.body?.subject || req.query?.subject || '');

  const rawClassSubject = req.query?.classSubject || req.body?.classSubject;
  if ((!className || !subject) && rawClassSubject) {
    if (typeof rawClassSubject === 'object' && rawClassSubject !== null) {
      className = rawClassSubject.class || rawClassSubject.className || className;
      subject = rawClassSubject.subject || rawClassSubject.subjectName || subject;
    } else if (typeof rawClassSubject === 'string') {
      try {
        const parsed = JSON.parse(rawClassSubject);
        if (parsed && typeof parsed === 'object') {
          className = parsed.class || parsed.className || className;
          subject = parsed.subject || parsed.subjectName || subject;
        }
      } catch {
        if (rawClassSubject.includes('-')) {
          const parts = rawClassSubject.split('-');
          className = className || parts[0].trim();
          subject = subject || parts.slice(1).join('-').trim();
        }
      }
    }
  }

  if (!className || !subject) {
    return res.status(400).json({ error: 'Both class and subject are required.' });
  }
  const updated = backendStore.removeTeacherClass(paramStr(req.params.id), { class: className, subject });
  if (!updated) return res.status(404).json({ error: 'Teacher not found.' });
  res.json(updated);
});

router.post('/teachers/:id/class-teacher-of', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const teacherId = paramStr(req.params.id);
  const { classes } = req.body || {};
  const result = backendStore.setTeacherClassTeacherOf(teacherId, Array.isArray(classes) ? classes : []);
  if ((result as any).error) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.delete('/teachers/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.deleteTeacher(id);
  if (!deleted) return res.status(404).json({ error: 'Teacher not found.' });
  res.json({ ok: true, id });
});

/* ── Timetable & Alerts ──────────────────────────────────────────────────── */

router.get('/timetable', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const queryClass = typeof req.query.class === 'string' ? req.query.class : undefined;
  if (req.user?.role === 'student') {
    const student = backendStore.getStudentById(req.user.studentId || '');
    const studentClass = student?.class || queryClass;
    return res.json(backendStore.getTimetableSlots(studentClass));
  }
  if (req.user?.role === 'teacher') {
    const teacher = backendStore.getTeacherById(req.user.teacherId || '');
    const teacherClasses = (teacher?.assignedClasses || []).map((ac: any) => ac.class);
    const allSlots = backendStore.getTimetableSlots(queryClass);
    return res.json(
      allSlots.filter(
        (t: any) =>
          t.teacherId === req.user?.teacherId ||
          (teacher?.name && t.teacher === teacher.name) ||
          (teacherClasses.length > 0 && teacherClasses.includes(t.class))
      )
    );
  }
  res.json(backendStore.getTimetableSlots(queryClass));
});

router.post('/timetable', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const created = backendStore.addTimetableSlot(req.body || {});
  res.status(201).json(created);
});

router.put('/timetable/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const updated = backendStore.updateTimetableSlot(paramStr(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: 'Timetable slot not found.' });
  res.json(updated);
});

router.delete('/timetable/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.deleteTimetableSlot(id);
  if (!deleted) return res.status(404).json({ error: 'Timetable slot not found.' });
  res.json({ ok: true, id });
});

router.post('/timetable/reschedule', requireAuth, requireRole('admin', 'teacher'), (req: AuthenticatedRequest, res: Response) => {
  const { slotId, targetDay, targetStartTime, targetEndTime, actorTeacherName } = req.body || {};
  if (!slotId || !targetDay || !targetStartTime || !targetEndTime) {
    return res.status(400).json({ error: 'slotId, targetDay, targetStartTime, and targetEndTime are required.' });
  }
  const actor = actorTeacherName || req.user?.name || 'Teaching Staff';
  const result = backendStore.rescheduleTeacherSlot(slotId, targetDay, targetStartTime, targetEndTime, actor);
  if (!result.success) {
    return res.status(409).json(result);
  }
  res.json(result);
});

router.get('/alerts', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  const alerts = backendStore.getAlerts().filter((alert: any) =>
    !alert.targetRole || alert.targetRole === 'all' || alert.targetRole === role
  );
  res.json(alerts);
});

router.delete('/alerts/:id', requireAuth, (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.dismissAlert(id);
  if (!deleted) return res.status(404).json({ error: 'Alert not found.' });
  res.json({ ok: true, id });
});

/* ── Attendance ──────────────────────────────────────────────────────────── */

router.get('/attendance', requireAuth, (req: Request, res: Response) => {
  const { date, class: className } = req.query as Record<string, string | undefined>;
  const attendance = backendStore.getAttendance();
  const filteredAttendance = Object.fromEntries(
    Object.entries(attendance).filter(([, entry]: [string, any]) =>
      (!date && !className) ||
      Boolean(
        entry &&
        (!date || entry.date === date) &&
        (!className || (entry.className || entry.class) === className)
      )
    )
  );
  res.json(filteredAttendance);
});

router.post('/attendance', requireAuth, requireRole('admin', 'teacher'), (req: AuthenticatedRequest, res: Response) => {
  const { date, className, submittedBy, records } = req.body || {};
  if (!date || !className || !records) {
    return res.status(400).json({ error: 'date, className, and records are required.' });
  }

  // Authorization check: Only admin or the assigned class teacher for this class can submit attendance
  if (req.user?.role !== 'admin') {
    const teacher = backendStore.getTeacherByEmailOrId(req.user?.email, req.user?.teacherId);
    const assignedClasses = teacher?.classTeacherOf || [];
    if (!assignedClasses.includes(className)) {
      return res.status(403).json({
        error: `Access Denied: Only the assigned Class Teacher for "${className}" can mark attendance for this class.`
      });
    }
  }

  const actor = submittedBy || req.user?.name || 'Staff';
  const entry = backendStore.saveClassAttendance(date, className, actor, records);
  res.status(201).json(entry);
});

router.get('/attendance/student/:studentId', requireAuth, (req: Request, res: Response) => {
  const history = backendStore.getStudentAttendanceHistory(paramStr(req.params.studentId));
  res.json(history);
});

/* ── Grades & Report Cards ───────────────────────────────────────────────── */

router.get('/grades', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getGrades());
});

router.post('/grades', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const body = req.body || {};
  const studentId = body.studentId;
  const term = body.term;
  const subject = body.subject;
  if (!studentId || !term || !subject) {
    return res.status(400).json({ error: 'studentId, term, and subject are required.' });
  }
  const gradeData = body.grade && typeof body.grade === 'object' ? body.grade : body;
  const saved = backendStore.saveGrade(
    studentId,
    term,
    subject,
    {
      ca1: Number(gradeData.ca1 ?? 0),
      ca2: Number(gradeData.ca2 ?? 0),
      exam: Number(gradeData.exam ?? 0),
      remark: gradeData.remark || ''
    },
    body.session || gradeData.session || '2026/2027'
  );
  res.status(201).json(saved);
});

router.get('/reports/:studentId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const targetId = paramStr(req.params.studentId);
  if (req.user?.role === 'student' && req.user.studentId !== targetId) {
    return res.status(403).json({ error: 'Access denied. You can only view your own report card.' });
  }
  const term = typeof req.query.term === 'string' ? req.query.term : 'Term1';
  const session = typeof req.query.session === 'string' ? req.query.session : '2026/2027';
  const report = backendStore.getStudentReportCard(targetId, term, session);
  if (!report) return res.status(404).json({ error: 'Student report not found.' });
  res.json(report);
});

/* ── Resources, Equipment & Maintenance ──────────────────────────────────── */

router.get('/resources', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const all = backendStore.getResources();
  let resources = all;
  if (req.user?.role === 'student') {
    const student = backendStore.getStudentById(req.user.studentId || '');
    const studentClass = student?.class || '';
    const studentSubjects = student?.enrolledSubjects || [];
    resources = all.filter(
      (r: any) =>
        r.accessLevel === 'students' &&
        (r.allClasses || (r.classes && r.classes.includes(studentClass))) &&
        (!r.subject || r.subject === 'General' || studentSubjects.length === 0 || studentSubjects.includes(r.subject))
    );
  } else if (req.user?.role === 'teacher') {
    const teacher = backendStore.getTeacherById(req.user.teacherId || '');
    const teacherSubjects = (teacher?.assignedClasses || []).map((ac: any) => ac.subject);
    const teacherClasses = (teacher?.assignedClasses || []).map((ac: any) => ac.class);
    if (teacherSubjects.length > 0) {
      resources = all.filter(
        (r: any) =>
          r.uploadedBy === teacher?.name ||
          teacherSubjects.includes(r.subject) ||
          r.allClasses ||
          (r.classes && r.classes.some((c: string) => teacherClasses.includes(c)))
      );
    }
  }

  const query = req.query as Record<string, string | undefined>;
  const search = (query.search || '').trim().toLowerCase();
  const subjects = [...new Set(resources.map((resource: any) => resource.subject).filter(Boolean))];
  const resourceCount = resources.length;
  if (search) {
    resources = resources.filter((resource: any) =>
      `${resource.title || ''} ${resource.subject || ''} ${resource.fileName || ''}`.toLowerCase().includes(search)
    );
  }
  if (query.subject && query.subject !== 'all') {
    resources = resources.filter((resource: any) => resource.subject === query.subject);
  }
  if (query.type && query.type !== 'all') {
    resources = resources.filter((resource: any) => resource.type === query.type);
  }
  if (query.class && query.class !== 'all') {
    resources = resources.filter((resource: any) =>
      resource.allClasses || (resource.classes || ['All Classes']).includes('All Classes') ||
      (resource.classes || []).includes(query.class)
    );
  }

  res.json(paginateList(resources, req, { subjects, resourceCount }));
});

router.post('/resources', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Resource title is required.' });
  const created = backendStore.addResource(req.body);
  res.status(201).json(created);
});

router.put('/resources/:id', requireAuth, (req: Request, res: Response) => {
  const updated = backendStore.updateResource(paramStr(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: 'Resource not found.' });
  res.json(updated);
});

router.delete('/resources/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.deleteResource(id);
  if (!deleted) return res.status(404).json({ error: 'Resource not found.' });
  res.json({ ok: true, id });
});

router.get('/equipment', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getEquipment());
});

router.post('/equipment', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Equipment name is required.' });
  const created = backendStore.addEquipment(req.body);
  res.status(201).json(created);
});

router.delete('/equipment/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.deleteEquipment(id);
  if (!deleted) return res.status(404).json({ error: 'Equipment not found.' });
  res.json({ ok: true, id });
});

router.get('/maintenance', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getMaintenance());
});

router.post('/maintenance', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const { itemName } = req.body || {};
  if (!itemName) return res.status(400).json({ error: 'Item name is required.' });
  const created = backendStore.addMaintenance(req.body);
  res.status(201).json(created);
});

router.patch('/maintenance/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Status is required.' });
  const updated = backendStore.updateMaintenanceStatus(paramStr(req.params.id), status);
  if (!updated) return res.status(404).json({ error: 'Maintenance request not found.' });
  res.json(updated);
});

/* ── Documents ───────────────────────────────────────────────────────────── */

router.get('/documents', requireAuth, (req: Request, res: Response) => {
  const documents = backendStore.getDocuments();
  const categories = [...new Set(documents.map((document: any) => document.category).filter(Boolean))];
  const categoryCounts = documents.reduce((counts: Record<string, number>, document: any) => {
    if (document.category) counts[document.category] = (counts[document.category] || 0) + 1;
    return counts;
  }, {});
  const restrictedCount = documents.filter(
    (document: any) => document.accessLevel === 'staff' || document.accessLevel === 'admin'
  ).length;
  const query = req.query as Record<string, string | undefined>;
  const search = (query.search || '').trim().toLowerCase();
  let filteredDocuments = documents;

  if (search) {
    filteredDocuments = filteredDocuments.filter((document: any) =>
      `${document.name || ''} ${document.category || ''} ${document.fileName || ''}`.toLowerCase().includes(search)
    );
  }
  if (query.category && query.category !== 'all') {
    filteredDocuments = filteredDocuments.filter((document: any) => document.category === query.category);
  }
  if (query.access && query.access !== 'all') {
    filteredDocuments = filteredDocuments.filter((document: any) => document.accessLevel === query.access);
  }

  res.json(paginateList(filteredDocuments, req, {
    categories,
    categoryCounts,
    documentCount: documents.length,
    restrictedCount
  }));
});

router.post('/documents', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Document name is required.' });
  const created = backendStore.addDocument(req.body);
  res.status(201).json(created);
});

router.patch('/documents/:id/access', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const { accessLevel, allowedClasses } = req.body || {};
  if (!accessLevel) return res.status(400).json({ error: 'accessLevel is required.' });
  const updated = backendStore.updateDocumentAccess(
    paramStr(req.params.id),
    accessLevel,
    Array.isArray(allowedClasses) ? allowedClasses : ['All Classes']
  );
  if (!updated) return res.status(404).json({ error: 'Document not found.' });
  res.json(updated);
});

router.delete('/documents/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.deleteDocument(id);
  if (!deleted) return res.status(404).json({ error: 'Document not found.' });
  res.json({ ok: true, id });
});

/* ── Announcements ───────────────────────────────────────────────────────── */

router.get('/announcements', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const query = req.query as Record<string, string | undefined>;
  const search = (query.search || '').trim().toLowerCase();
  const type = query.type || '';
  const audience = query.audience || '';
  const scope = query.scope || '';

  let announcements = backendStore.getAnnouncements().filter((announcement: any) => {
    if (req.user?.role === 'student' &&
      announcement.targetRole && announcement.targetRole !== 'all' && announcement.targetRole !== 'student') {
      return false;
    }
    if (req.user?.role === 'teacher' &&
      announcement.targetRole !== 'all' && announcement.targetRole !== 'teacher') {
      return false;
    }
    if (search && !`${announcement.title || ''} ${announcement.content || ''}`.toLowerCase().includes(search)) {
      return false;
    }
    if (type && type !== 'all' && announcement.type !== type) return false;
    if (audience && audience !== 'all') {
      const targets = announcement.targetAudiences || announcement.targetAudience || ['Everyone'];
      if (!Array.isArray(targets) || (!targets.includes(audience) && !targets.includes('Everyone'))) {
        return false;
      }
    }
    if (scope === 'admin' && announcement.authorRole === 'Teaching Staff') return false;
    if (scope === 'mine' && announcement.authorRole !== 'Teaching Staff') return false;
    return true;
  });

  if (query.page || query.limit) {
    announcements = [...announcements].sort(
      (a: any, b: any) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))
    );
  }
  res.json(paginateList(announcements, req));
});

router.post('/announcements', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const { title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Title and content are required.' });
  const created = backendStore.addAnnouncement(req.body);
  res.status(201).json(created);
});

router.put('/announcements/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const updated = backendStore.updateAnnouncement(paramStr(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: 'Announcement not found.' });
  res.json(updated);
});

router.delete('/announcements/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.deleteAnnouncement(id);
  if (!deleted) return res.status(404).json({ error: 'Announcement not found.' });
  res.json({ ok: true, id });
});

/* ── Teacher Availability ────────────────────────────────────────────────── */

router.get('/availability', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getTeacherAvailability());
});

router.post('/availability', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const created = backendStore.addTeacherAvailabilitySlot(req.body || {});
  res.status(201).json(created);
});

router.patch('/availability/:id/toggle', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const updated = backendStore.toggleTeacherAvailabilitySlot(paramStr(req.params.id));
  if (!updated) return res.status(404).json({ error: 'Availability slot not found.' });
  res.json(updated);
});

router.delete('/availability/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.deleteTeacherAvailabilitySlot(id);
  if (!deleted) return res.status(404).json({ error: 'Availability slot not found.' });
  res.json({ ok: true, id });
});

/* ── Assignments ─────────────────────────────────────────────────────────── */

router.get('/assignments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const all = backendStore.getAssignments();
  let assignments = all;
  if (req.user?.role === 'student') {
    const student = backendStore.getStudentById(req.user.studentId || '');
    const studentClass = student?.class || '';
    const studentSubjects = student?.enrolledSubjects || [];
    assignments = all.filter(
      (a: any) =>
        (!studentClass || a.class === 'All Classes' || a.class === studentClass) &&
        (!a.subject || a.subject === 'General' || studentSubjects.length === 0 || studentSubjects.includes(a.subject))
    );
  } else if (req.user?.role === 'teacher') {
    const teacher = backendStore.getTeacherById(req.user.teacherId || '');
    const teacherSubjects = (teacher?.assignedClasses || []).map((ac: any) => ac.subject);
    const teacherClasses = (teacher?.assignedClasses || []).map((ac: any) => ac.class);
    if (teacherClasses.length > 0 || teacherSubjects.length > 0) {
      assignments = all.filter(
        (a: any) =>
          a.author === teacher?.name ||
          teacherClasses.includes(a.class) ||
          teacherSubjects.includes(a.subject)
      );
    }
  }

  const query = req.query as Record<string, string | undefined>;
  const search = (query.search || '').trim().toLowerCase();
  const subjects = [...new Set(assignments.map((assignment: any) => assignment.subject).filter(Boolean))];
  if (search) {
    assignments = assignments.filter((assignment: any) =>
      `${assignment.title || ''} ${assignment.subject || ''}`.toLowerCase().includes(search)
    );
  }
  if (query.class && query.class !== 'all') {
    assignments = assignments.filter((assignment: any) => assignment.class === query.class);
  }
  if (query.subject && query.subject !== 'all') {
    assignments = assignments.filter((assignment: any) => assignment.subject === query.subject);
  }

  res.json(paginateList(assignments, req, { subjects }));
});

router.post('/assignments', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const { title, subject } = req.body || {};
  if (!title || !subject) return res.status(400).json({ error: 'Title and subject are required.' });
  const created = backendStore.addAssignment(req.body);
  res.status(201).json(created);
});

router.put('/assignments/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const updated = backendStore.updateAssignment(paramStr(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: 'Assignment not found.' });
  res.json(updated);
});

router.delete('/assignments/:id', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.deleteAssignment(id);
  if (!deleted) return res.status(404).json({ error: 'Assignment not found.' });
  res.json({ ok: true, id });
});

router.post('/assignments/:id/submit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { studentId, studentName, notes, fileName, fileUrl, filePath } = req.body || {};
  const resolvedId = studentId || req.user?.studentId || req.user?.id || '';
  if (!resolvedId) return res.status(400).json({ error: 'Student identifier is required.' });
  const student = {
    id: resolvedId,
    name: studentName || req.user?.name || 'Student'
  };
  const updated = backendStore.submitStudentAssignment(paramStr(req.params.id), student, {
    notes,
    fileName,
    fileUrl,
    filePath
  });
  if (!updated) return res.status(404).json({ error: 'Assignment not found.' });
  res.json(updated);
});

/* ── Student Requests ────────────────────────────────────────────────────── */

router.get('/requests', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getRequests());
});

router.post('/requests', requireAuth, (req: Request, res: Response) => {
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Request title is required.' });
  const created = backendStore.addRequest(req.body);
  res.status(201).json(created);
});

router.patch('/requests/:id/status', requireAuth, requireRole('admin', 'teacher'), (req: Request, res: Response) => {
  const { status, staffResponse } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Status is required.' });
  const updated = backendStore.updateRequestStatus(paramStr(req.params.id), status, staffResponse || '');
  if (!updated) return res.status(404).json({ error: 'Student request not found.' });
  res.json(updated);
});

/* ── Public Enquiries ────────────────────────────────────────────────────── */

router.get('/enquiries', requireAuth, requireRole('admin'), (_req: Request, res: Response) => {
  res.json(backendStore.getEnquiries());
});

router.post('/enquiries', (req: Request, res: Response) => {
  const { kind, parentName, email } = req.body || {};
  if (!parentName || !email) {
    return res.status(400).json({ error: 'Parent name and email are required.' });
  }
  const entry = backendStore.addEnquiry(kind || 'enquiry', req.body || {});
  res.status(201).json(entry);
});

/* ── Direct Messages ─────────────────────────────────────────────────────── */

router.get('/messages', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getDirectMessages());
});

router.post('/messages', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { recipient, subject, content, role } = req.body || {};
  if (!recipient || !subject || !content) {
    return res.status(400).json({ error: 'recipient, subject, and content are required.' });
  }
  const created = backendStore.addDirectMessage({
    senderId: req.user?.id || '',
    senderName: req.user?.name || 'Administrator',
    recipient,
    role: role || 'Recipient',
    subject,
    content
  });
  res.status(201).json(created);
});

/* ── Staff Leaves ────────────────────────────────────────────────────────── */

router.get('/staff-leaves', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.user?.role === 'teacher' ? req.user.teacherId : (typeof req.query.teacherId === 'string' ? req.query.teacherId : undefined);
  res.json(backendStore.getStaffLeaves(teacherId));
});

router.post('/staff-leaves', requireAuth, requireRole('admin', 'teacher'), (req: AuthenticatedRequest, res: Response) => {
  const { type, startDate, endDate, reason, days } = req.body || {};
  if (!startDate || !endDate || !reason) {
    return res.status(400).json({ error: 'startDate, endDate, and reason are required.' });
  }
  const teacher = req.user?.teacherId ? backendStore.getTeacherById(req.user.teacherId) : null;
  const created = backendStore.addStaffLeave({
    teacherId: teacher?.id || req.body?.teacherId || '',
    teacherName: teacher?.name || req.body?.teacherName || req.user?.name || 'Staff',
    type: type || 'Casual Leave',
    startDate,
    endDate,
    days: days || 1,
    reason
  });
  res.status(201).json(created);
});

router.patch('/staff-leaves/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Status is required.' });
  const updated = backendStore.updateStaffLeaveStatus(paramStr(req.params.id), status, req.user?.name || 'Administrator');
  if (!updated) return res.status(404).json({ error: 'Leave request not found.' });
  res.json(updated);
});

/* ── Help Tickets ────────────────────────────────────────────────────────── */

router.get('/help-tickets', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const studentId = req.user?.role === 'student' ? req.user.studentId : undefined;
  res.json(backendStore.getHelpTickets(studentId));
});

router.post('/help-tickets', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { subject, description, category, priority } = req.body || {};
  if (!subject || !description) {
    return res.status(400).json({ error: 'Subject and description are required.' });
  }
  const studentName = req.user?.name || 'Student';
  const created = backendStore.addHelpTicket({
    studentId: req.user?.studentId || req.user?.id || '',
    studentName,
    subject,
    description,
    category: category || 'Academic Support',
    priority: priority || 'medium',
    responses: [
      {
        id: '1',
        author: studentName,
        authorType: req.user?.role || 'student',
        message: description,
        timestamp: new Date().toLocaleString('en-GB')
      }
    ]
  });
  res.status(201).json(created);
});

router.post('/help-tickets/:id/reply', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  const reply = {
    id: String(Date.now()),
    author: req.user?.name || 'User',
    authorType: req.user?.role || 'student',
    message,
    timestamp: new Date().toLocaleString('en-GB')
  };
  const updated = backendStore.addHelpTicketReply(paramStr(req.params.id), reply);
  if (!updated) return res.status(404).json({ error: 'Help ticket not found.' });
  res.json(updated);
});

/* ── Files Upload & Download ─────────────────────────────────────────────── */

router.post('/files/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Attach multipart field named "file".' });
  }
  const folder = typeof req.body?.folder === 'string' && req.body.folder ? req.body.folder : 'general';
  try {
    const uploaded = await uploadFileToBackendStorage(folder, req.file);
    res.status(201).json(uploaded);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'File upload failed.' });
  }
});

router.get('/files/download/:folder/:filename', (req: Request, res: Response) => {
  const filePath = resolveLocalUploadPath(paramStr(req.params.folder), paramStr(req.params.filename));
  if (!filePath) {
    return res.status(404).json({ error: 'File not found on server.' });
  }
  res.download(filePath);
});

/* ── Academic Session Rollover & Promotion ───────────────────────────────── */

router.get('/academic/promotion-candidates', requireAuth, requireRole('admin'), (_req: Request, res: Response) => {
  const candidates = backendStore.getPromotionCandidates();
  res.json({ candidates });
});

router.post('/academic/rollover-session', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { nextSession, promotions } = req.body || {};
  if (!nextSession || !Array.isArray(promotions)) {
    return res.status(400).json({ error: 'nextSession and promotions array are required.' });
  }
  const result = backendStore.executeSessionRollover({ nextSession, promotions });
  res.json(result);
});

/* ── Academic Sessions & Terms ───────────────────────────────────────────── */

router.get('/academic/sessions', requireAuth, (_req: Request, res: Response) => {
  const settings = backendStore.getSettings();
  res.json({
    sessions: ['2026/2027', '2025/2026', '2024/2025'],
    currentSession: settings.currentSession || '2026/2027',
    terms: ['Term 1', 'Term 2', 'Term 3'],
    currentTerm: settings.currentTerm || 'Term 1'
  });
});

/* ── Institution Settings ─────────────────────────────────────────────────── */

router.get('/settings', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getSettings());
});

router.put('/settings', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const updated = backendStore.updateSettings(req.body || {});
  res.json(updated);
});

router.post('/settings', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const updated = backendStore.updateSettings(req.body || {});
  res.json(updated);
});

export default router;
