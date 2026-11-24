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
  downloadFileFromBackendStorage,
  isServerSupabaseConfigured,
  subscribeServerEvents,
  uploadFileToBackendStorage
} from './store.ts';
import { isPasswordResetEmailConfigured, sendPasswordResetEmail } from './mailer.ts';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

function respondWithDatabaseError(res: Response, resource: string, error: unknown) {
  console.error(`[Al-Amin API] Failed to access ${resource}:`, error);
  const status = isServerSupabaseConfigured ? 500 : 503;
  return res.status(status).json({
    error: isServerSupabaseConfigured
      ? `Failed to access ${resource}.`
      : 'Database storage is not configured.'
  });
}

const paramStr = (val: string | string[] | undefined): string =>
  Array.isArray(val) ? String(val[0] || '') : String(val || '');

const passwordResetAttempts = new Map<string, { count: number; resetAt: number }>();
const passwordResetWindowMs = 15 * 60 * 1000;

function isPasswordResetRateLimited(req: Request) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  if (passwordResetAttempts.size > 10000) {
    passwordResetAttempts.forEach((attempt, address) => {
      if (now >= attempt.resetAt) passwordResetAttempts.delete(address);
    });
  }
  const current = passwordResetAttempts.get(key);
  if (!current || now >= current.resetAt) {
    passwordResetAttempts.set(key, { count: 1, resetAt: now + passwordResetWindowMs });
    return false;
  }
  current.count += 1;
  return current.count > 5;
}

const getDatabasePagination = (req: Request): { page?: number; limit?: number } => {
  const query = req.query as Record<string, string | undefined>;
  if (!query.page && !query.limit) return {};

  const requestedPage = Number(query.page);
  const requestedLimit = Number(query.limit);
  return {
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    limit: Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 20
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

router.get('/health', async (_req: Request, res: Response) => {
  try {
    await backendStore.checkDatabaseConnection();
    res.json({
      status: 'ok',
      database: 'connected',
      service: 'Al-Amin Group of Schools REST API',
      storageMode: backendStore.getStorageMode(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Al-Amin API] Health check failed:', error);
    res.status(503).json({
      status: 'unavailable',
      database: 'unavailable',
      service: 'Al-Amin Group of Schools REST API',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/dashboard/admin', requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    res.json(await backendStore.getAdminDashboardSummary());
  } catch (error) {
    respondWithDatabaseError(res, 'admin dashboard summary', error);
  }
});

router.get('/dashboard/staff', requireAuth, requireRole('teacher'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await backendStore.getStaffDashboardSummary(req.user?.teacherId || '');
    if (!summary) return res.status(404).json({ error: 'Teacher profile not found.' });
    res.json(summary);
  } catch (error) {
    respondWithDatabaseError(res, 'staff dashboard summary', error);
  }
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

router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    const user = await backendStore.authenticateInDatabase(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.role === 'teacher') {
      const teacher = await backendStore.getTeacherDirectoryRecordByEmailOrId(user.email, user.teacherId);
      if (teacher) {
        (user as any).classTeacherOf = teacher.classTeacherOf || [];
        (user as any).teacherId = teacher.id;
      }
    }
    const token = signAuthToken(user);
    const responseUser = { ...user };
    delete responseUser.authVersion;
    delete responseUser.isActive;
    res.json({ token, user: responseUser });
  } catch (error) {
    respondWithDatabaseError(res, 'authentication', error);
  }
});

router.post('/auth/register', (_req: Request, res: Response) => {
  return res.status(403).json({
    error: 'Self-registration is disabled. Only the School Administrator can add teacher and student accounts.'
  });
});

router.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user ? await backendStore.getUserByIdFromDatabase(req.user.id) : null;
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    if (user.role === 'teacher') {
      const teacher = await backendStore.getTeacherDirectoryRecordByEmailOrId(user.email, user.teacherId);
      if (teacher) {
        (user as any).classTeacherOf = teacher.classTeacherOf || [];
        (user as any).teacherId = teacher.id;
      }
    }
    res.json({ user });
  } catch (error) {
    respondWithDatabaseError(res, 'user profile', error);
  }
});

router.post('/auth/logout', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.post('/auth/forgot-password', async (req: Request, res: Response) => {
  if (isPasswordResetRateLimited(req)) {
    return res.status(429).json({ error: 'Too many password reset requests. Try again later.' });
  }
  if (!isPasswordResetEmailConfigured()) {
    return res.status(503).json({ error: 'Password reset is temporarily unavailable.' });
  }

  const { identifier } = req.body || {};
  try {
    const reset = await backendStore.generatePasswordResetOtp(identifier);
    if (reset) {
      try {
        await sendPasswordResetEmail(reset.email, reset.otp);
      } catch (error) {
        backendStore.discardPasswordResetOtp(reset.email);
        console.error('Password reset email delivery failed:', error);
      }
    }
  } catch (error) {
    return respondWithDatabaseError(res, 'password reset', error);
  }
  res.status(202).json({
    message: 'If an account matches that identifier and email delivery succeeds, a verification code will be sent to its registered email.'
  });
});

router.post('/auth/reset-password', async (req: Request, res: Response) => {
  if (isPasswordResetRateLimited(req)) {
    return res.status(429).json({ error: 'Too many password reset attempts. Try again later.' });
  }
  const { identifier, otp, newPassword } = req.body || {};
  try {
    const result = await backendStore.resetPasswordWithOtp(identifier, otp, newPassword);
    if (result.error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    respondWithDatabaseError(res, 'password reset', error);
  }
});

const handleAvatarUpload = async (req: AuthenticatedRequest, res: Response) => {
  const targetUserId = paramStr(req.params.id) || req.user?.id || '';
  const routePath = String(req.route?.path || '');
  const isAdmin = req.user?.role === 'admin';
  const ownsTarget = routePath.startsWith('/teachers/')
    ? req.user?.role === 'teacher' && req.user.teacherId === targetUserId
    : routePath.startsWith('/students/')
    ? req.user?.role === 'student' && req.user.studentId === targetUserId
    : routePath.startsWith('/users/')
    ? req.user?.id === targetUserId
    : !req.params.id || req.user?.id === targetUserId;
  if (!isAdmin && !ownsTarget) {
    return res.status(403).json({ error: 'You can only update your own profile photo.' });
  }

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

    if (!targetUserId) {
      return res.status(400).json({ error: 'User target could not be identified.' });
    }

    const updatedUser = await backendStore.updateUserAvatarInDatabase(targetUserId, avatarUrl);
    if (!updatedUser) return res.status(404).json({ error: 'User account not found.' });
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

router.get('/classes', requireAuth, async (_req: Request, res: Response) => {
  try {
    res.json(await backendStore.getClasses());
  } catch (error) {
    respondWithDatabaseError(res, 'classes', error);
  }
});

router.get('/classes/summary', requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    res.json(await backendStore.getClassOverviewSummary());
  } catch (error) {
    respondWithDatabaseError(res, 'class summary', error);
  }
});

router.post('/classes', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await backendStore.addClass(req.body || {});
    if ((result as any).error) return res.status(400).json(result);
    res.status(201).json(result);
  } catch (error) {
    respondWithDatabaseError(res, 'classes', error);
  }
});

