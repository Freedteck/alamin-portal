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

/* ── System & Health ─────────────────────────────────────────────────────── */

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
  res.json({ user: freshUser || req.user });
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

router.post(
  '/auth/profile/avatar',
  requireAuth,
  upload.single('avatar'),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }
    try {
      const uploaded = await uploadFileToBackendStorage('avatars', req.file);
      const avatarUrl = uploaded.fileUrl || `/files/download/${uploaded.filePath}`;
      const updatedUser = backendStore.updateUserAvatar(req.user!.id, avatarUrl);
      res.json({ success: true, avatarUrl, user: updatedUser });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update avatar photo.' });
    }
  }
);

/* ── Subjects ────────────────────────────────────────────────────────────── */

router.get('/subjects', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getSubjects());
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
  res.json(backendStore.getStudents());
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

router.get('/teachers', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getTeachers());
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
  const { class: className, subject } = req.body || {};
  if (!className || !subject) {
    return res.status(400).json({ error: 'Both class and subject are required.' });
  }
  const updated = backendStore.assignTeacherClass(paramStr(req.params.id), { class: className, subject });
  if (!updated) return res.status(404).json({ error: 'Teacher not found.' });
  res.json(updated);
});

router.delete('/teachers/:id/assign-class', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const className = String(req.body?.class || req.query?.class || '');
  const subject = String(req.body?.subject || req.query?.subject || '');
  if (!className || !subject) {
    return res.status(400).json({ error: 'Both class and subject are required.' });
  }
  const updated = backendStore.removeTeacherClass(paramStr(req.params.id), { class: className, subject });
  if (!updated) return res.status(404).json({ error: 'Teacher not found.' });
  res.json(updated);
});

router.delete('/teachers/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.deleteTeacher(id);
  if (!deleted) return res.status(404).json({ error: 'Teacher not found.' });
  res.json({ ok: true, id });
});

/* ── Timetable & Alerts ──────────────────────────────────────────────────── */

router.get('/timetable', requireAuth, (req: Request, res: Response) => {
  const className = typeof req.query.class === 'string' ? req.query.class : undefined;
  res.json(backendStore.getTimetableSlots(className));
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

router.get('/alerts', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getAlerts());
});

router.delete('/alerts/:id', requireAuth, (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const deleted = backendStore.dismissAlert(id);
  if (!deleted) return res.status(404).json({ error: 'Alert not found.' });
  res.json({ ok: true, id });
});

/* ── Attendance ──────────────────────────────────────────────────────────── */

router.get('/attendance', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getAttendance());
});

router.post('/attendance', requireAuth, requireRole('admin', 'teacher'), (req: AuthenticatedRequest, res: Response) => {
  const { date, className, submittedBy, records } = req.body || {};
  if (!date || !className || !records) {
    return res.status(400).json({ error: 'date, className, and records are required.' });
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
  const { studentId, term, subject, ca1, ca2, exam, remark, session } = req.body || {};
  if (!studentId || !term || !subject) {
    return res.status(400).json({ error: 'studentId, term, and subject are required.' });
  }
  const saved = backendStore.saveGrade(
    studentId,
    term,
    subject,
    { ca1, ca2, exam, remark },
    session || '2026/2027'
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

router.get('/resources', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getResources());
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

router.get('/documents', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getDocuments());
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

router.get('/announcements', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getAnnouncements());
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

router.get('/assignments', requireAuth, (_req: Request, res: Response) => {
  res.json(backendStore.getAssignments());
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

export default router;