router.post('/classes/:id/class-teacher', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { teacherId } = req.body || {};
  const classIdOrName = paramStr(req.params.id);
  try {
    const result = await backendStore.assignClassTeacher(classIdOrName, teacherId);
    if ((result as any).error) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    respondWithDatabaseError(res, 'class teacher assignment', error);
  }
});

router.put('/classes/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const classIdOrName = paramStr(req.params.id);
  const { teacherId, classTeacherId } = req.body || {};
  const targetTeacherId = classTeacherId !== undefined ? classTeacherId : teacherId;
  if (targetTeacherId !== undefined) {
    try {
      const result = await backendStore.assignClassTeacher(classIdOrName, targetTeacherId);
      if ((result as any).error) return res.status(400).json(result);
      return res.json(result);
    } catch (error) {
      return respondWithDatabaseError(res, 'class teacher assignment', error);
    }
  }
  res.json({ ok: true });
});

router.delete('/classes/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const ok = await backendStore.deleteClass(paramStr(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Class not found.' });
    res.json({ ok: true });
  } catch (error) {
    respondWithDatabaseError(res, 'classes', error);
  }
});

/* ── Subjects ────────────────────────────────────────────────────────────── */

router.get('/subjects', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { class: className, department } = req.query as Record<string, string | undefined>;
    let names: string[] | undefined;
    if (req.user?.role === 'student') {
      const student = await backendStore.getStudentDirectoryRecord(req.user.studentId || '');
      if (!student) return res.status(403).json({ error: 'Student profile is unavailable.' });
      names = student.enrolledSubjects?.length ? student.enrolledSubjects : undefined;
      const { data: subjects } = await backendStore.getSubjects({
        class: className || student.class,
        department: department || student.department,
        names
      }).then((data: any) => ({ data }));
      return res.json(subjects);
    } else if (req.user?.role === 'teacher') {
      const teacher = await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '');
      if (!teacher) return res.status(403).json({ error: 'Teacher profile is unavailable.' });
      names = [...new Set<string>((teacher?.assignedClasses || [])
        .map((assignment: any) => assignment.subject)
        .filter((subject: unknown): subject is string => typeof subject === 'string' && Boolean(subject)))];
    }
    res.json(await backendStore.getSubjects({ class: className, department, names }));
  } catch (error) {
    respondWithDatabaseError(res, 'subjects', error);
  }
});

router.post('/subjects', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const created = await backendStore.addSubject(req.body || {});
    if (!created) return res.status(400).json({ error: 'Subject name is required.' });
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'subjects', error);
  }
});

router.put('/subjects/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const updated = await backendStore.updateSubject(paramStr(req.params.id), req.body || {});
    if (!updated) return res.status(404).json({ error: 'Subject not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'subjects', error);
  }
});

router.delete('/subjects/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  try {
    const deleted = await backendStore.deleteSubject(id);
    if (!deleted) return res.status(404).json({ error: 'Subject not found.' });
    res.json({ ok: true, id });
  } catch (error) {
    respondWithDatabaseError(res, 'subjects', error);
  }
});

/* ── Students ────────────────────────────────────────────────────────────── */

router.get('/students', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role === 'student') {
      const student = await backendStore.getStudentDirectoryRecord(req.user.studentId || '');
      return res.json(student ? [student] : []);
    }
    const { search, class: className, department, subject, status, page, limit } = req.query as Record<string, string>;
    let allowedClasses: string[] | undefined;

    if (req.user?.role === 'teacher') {
      const teacher = await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '');
      allowedClasses = [...new Set([
        ...(teacher?.assignedClasses || []).map((ac: any) => ac.class),
        ...(teacher?.classTeacherOf || [])
      ])];
    }

    const result = await backendStore.getStudents({
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
  } catch (error) {
    respondWithDatabaseError(res, 'students', error);
  }
});

router.get('/students/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const targetId = paramStr(req.params.id);
  if (req.user?.role === 'student' && req.user.studentId !== targetId) {
    return res.status(403).json({ error: 'Access denied. You can only view your own student record.' });
  }
  try {
    const student = await backendStore.getStudentDirectoryRecord(targetId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (req.user?.role === 'teacher') {
      const teacher = await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '');
      const assigned = (teacher?.assignedClasses || []).some((item: any) => item.class === student.class) ||
        (teacher?.classTeacherOf || []).includes(student.class);
      if (!assigned) return res.status(403).json({ error: 'You can only view students in your assigned classes.' });
    }
    res.json(student);
  } catch (error) {
    respondWithDatabaseError(res, 'students', error);
  }
});

router.post('/students', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { name, email, portalPassword, password } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Student name is required.' });
  const suppliedPassword = portalPassword || password;
  if (suppliedPassword && String(suppliedPassword).trim().length < 6) {
    return res.status(400).json({ error: 'Portal password must be at least 6 characters.' });
  }
  try {
    if (email && await backendStore.isEmailTakenInDatabase(email)) {
      return res.status(409).json({ error: `A portal account with email "${email}" already exists.` });
    }
    const created = await backendStore.createStudentInDatabase(req.body);
    if (created && 'error' in created) return res.status(409).json(created);
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'students', error);
  }
});

router.put('/students/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const updated = await backendStore.updateStudentInDatabase(paramStr(req.params.id), req.body || {});
    if (!updated) return res.status(404).json({ error: 'Student not found.' });
    if ('error' in updated) return res.status(409).json(updated);
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'students', error);
  }
});

router.post('/students/:id/credentials', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (password && String(password).trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    const result = await backendStore.setPortalCredentialsInDatabase('student', paramStr(req.params.id), email, password);
    if (!result) return res.status(404).json({ error: 'Student not found.' });
    if ('error' in result) return res.status(409).json({ error: result.error });
    res.json(result);
  } catch (error) {
    respondWithDatabaseError(res, 'student credentials', error);
  }
});

router.post('/students/:id/enroll-subject', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const { subject } = req.body || {};
  if (!subject) return res.status(400).json({ error: 'Subject name is required.' });
  const studentId = paramStr(req.params.id);
  try {
    if (req.user?.role === 'teacher') {
      const [student, teacher] = await Promise.all([
        backendStore.getStudentDirectoryRecord(studentId),
        backendStore.getTeacherDirectoryRecord(req.user.teacherId || '')
      ]);
      const isAssigned = (teacher?.assignedClasses || []).some(
        (assignment: any) => assignment.class === student?.class && assignment.subject === subject
      );
      if (!isAssigned) return res.status(403).json({ error: 'You can only enroll students in your assigned classes and subjects.' });
    }
    const updated = await backendStore.enrollStudentSubjectInDatabase(studentId, subject);
    if (!updated) return res.status(404).json({ error: 'Student not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'students', error);
  }
});

router.delete('/students/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  try {
    const deleted = await backendStore.deleteStudentFromDatabase(id);
    if (!deleted) return res.status(404).json({ error: 'Student not found.' });
    res.json({ ok: true, id });
  } catch (error) {
    respondWithDatabaseError(res, 'students', error);
  }
});

/* ── Teachers ────────────────────────────────────────────────────────────── */

router.get('/teachers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { search, class: className, subject, status, page, limit } = req.query as Record<string, string>;
  try {
    const result = await backendStore.getTeachers({
      search,
      class: className,
      subject,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined
    });
    if (req.user?.role === 'admin') {
      res.json(result);
      return;
    }

    const publicTeacher = (teacher: any) => ({
      id: teacher.id,
      name: teacher.name,
      department: teacher.department,
      position: teacher.position,
      avatarUrl: teacher.avatarUrl
    });
    if (Array.isArray(result)) {
      res.json(result.map(publicTeacher));
      return;
    }
    res.json({ ...result, data: (result.data || []).map(publicTeacher) });
  } catch (error) {
    respondWithDatabaseError(res, 'teachers', error);
  }
});

router.get('/teachers/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can access their teacher profile.' });
  }
  try {
    const teacher = await backendStore.getTeacherDirectoryRecordByEmailOrId(req.user.email, req.user.teacherId);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found.' });
    res.json(teacher);
  } catch (error) {
    respondWithDatabaseError(res, 'teachers', error);
  }
});

router.get('/teachers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = paramStr(req.params.id);
  if (req.user?.role !== 'admin' && (req.user?.role !== 'teacher' || req.user.teacherId !== teacherId)) {
    return res.status(403).json({ error: 'You can only view your own teacher profile.' });
  }
  try {
    const teacher = await backendStore.getTeacherDirectoryRecord(teacherId);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });
    res.json(teacher);
  } catch (error) {
    respondWithDatabaseError(res, 'teachers', error);
  }
});

router.post('/teachers', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { name, email, portalPassword, password } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Teacher name is required.' });
  if (!email) return res.status(400).json({ error: 'Teacher school email is required.' });
  const suppliedPassword = portalPassword || password;
  if (suppliedPassword && String(suppliedPassword).trim().length < 6) {
    return res.status(400).json({ error: 'Portal password must be at least 6 characters.' });
  }
  try {
    if (await backendStore.isEmailTakenInDatabase(email)) {
      return res.status(409).json({ error: `A portal account with email "${email}" already exists.` });
    }
    const created = await backendStore.createTeacherInDatabase(req.body);
    if (created && 'error' in created) return res.status(409).json(created);
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'teachers', error);
  }
});

router.post('/teachers/:id/credentials', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (password && String(password).trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    const result = await backendStore.setPortalCredentialsInDatabase('teacher', paramStr(req.params.id), email, password);
    if (!result) return res.status(404).json({ error: 'Teacher not found.' });
    if ('error' in result) return res.status(409).json({ error: result.error });
    res.json(result);
  } catch (error) {
    respondWithDatabaseError(res, 'teacher credentials', error);
  }
});

router.put('/teachers/:id', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = paramStr(req.params.id);
  if (req.user?.role === 'teacher' && req.user.teacherId !== teacherId) {
    return res.status(403).json({ error: 'You can only update your own teacher profile.' });
  }
  try {
    const updates = req.user?.role === 'admin'
      ? req.body || {}
      : Object.fromEntries(
          Object.entries(req.body || {}).filter(([key]) =>
            ['name', 'email', 'phone', 'address', 'dateOfBirth', 'startDate', 'position', 'qualification', 'qualifications', 'emergencyContact', 'department'].includes(key)
          )
        );
    const updated = await backendStore.updateTeacherInDatabase(teacherId, updates);
    if (!updated) return res.status(404).json({ error: 'Teacher not found.' });
    if ('error' in updated) return res.status(409).json(updated);
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'teachers', error);
  }
});

router.post('/teachers/:id/assign-class', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const body = req.body || {};
  const className = String(body.class || body.className || body.classSubject?.class || '');
  const subject = String(body.subject || body.subjectName || body.classSubject?.subject || '');
  if (!className || !subject) {
    return res.status(400).json({ error: 'Both class and subject are required.' });
  }
  try {
    const updated = await backendStore.assignTeacherClassInDatabase(paramStr(req.params.id), { class: className, subject });
    if (!updated) return res.status(404).json({ error: 'Teacher not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'teachers', error);
  }
});

router.delete('/teachers/:id/assign-class', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
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
  try {
    const updated = await backendStore.removeTeacherClassInDatabase(paramStr(req.params.id), { class: className, subject });
    if (!updated) return res.status(404).json({ error: 'Teacher not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'teachers', error);
  }
});

router.post('/teachers/:id/class-teacher-of', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const teacherId = paramStr(req.params.id);
  const { classes } = req.body || {};
  try {
    const result = await backendStore.setTeacherClassTeacherOf(teacherId, Array.isArray(classes) ? classes : []);
    if ((result as any).error) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    respondWithDatabaseError(res, 'class teacher assignment', error);
  }
});

router.delete('/teachers/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  try {
    const deleted = await backendStore.deleteTeacherFromDatabase(id);
    if (!deleted) return res.status(404).json({ error: 'Teacher not found.' });
    res.json({ ok: true, id });
  } catch (error) {
    respondWithDatabaseError(res, 'teacher class assignment', error);
  }
});

/* ── Timetable & Alerts ──────────────────────────────────────────────────── */

router.get('/timetable', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const queryClass = typeof req.query.class === 'string' ? req.query.class : undefined;
  try {
    if (req.user?.role === 'student') {
      const student = await backendStore.getStudentDirectoryRecord(req.user.studentId || '');
      if (!student) return res.status(404).json({ error: 'Student profile not found.' });
      return res.json(await backendStore.getTimetableSlots(student.class));
    }
    if (req.user?.role === 'teacher') {
      const teacher = await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '');
      if (!teacher) return res.status(403).json({ error: 'Teacher profile is unavailable.' });
      const teacherClasses = [...new Set([
        ...(teacher?.assignedClasses || []).map((assignment: any) => assignment.class),
        ...(teacher?.classTeacherOf || [])
      ].filter(Boolean))];
      if (queryClass && !teacherClasses.includes(queryClass)) {
        return res.status(403).json({ error: 'You can only view timetable slots for your assigned classes.' });
      }
      return res.json(await backendStore.getTimetableSlots(queryClass, {
        id: req.user.teacherId,
        name: teacher?.name,
        classes: teacherClasses
      }));
    }
    res.json(await backendStore.getTimetableSlots(queryClass));
  } catch (error) {
    respondWithDatabaseError(res, 'student or teacher profile', error);
  }
});

router.post('/timetable', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const created = await backendStore.addTimetableSlot(req.body || {});
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'classes', error);
  }
});

router.put('/timetable/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const updated = await backendStore.updateTimetableSlot(paramStr(req.params.id), req.body || {});
    if (!updated) return res.status(404).json({ error: 'Timetable slot not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'timetable', error);
  }
});

router.delete('/timetable/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  try {
    const deleted = await backendStore.deleteTimetableSlot(id);
    if (!deleted) return res.status(404).json({ error: 'Timetable slot not found.' });
    res.json({ ok: true, id });
  } catch (error) {
    respondWithDatabaseError(res, 'timetable', error);
  }
});

router.post('/timetable/reschedule', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const { slotId, targetDay, targetStartTime, targetEndTime } = req.body || {};
  if (!slotId || !targetDay || !targetStartTime || !targetEndTime) {
    return res.status(400).json({ error: 'slotId, targetDay, targetStartTime, and targetEndTime are required.' });
  }
  try {
    let actorName = req.user?.name || 'School Administrator';
    let actorTeacherId: string | undefined;
    if (req.user?.role === 'teacher') {
      const [teacher, slot] = await Promise.all([
        backendStore.getTeacherDirectoryRecord(req.user.teacherId || ''),
        backendStore.getTimetableSlotById(slotId)
      ]);
      if (!slot) return res.status(404).json({ error: 'Class period not found.' });
      if (!teacher) return res.status(403).json({ error: 'Teacher profile is unavailable.' });
      const ownsSlot = slot.teacherId === teacher.id;
      const assigned = (teacher.assignedClasses || []).some(
        (assignment: any) =>
          assignment.class === slot.class &&
          assignment.subject === slot.subject
      );
      if (slot.type !== 'lesson' || !ownsSlot || !assigned) {
        return res.status(403).json({ error: 'You can only reschedule your own lessons for assigned classes and subjects.' });
      }
      actorName = teacher.name;
      actorTeacherId = teacher.id;
    }
    const result = await backendStore.rescheduleTeacherSlot(
      slotId,
      targetDay,
      targetStartTime,
      targetEndTime,
      actorName,
      actorTeacherId
    );
    if (!result.success) {
      return res.status(409).json(result);
    }
    res.json(result);
  } catch (error) {
    respondWithDatabaseError(res, 'timetable reschedule', error);
  }
});

router.get('/alerts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  try {
    res.json(await backendStore.getAlerts(role));
  } catch (error) {
    respondWithDatabaseError(res, 'alerts', error);
  }
});

router.delete('/alerts/:id', requireAuth, async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  try {
    const deleted = await backendStore.dismissAlert(id);
    if (!deleted) return res.status(404).json({ error: 'Alert not found.' });
    res.json({ ok: true, id });
  } catch (error) {
    respondWithDatabaseError(res, 'alerts', error);
  }
});

/* ── Attendance ──────────────────────────────────────────────────────────── */

router.get('/attendance/summary', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const date = typeof req.query.date === 'string' ? req.query.date : '';
  if (!date) return res.status(400).json({ error: 'date is required.' });
  try {
    res.json(await backendStore.getAttendanceOverviewSummary(date));
  } catch (error) {
    respondWithDatabaseError(res, 'attendance', error);
  }
});

router.get('/attendance', requireAuth, async (req: Request, res: Response) => {
  const { date, class: requestedClass } = req.query as Record<string, string | undefined>;
  try {
    const user = (req as AuthenticatedRequest).user;
    if (user?.role === 'student') {
      const student = await backendStore.getStudentDirectoryRecord(user.studentId || '');
      if (!student) return res.status(404).json({ error: 'Student profile not found.' });
      const attendance = await backendStore.getAttendance(date, student.class);
      res.json(Object.fromEntries(Object.entries(attendance).map(([key, entry]: [string, any]) => [
        key,
        { ...entry, records: { [student.id]: entry.records?.[student.id] } }
      ])));
      return;
    }
    if (user?.role === 'teacher') {
      const teacher = await backendStore.getTeacherDirectoryRecord(user.teacherId || '');
      const assignedClasses = [...new Set([
        ...(teacher?.assignedClasses || []).map((assignment: any) => assignment.class),
        ...(teacher?.classTeacherOf || [])
      ].filter(Boolean))];
      if (requestedClass && !assignedClasses.includes(requestedClass)) {
        return res.status(403).json({ error: 'You can only view attendance for your assigned classes.' });
      }
      const classes = requestedClass ? [requestedClass] : assignedClasses;
      const rows = await Promise.all(classes.map((className) => backendStore.getAttendance(date, className)));
      res.json(Object.assign({}, ...rows));
      return;
    }
    res.json(await backendStore.getAttendance(date, requestedClass));
  } catch (error) {
    respondWithDatabaseError(res, 'attendance', error);
  }
});

router.post('/attendance', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const { date, className, submittedBy, records } = req.body || {};
  if (!date || !className || !records) {
    return res.status(400).json({ error: 'date, className, and records are required.' });
  }

  // Authorization check: Only admin or the assigned class teacher for this class can submit attendance
  try {
    if (req.user?.role !== 'admin') {
      const teacher = await backendStore.getTeacherDirectoryRecordByEmailOrId(req.user?.email, req.user?.teacherId);
      const assignedClasses = teacher?.classTeacherOf || [];
      if (!assignedClasses.includes(className)) {
        return res.status(403).json({
          error: `Access Denied: Only the assigned Class Teacher for "${className}" can mark attendance for this class.`
        });
      }
    }
    const actor = submittedBy || req.user?.name || 'Staff';
    const entry = await backendStore.saveClassAttendance(date, className, actor, records);
    res.status(201).json(entry);
  } catch (error) {
    respondWithDatabaseError(res, 'attendance', error);
  }
});

router.get('/attendance/student/:studentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const studentId = paramStr(req.params.studentId);
  if (req.user?.role === 'student' && req.user.studentId !== studentId) {
    return res.status(403).json({ error: 'You can only view your own attendance history.' });
  }
  try {
    if (req.user?.role === 'teacher') {
      const [student, teacher] = await Promise.all([
        backendStore.getStudentDirectoryRecord(studentId),
        backendStore.getTeacherDirectoryRecord(req.user.teacherId || '')
      ]);
      const assignedClasses = [...(teacher?.assignedClasses || []).map((item: any) => item.class), ...(teacher?.classTeacherOf || [])];
      if (!student || !assignedClasses.includes(student.class)) {
        return res.status(403).json({ error: 'You can only view attendance for students in your assigned classes.' });
      }
    }
    const history = await backendStore.getStudentAttendanceHistory(studentId);
    res.json(history);
  } catch (error) {
    respondWithDatabaseError(res, 'attendance', error);
  }
});

/* ── Grades & Report Cards ───────────────────────────────────────────────── */

router.get('/grades', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role === 'student') {
      return res.json(await backendStore.getGrades(req.user.studentId ? [req.user.studentId] : []));
    }
    if (req.user?.role === 'teacher') {
      const teacher = await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '');
      const allowedClasses: string[] = [...new Set<string>(
        (teacher?.assignedClasses || [])
          .map((item: any) => item.class)
          .filter((className: unknown): className is string => typeof className === 'string' && Boolean(className))
      )];
      const students = allowedClasses.length ? await backendStore.getStudents({ allowedClasses }) : [];
      const studentRecords = Array.isArray(students) ? students : students.data;
      return res.json(await backendStore.getGrades(studentRecords.map((student: any) => student.id)));
    }
    res.json(await backendStore.getGrades());
  } catch (error) {
    respondWithDatabaseError(res, 'grades', error);
  }
});

router.post('/grades', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body || {};
  const studentId = body.studentId;
  const term = body.term;
  const subject = body.subject;
  if (!studentId || !term || !subject) {
    return res.status(400).json({ error: 'studentId, term, and subject are required.' });
  }
  const gradeData = body.grade && typeof body.grade === 'object' ? body.grade : body;
  try {
    if (req.user?.role === 'teacher') {
      const [student, teacher] = await Promise.all([
        backendStore.getStudentDirectoryRecord(String(studentId)),
        backendStore.getTeacherDirectoryRecord(req.user.teacherId || '')
      ]);
      const assigned = (teacher?.assignedClasses || []).some(
        (assignment: any) => assignment.class === student?.class && assignment.subject === subject
      );
      if (!assigned) return res.status(403).json({ error: 'You can only enter grades for your assigned classes and subjects.' });
    }
    const saved = await backendStore.saveGrade(
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
  } catch (error) {
    respondWithDatabaseError(res, 'grades', error);
  }
});

router.get('/reports/:studentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const targetId = paramStr(req.params.studentId);
  if (req.user?.role === 'student' && req.user.studentId !== targetId) {
    return res.status(403).json({ error: 'Access denied. You can only view your own report card.' });
  }
  const term = typeof req.query.term === 'string' ? req.query.term : 'Term1';
  const session = typeof req.query.session === 'string' ? req.query.session : '2026/2027';
  try {
    if (req.user?.role === 'teacher') {
      const [student, teacher] = await Promise.all([
        backendStore.getStudentDirectoryRecord(targetId),
        backendStore.getTeacherDirectoryRecord(req.user.teacherId || '')
      ]);
      const isClassTeacher = Boolean(student && (teacher?.classTeacherOf || []).includes(student.class));
      if (!isClassTeacher) return res.status(403).json({ error: "Only the student's class teacher can view this report." });
    }
    const report = await backendStore.getStudentReportCard(targetId, term, session);
    if (!report) return res.status(404).json({ error: 'Student report not found.' });
    res.json(report);
  } catch (error) {
    respondWithDatabaseError(res, 'student report', error);
  }
});

/* ── Resources, Equipment & Maintenance ──────────────────────────────────── */

router.get('/resources', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
  const query = req.query as Record<string, string | undefined>;
  const options: Record<string, any> = {
    search: query.search,
    subject: query.subject,
    type: query.type,
    class: query.class,
    page: query.page ? Number(query.page) : undefined,
    limit: query.limit ? Number(query.limit) : undefined,
    role: req.user?.role
  };
  let visibleSubjectNames: string[] | undefined;
  if (req.user?.role === 'student') {
    const student = await backendStore.getStudentDirectoryRecord(req.user.studentId || '');
    if (!student) return res.status(403).json({ error: 'Student profile is unavailable.' });
    if (query.class && query.class !== 'all' && query.class !== student.class) {
      return res.status(403).json({ error: 'You can only view resources for your class.' });
    }
    options.class = student.class;
    options.studentSubjects = student.enrolledSubjects || [];
    visibleSubjectNames = student.enrolledSubjects?.length ? student.enrolledSubjects : undefined;
  } else if (req.user?.role === 'teacher') {
    const teacher = await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '');
    if (!teacher) return res.status(403).json({ error: 'Teacher profile is unavailable.' });
    options.teacherName = teacher?.name || '';
    options.teacherAssignments = teacher?.assignedClasses || [];
    visibleSubjectNames = (teacher?.assignedClasses || []).map((assignment: any) => assignment.subject);
  }
  const [result, summary, subjects] = await Promise.all([
    backendStore.getResources(options),
    backendStore.getResources({
      role: options.role,
      teacherName: options.teacherName,
      teacherAssignments: options.teacherAssignments,
      studentSubjects: options.studentSubjects,
      class: options.role === 'student' ? options.class : undefined,
      page: 1,
      limit: 1
    }),
    backendStore.getSubjects({
      class: options.role === 'student' && !visibleSubjectNames ? options.class : undefined,
      names: visibleSubjectNames
    })
  ]);
  if (Array.isArray(result)) return res.json(result);
  res.json({ ...result, subjects: subjects.map((subject: any) => subject.name), resourceCount: Array.isArray(summary) ? summary.length : summary.total });
  } catch (error) {
    respondWithDatabaseError(res, 'resources', error);
  }
});

router.post('/resources', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Resource title is required.' });
  try {
    let resource = req.body || {};
    if (req.user?.role === 'teacher') {
      const teacher = await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '');
      if (!teacher) return res.status(403).json({ error: 'Teacher profile is unavailable.' });
      resource = { ...resource, uploadedBy: teacher.name };
    }
    const created = await backendStore.addResource(resource);
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'resources', error);
  }
});

router.put('/resources/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const updated = await backendStore.updateResource(paramStr(req.params.id), req.body || {});
    if (!updated) return res.status(404).json({ error: 'Resource not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'resources', error);
  }
});

router.delete('/resources/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  try {
    const deleted = await backendStore.deleteResource(id);
    if (!deleted) return res.status(404).json({ error: 'Resource not found.' });
    res.json({ ok: true, id });
  } catch (error) {
    respondWithDatabaseError(res, 'resources', error);
  }
});

router.get('/equipment', requireAuth, async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | undefined>;
  const pagination = getDatabasePagination(req);
  try {
    const result = await backendStore.getEquipment((query.search || '').trim(), pagination.page, pagination.limit);
    if (pagination.page === undefined) return res.json(result.data);
    res.json({
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / (result.limit || pagination.limit || 20))
    });
  } catch (error) {
    respondWithDatabaseError(res, 'equipment', error);
  }
});

router.post('/equipment', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Equipment name is required.' });
  try {
    const created = await backendStore.addEquipment(req.body);
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'equipment', error);
  }
});

router.delete('/equipment/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  try {
    const deleted = await backendStore.deleteEquipment(id);
    if (!deleted) return res.status(404).json({ error: 'Equipment not found.' });
    res.json({ ok: true, id });
  } catch (error) {
    respondWithDatabaseError(res, 'equipment', error);
  }
});

router.get('/maintenance', requireAuth, async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | undefined>;
  const pagination = getDatabasePagination(req);
  try {
    const result = await backendStore.getMaintenance((query.search || '').trim(), pagination.page, pagination.limit);
    if (pagination.page === undefined) return res.json(result.data);
    res.json({
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / (result.limit || pagination.limit || 20)),
      openCount: result.openCount
    });
  } catch (error) {
    respondWithDatabaseError(res, 'maintenance requests', error);
  }
});

router.post('/maintenance', requireAuth, requireRole('admin', 'teacher'), async (req: Request, res: Response) => {
  const { itemName } = req.body || {};
  if (!itemName) return res.status(400).json({ error: 'Item name is required.' });
  try {
    const created = await backendStore.addMaintenance(req.body);
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'maintenance requests', error);
  }
});

router.patch('/maintenance/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Status is required.' });
  try {
    const updated = await backendStore.updateMaintenanceStatus(paramStr(req.params.id), status);
    if (!updated) return res.status(404).json({ error: 'Maintenance request not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'maintenance requests', error);
  }
});

/* ── Documents ───────────────────────────────────────────────────────────── */

router.get('/documents', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
  const query = req.query as Record<string, string | undefined>;
  const options: Record<string, any> = {
    search: query.search,
    category: query.category,
    access: query.access,
    role: req.user?.role,
    page: query.page ? Number(query.page) : undefined,
    limit: query.limit ? Number(query.limit) : undefined
  };
  if (req.user?.role === 'student') {
    const student = await backendStore.getStudentDirectoryRecord(req.user.studentId || '');
    if (!student) return res.status(403).json({ error: 'Student profile is unavailable.' });
    options.classes = student.class ? [student.class] : [];
  } else if (req.user?.role === 'teacher') {
    const teacher = await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '');
    if (!teacher) return res.status(403).json({ error: 'Teacher profile is unavailable.' });
    options.classes = [
      ...(teacher?.assignedClasses || []).map((item: any) => item.class),
      ...(teacher?.classTeacherOf || [])
    ];
  }
  const [result, facets] = await Promise.all([
    backendStore.getDocuments(options),
    backendStore.getDocumentFacets(options.role, options.classes || [])
  ]);
  if (Array.isArray(result)) return res.json(result);
  res.json({ ...result, ...facets });
  } catch (error) {
    respondWithDatabaseError(res, 'documents', error);
  }
});

router.post('/documents', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Document name is required.' });
  try {
    const created = await backendStore.addDocument(req.body);
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'documents', error);
  }
});

router.patch('/documents/:id/access', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { accessLevel, allowedClasses } = req.body || {};
  if (!accessLevel) return res.status(400).json({ error: 'accessLevel is required.' });
  try {
    const updated = await backendStore.updateDocumentAccess(
      paramStr(req.params.id),
      accessLevel,
      Array.isArray(allowedClasses) ? allowedClasses : ['All Classes']
    );
    if (!updated) return res.status(404).json({ error: 'Document not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'documents', error);
  }
});

router.delete('/documents/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  try {
    const deleted = await backendStore.deleteDocument(id);
    if (!deleted) return res.status(404).json({ error: 'Document not found.' });
    res.json({ ok: true, id });
  } catch (error) {
    respondWithDatabaseError(res, 'documents', error);
  }
});

/* ── Announcements ───────────────────────────────────────────────────────── */

router.get('/announcements', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    let classes: string[] | undefined;
    if (req.user?.role === 'student') {
      const student = await backendStore.getStudentDirectoryRecord(req.user.studentId || '');
      if (!student) return res.status(403).json({ error: 'Student profile is unavailable.' });
      classes = student.class ? [student.class] : [];
    } else if (req.user?.role === 'teacher') {
      const teacher = await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '');
      if (!teacher) return res.status(403).json({ error: 'Teacher profile is unavailable.' });
      classes = [...new Set([
        ...(teacher.assignedClasses || []).map((assignment: any) => assignment.class),
        ...(teacher.classTeacherOf || [])
      ].filter((className: unknown): className is string => typeof className === 'string' && Boolean(className)))];
    }
    res.json(await backendStore.getAnnouncements({
      search: query.search,
      type: query.type,
      audience: query.audience,
      scope: query.scope,
      role: req.user?.role,
      userId: req.user?.teacherId || req.user?.id,
      classes,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined
    }));
  } catch (error) {
    respondWithDatabaseError(res, 'announcements', error);
  }
});

router.post('/announcements', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const { title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Title and content are required.' });
  try {
    const teacher = req.user?.role === 'teacher'
      ? await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '')
      : null;
    if (req.user?.role === 'teacher' && !teacher) {
      return res.status(403).json({ error: 'Teacher profile is unavailable.' });
    }
    const trustedFields = teacher
      ? {
          author: teacher.name,
          authorRole: 'Teaching Staff',
          creatorId: teacher.id,
          isPinned: false
        }
      : { creatorId: req.user?.id || '' };
    const created = await backendStore.addAnnouncement({
      ...(req.body || {}),
      ...trustedFields
    });
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'announcements', error);
  }
});

router.put('/announcements/:id', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    let patch = req.body || {};
    if (req.user?.role === 'teacher') {
      const announcement = await backendStore.getAnnouncementById(id);
      if (!announcement) return res.status(404).json({ error: 'Announcement not found.' });
      if (announcement.creatorId !== req.user.teacherId) {
        return res.status(403).json({ error: 'You can only update announcements you created.' });
      }
      const allowedFields = [
        'title', 'content', 'type', 'priority', 'eventDate',
        'eventTime', 'location', 'targetAudiences', 'attachments', 'status'
      ];
      patch = Object.fromEntries(
        Object.entries(patch).filter(([key]) => allowedFields.includes(key))
      );
    }
    const updated = await backendStore.updateAnnouncement(id, patch);
    if (!updated) return res.status(404).json({ error: 'Announcement not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'announcements', error);
  }
});

router.delete('/announcements/:id', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const id = paramStr(req.params.id);
  try {
    if (req.user?.role === 'teacher') {
      const announcement = await backendStore.getAnnouncementById(id);
      if (!announcement) return res.status(404).json({ error: 'Announcement not found.' });
      if (announcement.creatorId !== req.user.teacherId) {
        return res.status(403).json({ error: 'You can only delete announcements you created.' });
      }
    }
    const deleted = await backendStore.deleteAnnouncement(id);
    if (!deleted) return res.status(404).json({ error: 'Announcement not found.' });
    res.json({ ok: true, id });
  } catch (error) {
    respondWithDatabaseError(res, 'announcements', error);
  }
});

/* ── Teacher Availability ────────────────────────────────────────────────── */

router.get('/availability', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await backendStore.getTeacherAvailability(
      req.user?.role === 'teacher' ? req.user.teacherId : undefined
    ));
  } catch (error) {
    respondWithDatabaseError(res, 'teacher availability', error);
  }
});

router.post('/availability', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === 'teacher' && !req.user.teacherId) {
    return res.status(403).json({ error: 'Teacher profile is not linked to this account.' });
  }
  try {
    const created = await backendStore.addTeacherAvailabilitySlot({
      ...(req.body || {}),
      ...(req.user?.role === 'teacher' ? { teacherId: req.user.teacherId, teacherName: req.user.name } : {})
    });
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'teacher availability', error);
  }
});

router.patch('/availability/:id/toggle', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await backendStore.toggleTeacherAvailabilitySlot(
      paramStr(req.params.id),
      req.user?.role === 'teacher' ? req.user.teacherId : undefined
    );
    if (!updated) return res.status(404).json({ error: 'Availability slot not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'teacher availability', error);
  }
});

router.delete('/availability/:id', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const id = paramStr(req.params.id);
  try {
    const deleted = await backendStore.deleteTeacherAvailabilitySlot(
      id,
      req.user?.role === 'teacher' ? req.user.teacherId : undefined
    );
    if (!deleted) return res.status(404).json({ error: 'Availability slot not found.' });
    res.json({ ok: true, id });
  } catch (error) {
    respondWithDatabaseError(res, 'teacher availability', error);
  }
});

/* ── Assignments ─────────────────────────────────────────────────────────── */

router.get('/assignments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
  const query = req.query as Record<string, string | undefined>;
  const options: Record<string, any> = {
    search: query.search,
    class: query.class,
    subject: query.subject,
    role: req.user?.role,
    page: query.page ? Number(query.page) : undefined,
    limit: query.limit ? Number(query.limit) : undefined
  };
  let subjectNames: string[] | undefined;
  if (req.user?.role === 'student') {
    const student = await backendStore.getStudentDirectoryRecord(req.user.studentId || '');
    if (!student) return res.status(403).json({ error: 'Student profile is unavailable.' });
    options.studentClass = student.class;
    options.studentSubjects = student.enrolledSubjects || [];
    subjectNames = student.enrolledSubjects?.length ? student.enrolledSubjects : undefined;
    if (!subjectNames) options.subjectClass = student.class;
  } else if (req.user?.role === 'teacher') {
    const teacher = await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '');
    if (!teacher) return res.status(403).json({ error: 'Teacher profile is unavailable.' });
    options.teacherName = teacher?.name || '';
    options.teacherAssignments = teacher?.assignedClasses || [];
    subjectNames = (teacher?.assignedClasses || []).map((assignment: any) => assignment.subject);
  }
  const result = await backendStore.getAssignments(options);
  if (Array.isArray(result)) return res.json(result);
  const subjects = await backendStore.getSubjects({
    class: options.subjectClass,
    names: subjectNames
  });
  res.json({ ...result, subjects: subjects.map((subject: any) => subject.name) });
  } catch (error) {
    respondWithDatabaseError(res, 'assignments', error);
  }
});

router.post('/assignments', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const { title, subject } = req.body || {};
  if (!title || !subject) return res.status(400).json({ error: 'Title and subject are required.' });
  try {
    let assignment = req.body || {};
    if (req.user?.role === 'teacher') {
      const teacher = await backendStore.getTeacherDirectoryRecord(req.user.teacherId || '');
      const canTeachSubject = (teacher?.assignedClasses || []).some(
        (item: any) => item.class === assignment.class && item.subject === assignment.subject
      );
      if (!teacher || !canTeachSubject) {
        return res.status(403).json({ error: 'You can only publish assignments for your assigned classes and subjects.' });
      }
      const {
        title: safeTitle,
        subject: safeSubject,
        class: safeClass,
        description,
        dueDate,
        totalMarks,
        maxMarks,
        type,
        attachmentName,
        attachmentSize,
        attachmentPath,
        attachmentUrl,
        attachments
      } = assignment;
      assignment = {
        title: safeTitle,
        subject: safeSubject,
        class: safeClass,
        description,
        dueDate,
        totalMarks,
        maxMarks,
        type,
        attachmentName,
        attachmentSize,
        attachmentPath,
        attachmentUrl,
        attachments,
        teacherName: teacher.name
      };
    }
    const created = await backendStore.addAssignment(assignment);
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'classes', error);
  }
});

router.put('/assignments/:id', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assignmentId = paramStr(req.params.id);
    let patch = req.body || {};
    if (req.user?.role === 'teacher') {
      const [teacher, existing] = await Promise.all([
        backendStore.getTeacherDirectoryRecord(req.user.teacherId || ''),
        backendStore.getAssignmentById(assignmentId)
      ]);
      if (!teacher || !existing || existing.teacherName !== teacher.name) {
        return res.status(403).json({ error: 'You can only update your own assignments.' });
      }
      const nextClass = patch.class || existing.class;
      const nextSubject = patch.subject || existing.subject;
      const isAssigned = (teacher.assignedClasses || []).some(
        (item: any) => item.class === nextClass && item.subject === nextSubject
      );
      if (!isAssigned) {
        return res.status(403).json({ error: 'You can only assign work for your assigned classes and subjects.' });
      }
      const allowedFields = [
        'title', 'subject', 'class', 'description', 'dueDate', 'totalMarks',
        'maxMarks', 'type', 'attachmentName', 'attachmentSize',
        'attachmentPath', 'attachmentUrl', 'attachments'
      ];
      patch = Object.fromEntries(
        Object.entries(patch).filter(([key]) => allowedFields.includes(key))
      );
    }
    const updated = await backendStore.updateAssignment(assignmentId, patch);
    if (!updated) return res.status(404).json({ error: 'Assignment not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'classes', error);
  }
});

router.delete('/assignments/:id', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const id = paramStr(req.params.id);
  try {
    if (req.user?.role === 'teacher') {
      const [teacher, existing] = await Promise.all([
        backendStore.getTeacherDirectoryRecord(req.user.teacherId || ''),
        backendStore.getAssignmentById(id)
      ]);
      if (!teacher || !existing || existing.teacherName !== teacher.name) {
        return res.status(403).json({ error: 'You can only delete your own assignments.' });
      }
    }
    const deleted = await backendStore.deleteAssignment(id);
    if (!deleted) return res.status(404).json({ error: 'Assignment not found.' });
    res.json({ ok: true, id });
  } catch (error) {
    respondWithDatabaseError(res, 'assignments', error);
  }
});

router.post('/assignments/:id/submit', requireAuth, requireRole('student'), async (req: AuthenticatedRequest, res: Response) => {
  const { notes, fileName, fileUrl, filePath } = req.body || {};
  const resolvedId = req.user?.studentId || '';
  if (!resolvedId) return res.status(400).json({ error: 'Student identifier is required.' });
  let assignment;
  let studentRecord;
  try {
    assignment = await backendStore.getAssignmentById(paramStr(req.params.id));
    studentRecord = await backendStore.getStudentDirectoryRecord(resolvedId);
  } catch (error) {
    return respondWithDatabaseError(res, 'student', error);
  }
  if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
  if (!studentRecord || (assignment.class && assignment.class !== 'All Classes' && assignment.class !== studentRecord.class)) {
    return res.status(403).json({ error: 'This assignment is not available to your class.' });
  }
  const enrolledSubjects = studentRecord.enrolledSubjects || [];
  if (
    assignment.subject &&
    assignment.subject !== 'General' &&
    enrolledSubjects.length > 0 &&
    !enrolledSubjects.includes(assignment.subject)
  ) {
    return res.status(403).json({ error: 'This assignment is not available to your enrolled subjects.' });
  }
  const student = {
    id: resolvedId,
    name: req.user?.name || 'Student'
  };
  try {
    const updated = await backendStore.submitStudentAssignment(paramStr(req.params.id), student, {
      notes,
      fileName,
      fileUrl,
      filePath
    });
    if (!updated) return res.status(404).json({ error: 'Assignment not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'classes', error);
  }
});

/* ── Student Requests ────────────────────────────────────────────────────── */

router.get('/requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.user?.role === 'student' ? req.user.studentId : undefined;
    res.json(await backendStore.getRequests(studentId));
  } catch (error) {
    respondWithDatabaseError(res, 'student requests', error);
  }
});

router.post('/requests', requireAuth, requireRole('student'), async (req: AuthenticatedRequest, res: Response) => {
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Request title is required.' });
  try {
    const student = req.user?.role === 'student'
      ? await backendStore.getStudentDirectoryRecord(req.user.studentId || '')
      : null;
    const created = await backendStore.addRequest({
      ...(req.body || {}),
      ...(student ? {
        studentId: student.id,
        studentName: student.name,
        admissionNumber: student.admissionNumber,
        class: student.class
      } : {})
    });
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'student requests', error);
  }
});

router.patch('/requests/:id/status', requireAuth, requireRole('admin', 'teacher'), async (req: Request, res: Response) => {
  const { status, staffResponse } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Status is required.' });
  try {
    const updated = await backendStore.updateRequestStatus(paramStr(req.params.id), status, staffResponse || '');
    if (!updated) return res.status(404).json({ error: 'Student request not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'student requests', error);
  }
});

/* ── Public Enquiries ────────────────────────────────────────────────────── */

router.get('/enquiries', requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    res.json(await backendStore.getEnquiries());
  } catch (error) {
    respondWithDatabaseError(res, 'enquiries', error);
  }
});

router.post('/enquiries', async (req: Request, res: Response) => {
  const { kind, parentName, email } = req.body || {};
  if (!parentName || !email) {
    return res.status(400).json({ error: 'Parent name and email are required.' });
  }
  try {
    const entry = await backendStore.addEnquiry(kind || 'enquiry', req.body || {});
    res.status(201).json(entry);
  } catch (error) {
    respondWithDatabaseError(res, 'enquiries', error);
  }
});

/* ── Direct Messages ─────────────────────────────────────────────────────── */

router.get('/messages', requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    res.json(await backendStore.getDirectMessages());
  } catch (error) {
    respondWithDatabaseError(res, 'messages', error);
  }
});

router.post('/messages', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  const { recipient, subject, content, role } = req.body || {};
  if (!recipient || !subject || !content) {
    return res.status(400).json({ error: 'recipient, subject, and content are required.' });
  }
  try {
  const created = await backendStore.addDirectMessage({
    senderId: req.user?.id || '',
    senderName: req.user?.name || 'Administrator',
    recipient,
    role: role || 'Recipient',
    subject,
    content
  });
  res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'messages', error);
  }
});

/* ── Staff Leaves ────────────────────────────────────────────────────────── */

router.get('/staff-leaves', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.user?.role === 'teacher' ? req.user.teacherId : (typeof req.query.teacherId === 'string' ? req.query.teacherId : undefined);
  try {
    res.json(await backendStore.getStaffLeaves(teacherId));
  } catch (error) {
    respondWithDatabaseError(res, 'staff leaves', error);
  }
});

router.post('/staff-leaves', requireAuth, requireRole('admin', 'teacher'), async (req: AuthenticatedRequest, res: Response) => {
  const { type, startDate, endDate, reason, days } = req.body || {};
  if (!startDate || !endDate || !reason) {
    return res.status(400).json({ error: 'startDate, endDate, and reason are required.' });
  }
  try {
    const teacher = req.user?.teacherId
      ? await backendStore.getTeacherDirectoryRecord(req.user.teacherId)
      : null;
    if (req.user?.role === 'teacher' && !teacher) {
      return res.status(403).json({ error: 'Teacher profile is unavailable.' });
    }
    const created = await backendStore.addStaffLeave({
      teacherId: teacher?.id || (req.user?.role === 'admin' ? req.body?.teacherId : '') || '',
      teacherName: teacher?.name || (req.user?.role === 'admin' ? req.body?.teacherName : '') || req.user?.name || 'Staff',
      type: type || 'Casual Leave',
      startDate,
      endDate,
      days: days || 1,
      reason
    });
    res.status(201).json(created);
  } catch (error) {
    respondWithDatabaseError(res, 'teacher profile', error);
  }
});

router.patch('/staff-leaves/:id', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Status is required.' });
  try {
    const updated = await backendStore.updateStaffLeaveStatus(paramStr(req.params.id), status, req.user?.name || 'Administrator');
    if (!updated) return res.status(404).json({ error: 'Leave request not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'staff leaves', error);
  }
});

/* ── Help Tickets ────────────────────────────────────────────────────────── */

router.get('/help-tickets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const studentId = req.user?.role === 'student' ? req.user.studentId : undefined;
  try {
    res.json(await backendStore.getHelpTickets(studentId));
  } catch (error) {
    respondWithDatabaseError(res, 'help tickets', error);
  }
});

router.post('/help-tickets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { subject, description, category, priority } = req.body || {};
  if (!subject || !description) {
    return res.status(400).json({ error: 'Subject and description are required.' });
  }
  const studentName = req.user?.name || 'Student';
  try {
  const created = await backendStore.addHelpTicket({
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
  } catch (error) {
    respondWithDatabaseError(res, 'help tickets', error);
  }
});

router.post('/help-tickets/:id/reply', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  const reply = {
    id: String(Date.now()),
    author: req.user?.name || 'User',
    authorType: req.user?.role || 'student',
    message,
    timestamp: new Date().toLocaleString('en-GB')
  };
  try {
    const studentId = req.user?.role === 'student' ? req.user.studentId : undefined;
    const updated = await backendStore.addHelpTicketReply(paramStr(req.params.id), reply, studentId);
    if (!updated) return res.status(404).json({ error: 'Help ticket not found.' });
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'help tickets', error);
  }
});

/* ── Files Upload & Download ─────────────────────────────────────────────── */

router.post('/files/upload', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Attach multipart field named "file".' });
  }
  const requestedFolder = typeof req.body?.folder === 'string' && req.body.folder ? req.body.folder : 'general';
  let folder = requestedFolder;
  if (req.user?.role === 'student') {
    const studentFolder = String(req.user.studentId || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (requestedFolder !== 'submissions' || !studentFolder) {
      return res.status(403).json({ error: 'Students may only upload assignment submissions.' });
    }
    folder = `submissions-${studentFolder}`;
  } else if (req.user?.role === 'teacher' && !['resources', 'assignments'].includes(requestedFolder)) {
    return res.status(403).json({ error: 'You do not have permission to upload files to this area.' });
  }
  try {
    const uploaded = await uploadFileToBackendStorage(folder, req.file);
    res.status(201).json(uploaded);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'File upload failed.' });
  }
});

router.get('/files/download/:folder/:filename', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const folder = paramStr(req.params.folder);
  const filename = paramStr(req.params.filename);
  if (!/^[A-Za-z0-9_-]+$/.test(folder) || !/^[A-Za-z0-9._-]+$/.test(filename)) {
    return res.status(404).json({ error: 'File not found.' });
  }
  const relativePath = `${folder}/${filename}`;
  if (!await backendStore.canAccessFile(relativePath, req.user)) {
    return res.status(403).json({ error: 'You do not have access to this file.' });
  }

  try {
    const file = await downloadFileFromBackendStorage(relativePath);
    if (!file) return res.status(404).json({ error: 'File not found.' });
    res.type('application/octet-stream').attachment(filename).send(file);
  } catch (error) {
    console.error('File download failed:', error);
    res.status(500).json({ error: 'File download failed.' });
  }
});

/* ── Academic Session Rollover & Promotion ───────────────────────────────── */

router.get('/academic/promotion-candidates', requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const candidates = await backendStore.getPromotionCandidates();
    res.json({ candidates });
  } catch (error) {
    respondWithDatabaseError(res, 'promotion candidates', error);
  }
});

router.post('/academic/rollover-session', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { nextSession, promotions } = req.body || {};
  if (!nextSession || !Array.isArray(promotions)) {
    return res.status(400).json({ error: 'nextSession and promotions array are required.' });
  }
  try {
    const result = await backendStore.executeSessionRollover({ nextSession, promotions });
    res.json(result);
  } catch (error) {
    respondWithDatabaseError(res, 'academic session rollover', error);
  }
});

/* ── Academic Sessions & Terms ───────────────────────────────────────────── */

router.get('/academic/sessions', requireAuth, async (_req: Request, res: Response) => {
  try {
    const settings = await backendStore.getSettings();
    res.json({
      sessions: ['2026/2027', '2025/2026', '2024/2025'],
      currentSession: settings.currentSession || '2026/2027',
      terms: ['Term 1', 'Term 2', 'Term 3'],
      currentTerm: settings.currentTerm || 'Term 1'
    });
  } catch (error) {
    respondWithDatabaseError(res, 'institution settings', error);
  }
});

/* ── Institution Settings ─────────────────────────────────────────────────── */

router.get('/settings', requireAuth, async (_req: Request, res: Response) => {
  try {
    res.json(await backendStore.getSettings());
  } catch (error) {
    respondWithDatabaseError(res, 'institution settings', error);
  }
});

router.put('/settings', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const updated = await backendStore.updateSettings(req.body || {});
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'institution settings', error);
  }
});

router.post('/settings', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const updated = await backendStore.updateSettings(req.body || {});
    res.json(updated);
  } catch (error) {
    respondWithDatabaseError(res, 'institution settings', error);
  }
});

export default router;
