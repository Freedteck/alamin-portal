import { apiClient } from '../lib/apiClient';
import {
  SCHOOL_CLASSES,
  SSS_DEPARTMENTS,
  ACADEMIC_SESSIONS,
  TIMETABLE_DAYS,
  computeGrade,
  getClassCode,
  generateAdmissionNumber,
  isSeniorClass
} from '../constants/academic';

// In-memory runtime state for fast reactive UI renders
let state = {
  classes: [],
  subjects: [],
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

const listeners = new Set();

export function subscribeSchoolSync(callback) {
  if (typeof callback !== 'function') return () => {};
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyChange(resource = 'all') {
  listeners.forEach((fn) => {
    try {
      fn(resource);
    } catch (e) {
      console.error('Error in school sync listener:', e);
    }
  });
}

export async function refreshCloudData() {
  const token = apiClient.getToken();
  if (!token) return false;
  try {
    const payload = await apiClient.get('/bootstrap');
    if (payload && typeof payload === 'object') {
      state = {
        ...state,
        ...payload
      };
      notifyChange('bootstrap');
      return true;
    }
  } catch (err) {
    console.warn('[Al-Amin Portal] Failed to refresh data from server:', err?.message || err);
  }
  return false;
}

export function initializeSchoolSync() {
  if (typeof window === 'undefined') return () => {};

  if (apiClient.getToken()) {
    refreshCloudData();
  }

  const unbindAuth = apiClient.onAuthChange(({ authenticated }) => {
    if (authenticated) {
      refreshCloudData();
    } else {
      state = {
        classes: [],
        subjects: [],
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
      notifyChange('logout');
    }
  });

  return () => {
    unbindAuth();
  };
}

export const schoolStore = {
  // Classes
  getClasses() {
    if (state.classes && state.classes.length > 0) {
      return state.classes.map((c) => c.name || c);
    }
    return SCHOOL_CLASSES;
  },
  getClassObjects() {
    if (state.classes && state.classes.length > 0) {
      return state.classes;
    }
    return SCHOOL_CLASSES.map((name, i) => ({
      id: `cls-${i + 1}`,
      name,
      category: isSeniorClass(name) ? 'Senior' : 'Junior',
      classTeacherId: '',
      classTeacherName: ''
    }));
  },
  async addClass(classData) {
    const res = await apiClient.post('/classes', classData);
    if (res && !res.error) {
      state.classes = [...(state.classes || []), res];
      notifyChange('classes');
    }
    return res;
  },
  async deleteClass(id) {
    await apiClient.delete(`/classes/${id}`).catch(() => {});
    state.classes = (state.classes || []).filter((c) => c.id !== id);
    notifyChange('classes');
    return state.classes;
  },
  async assignClassTeacher(className, teacherId) {
    const res = await apiClient.post(`/classes/${encodeURIComponent(className)}/class-teacher`, { teacherId });
    if (res && !res.error) {
      await refreshCloudData();
      notifyChange('classes');
      notifyChange('teachers');
    }
    return res;
  },
  async setTeacherClassTeacherOf(teacherId, classes) {
    const res = await apiClient.post(`/teachers/${teacherId}/class-teacher-of`, { classes });
    if (res && !res.error) {
      await refreshCloudData();
      notifyChange('teachers');
      notifyChange('classes');
    }
    return res;
  },

  // Subjects
  getSubjects() {
    return state.subjects || [];
  },
  getSubjectNames() {
    return (state.subjects || []).map((s) => s.name);
  },
  getSubjectsForClass(className) {
    const list = state.subjects || [];
    if (!className) return list.map((s) => s.name);
    return list
      .filter((s) => s.allClasses || (Array.isArray(s.classes) && s.classes.includes(className)))
      .map((s) => s.name);
  },
  getClassesForTeacher(teacher) {
    const assigned = teacher?.assignedClasses || [];
    const classes = Array.from(new Set(assigned.map((a) => a.class).filter(Boolean)));
    return classes.length > 0 ? classes : this.getClasses();
  },
  getSubjectsForTeacher(teacher) {
    const assigned = teacher?.assignedClasses || [];
    const subjects = Array.from(new Set(assigned.map((a) => a.subject).filter(Boolean)));
    if (subjects.length > 0) return subjects;
    if (teacher?.primarySubject) return [teacher.primarySubject];
    return this.getSubjectNames();
  },
  getSubjectsForClassForTeacher(className, teacher) {
    const assigned = (teacher?.assignedClasses || []).filter((a) => !className || a.class === className);
    const subjects = Array.from(new Set(assigned.map((a) => a.subject).filter(Boolean)));
    if (subjects.length > 0) return subjects;
    return this.getSubjectsForClass(className);
  },
  getStudentsForTeacher(teacher) {
    const assignedClasses = this.getClassesForTeacher(teacher);
    const allStudents = this.getStudents();
    if (!teacher?.assignedClasses || teacher.assignedClasses.length === 0) {
      return allStudents;
    }
    return allStudents.filter((s) => assignedClasses.includes(s.class));
  },
  async addSubject(subject) {
    const res = await apiClient.post('/subjects', subject);
    if (res && !res.error) {
      state.subjects = [...(state.subjects || []), res];
      notifyChange('subjects');
    }
    return res;
  },
  async updateSubject(id, data) {
    const res = await apiClient.put(`/subjects/${id}`, data);
    if (res && !res.error) {
      state.subjects = (state.subjects || []).map((s) => (s.id === id ? res : s));
      notifyChange('subjects');
    }
    return res;
  },
  async deleteSubject(id) {
    const res = await apiClient.delete(`/subjects/${id}`);
    state.subjects = (state.subjects || []).filter((s) => s.id !== id);
    notifyChange('subjects');
    return state.subjects;
  },

  // Students
  getStudents() {
    return state.students || [];
  },
  getStudentById(id) {
    return (state.students || []).find((s) => s.id === id) || null;
  },
  async createStudentAsync(studentData) {
    const res = await apiClient.post('/students', studentData);
    if (res?.student) {
      state.students = [...(state.students || []), res.student];
      notifyChange('students');
      return res;
    }
    if (res && !res.error) {
      state.students = [...(state.students || []), res];
      notifyChange('students');
    }
    return res;
  },
  async updateStudent(id, data) {
    const res = await apiClient.put(`/students/${id}`, data);
    if (res && !res.error) {
      state.students = (state.students || []).map((s) => (s.id === id ? { ...s, ...res } : s));
      notifyChange('students');
    }
    return res;
  },
  async deleteStudent(id) {
    await apiClient.delete(`/students/${id}`).catch(() => {});
    state.students = (state.students || []).filter((s) => s.id !== id);
    notifyChange('students');
    return state.students;
  },
  async resetStudentCredentials(studentId, payload) {
    return await apiClient.post(`/students/${studentId}/credentials`, payload);
  },
  async addStudentToClassSubject(studentId, subject) {
    const student = (state.students || []).find((s) => s.id === studentId);
    if (student) {
      const existing = student.enrolledSubjects || [];
      if (!existing.includes(subject)) {
        student.enrolledSubjects = [...existing, subject];
        notifyChange('students');
      }
    }
    const res = await apiClient.post(`/students/${studentId}/enroll-subject`, { subject });
    if (res && !res.error) {
      state.students = (state.students || []).map((s) => (s.id === studentId ? { ...s, ...res } : s));
      notifyChange('students');
    }
    return res;
  },
  async enrollStudentSubject(studentId, subject) {
    return this.addStudentToClassSubject(studentId, subject);
  },

  // Teachers
  getTeachers() {
    return state.teachers || [];
  },
  getTeacherById(id) {
    return (state.teachers || []).find((t) => t.id === id) || null;
  },
  async createTeacherAsync(teacherData) {
    const res = await apiClient.post('/teachers', teacherData);
    if (res?.teacher) {
      state.teachers = [...(state.teachers || []), res.teacher];
      notifyChange('teachers');
      return res;
    }
    if (res && !res.error) {
      state.teachers = [...(state.teachers || []), res];
      notifyChange('teachers');
    }
    return res;
  },
  async updateTeacher(id, data) {
    const res = await apiClient.put(`/teachers/${id}`, data);
    if (res && !res.error) {
      state.teachers = (state.teachers || []).map((t) => (t.id === id ? { ...t, ...res } : t));
      notifyChange('teachers');
    }
    return res;
  },
  async deleteTeacher(id) {
    await apiClient.delete(`/teachers/${id}`).catch(() => {});
    state.teachers = (state.teachers || []).filter((t) => t.id !== id);
    notifyChange('teachers');
    return state.teachers;
  },
  async resetTeacherCredentials(teacherId, payload) {
    return await apiClient.post(`/teachers/${teacherId}/credentials`, payload);
  },
  async assignTeacherClass(teacherId, classSubject, subjectArg) {
    let payload = { class: '', subject: '' };
    if (typeof classSubject === 'object' && classSubject !== null) {
      payload = {
        class: classSubject.class || classSubject.className || '',
        subject: classSubject.subject || classSubject.subjectName || ''
      };
    } else if (typeof classSubject === 'string') {
      if (subjectArg) {
        payload = { class: classSubject, subject: subjectArg };
      } else if (classSubject.includes('-')) {
        const parts = classSubject.split('-');
        payload = { class: parts[0].trim(), subject: parts.slice(1).join('-').trim() };
      } else {
        payload = { class: classSubject, subject: '' };
      }
    }
    const res = await apiClient.post(`/teachers/${teacherId}/assign-class`, payload);
    if (res?.teacher) {
      state.teachers = (state.teachers || []).map((t) => (t.id === teacherId ? res.teacher : t));
      notifyChange('teachers');
    }
    return res;
  },
  async removeTeacherClass(teacherId, classSubject, subjectArg) {
    let cls = '';
    let sub = '';

    if (typeof classSubject === 'object' && classSubject !== null) {
      cls = classSubject.class || classSubject.className || '';
      sub = classSubject.subject || classSubject.subjectName || '';
    } else if (typeof classSubject === 'string') {
      if (subjectArg) {
        cls = classSubject;
        sub = subjectArg;
      } else if (classSubject.includes('-')) {
        const parts = classSubject.split('-');
        cls = parts[0].trim();
        sub = parts.slice(1).join('-').trim();
      } else {
        cls = classSubject;
      }
    }

    // Optimistically update local teacher record
    const teacher = (state.teachers || []).find((t) => t.id === teacherId);
    if (teacher && teacher.assignedClasses) {
      teacher.assignedClasses = teacher.assignedClasses.filter(
        (a) => !(a.class === cls && a.subject === sub)
      );
      state.teachers = [...state.teachers];
      notifyChange('teachers');
    }

    const query = `class=${encodeURIComponent(cls)}&subject=${encodeURIComponent(sub)}`;
    const res = await apiClient.delete(`/teachers/${teacherId}/assign-class?${query}`, {
      class: cls,
      subject: sub
    });
    if (res?.teacher) {
      state.teachers = (state.teachers || []).map((t) => (t.id === teacherId ? res.teacher : t));
      notifyChange('teachers');
    }
    return res;
  },

  // Timetable
  getTimetableSlots() {
    return state.timetable || [];
  },
  getTimetableForClass(className) {
    return (state.timetable || []).filter((slot) => slot.class === className);
  },
  async addTimetableSlot(slot) {
    const res = await apiClient.post('/timetable', slot);
    if (res && !res.error) {
      state.timetable = [...(state.timetable || []), res];
      notifyChange('timetable');
    }
    return res;
  },
  async updateTimetableSlot(id, slot) {
    const res = await apiClient.put(`/timetable/${id}`, slot);
    if (res && !res.error) {
      state.timetable = (state.timetable || []).map((s) => (s.id === id ? res : s));
      notifyChange('timetable');
    }
    return res;
  },
  async deleteTimetableSlot(id) {
    await apiClient.delete(`/timetable/${id}`).catch(() => {});
    state.timetable = (state.timetable || []).filter((s) => s.id !== id);
    notifyChange('timetable');
    return state.timetable;
  },
  async rescheduleTeacherSlot(arg1, targetDay, targetStartTime, targetEndTime, actorTeacherName) {
    let payload;
    if (typeof arg1 === 'object' && arg1 !== null) {
      payload = arg1;
    } else {
      payload = {
        slotId: arg1,
        targetDay,
        targetStartTime,
        targetEndTime,
        actorTeacherName
      };
    }
    const res = await apiClient.post('/timetable/reschedule', payload);
    await refreshCloudData();
    return res || { success: true };
  },

  // Attendance
  getAttendance() {
    return state.attendance || {};
  },
  getAttendanceLogs() {
    const att = state.attendance || {};
    return Array.isArray(att) ? att : Object.values(att);
  },
  getAttendanceForDateAndClass(date, className) {
    const att = state.attendance || {};
    const key = `${date}_${className}`;
    if (att[key]) return att[key];
    if (att[date] && att[date][className]) return { records: att[date][className] };
    return null;
  },
  getStudentAttendanceHistory(studentId) {
    const att = state.attendance || {};
    const logs = [];
    const entries = Array.isArray(att) ? att : Object.values(att);
    entries.forEach((entry) => {
      if (entry && entry.records && entry.records[studentId]) {
        logs.push({
          date: entry.date,
          className: entry.className || entry.class,
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
    const student = this.getStudentById ? this.getStudentById(studentId) : null;
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
  async saveAttendance(arg1, arg2, arg3, arg4) {
    let date, className, submittedBy, records;
    if (typeof arg1 === 'object' && arg1 !== null) {
      date = arg1.date;
      className = arg1.class || arg1.className;
      submittedBy = arg1.submittedBy;
      records = arg1.records;
    } else {
      date = arg1;
      className = arg2;
      submittedBy = arg3;
      records = arg4;
    }
    const res = await apiClient.post('/attendance', { date, className, submittedBy, records });
    const key = `${date}_${className}`;
    if (!state.attendance) state.attendance = {};
    state.attendance[key] = {
      date,
      className,
      class: className,
      submittedBy: submittedBy || 'Staff',
      records: records || {}
    };
    notifyChange('attendance');
    return res;
  },

  // Grades & Reports
  getGrades() {
    return state.grades || {};
  },
  getStudentSubjectGrade(studentId, term, subject, session = '2026/2027') {
    if (!studentId) {
      return { ca1: 0, ca2: 0, exam: 0, total: 0, grade: '-', remark: 'Not Graded', isRecorded: false };
    }
    // Handle 2-arg call: getStudentSubjectGrade(studentId, subjectId)
    if (subject === undefined) {
      const direct = state.grades && state.grades[studentId] && state.grades[studentId][term];
      if (direct) return { ...direct, isRecorded: true };
    }

    const sessionKey = `${studentId}_${session}_${term}_${subject}`;
    if (state.grades && state.grades[sessionKey]) {
      return { ...state.grades[sessionKey], isRecorded: true };
    }
    const legacyKey = `${studentId}_${term}_${subject}`;
    if (state.grades && state.grades[legacyKey]) {
      return { ...state.grades[legacyKey], isRecorded: true };
    }
    if (state.grades && state.grades[studentId] && state.grades[studentId][subject]) {
      return { ...state.grades[studentId][subject], isRecorded: true };
    }

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
  async getStudentReportCard(studentId, term = 'Term1', session = '2026/2027') {
    try {
      return await apiClient.get(`/reports/${studentId}?term=${encodeURIComponent(term)}&session=${encodeURIComponent(session)}`);
    } catch {
      return null;
    }
  },
  async saveGrade(arg1, arg2, arg3, arg4, arg5) {
    let payload;
    let studentId, term, subject, gradeData, session;
    if (typeof arg1 === 'object' && arg1 !== null) {
      payload = arg1;
      studentId = payload.studentId;
      term = payload.term;
      subject = payload.subject || payload.subjectId;
      gradeData = payload.gradeData || {
        ca1: payload.ca1,
        ca2: payload.ca2,
        exam: payload.exam,
        remark: payload.remark
      };
      session = payload.session || '2026/2027';
    } else {
      studentId = arg1;
      term = arg2;
      subject = arg3;
      gradeData = arg4 || {};
      session = arg5 || '2026/2027';
      payload = {
        studentId,
        term,
        subject,
        ca1: gradeData.ca1,
        ca2: gradeData.ca2,
        exam: gradeData.exam,
        remark: gradeData.remark,
        session
      };
    }

    const key = `${studentId}_${session}_${term}_${subject}`;
    if (!state.grades) state.grades = {};
    state.grades[key] = {
      ...gradeData,
      session,
      term,
      isRecorded: true
    };
    if (!state.grades[studentId]) state.grades[studentId] = {};
    state.grades[studentId][subject] = {
      ...gradeData,
      session,
      term,
      isRecorded: true
    };
    notifyChange('grades');

    const res = await apiClient.post('/grades', payload);
    return res;
  },

  // Announcements
  getAnnouncements() {
    return state.announcements || [];
  },
  getAnnouncementsForUser(user) {
    const role = user?.role || 'student';
    return (state.announcements || []).filter(
      (a) => a.targetRole === 'all' || a.targetRole === role
    );
  },
  async addAnnouncement(data) {
    const res = await apiClient.post('/announcements', data);
    if (res && !res.error) {
      state.announcements = [res, ...(state.announcements || [])];
      notifyChange('announcements');
    }
    return res;
  },
  async updateAnnouncement(id, data) {
    const res = await apiClient.put(`/announcements/${id}`, data);
    if (res && !res.error) {
      state.announcements = (state.announcements || []).map((a) => (a.id === id ? res : a));
      notifyChange('announcements');
    }
    return res;
  },
  async deleteAnnouncement(id) {
    await apiClient.delete(`/announcements/${id}`).catch(() => {});
    state.announcements = (state.announcements || []).filter((a) => a.id !== id);
    notifyChange('announcements');
    return state.announcements;
  },

  // Assignments
  getAssignments() {
    return state.assignments || [];
  },
  async addAssignment(data) {
    const res = await apiClient.post('/assignments', data);
    if (res && !res.error) {
      state.assignments = [res, ...(state.assignments || [])];
      notifyChange('assignments');
    }
    return res;
  },
  async updateAssignment(id, data) {
    const res = await apiClient.put(`/assignments/${id}`, data);
    if (res && !res.error) {
      state.assignments = (state.assignments || []).map((a) => (a.id === id ? res : a));
      notifyChange('assignments');
    }
    return res;
  },
  async deleteAssignment(id) {
    await apiClient.delete(`/assignments/${id}`).catch(() => {});
    state.assignments = (state.assignments || []).filter((a) => a.id !== id);
    notifyChange('assignments');
    return state.assignments;
  },
  async submitStudentAssignment(assignmentId, submission) {
    const res = await apiClient.post(`/assignments/${assignmentId}/submit`, submission);
    await refreshCloudData();
    return res;
  },

  // Resources
  getResources() {
    return state.resources || [];
  },
  getResourcesForUser(role, studentClass, studentSubjects, teacherObj) {
    const all = state.resources || [];
    if (role === 'student') {
      const subjects = studentSubjects || [];
      return all.filter(
        (r) =>
          r.accessLevel === 'students' &&
          (r.allClasses || (r.classes && r.classes.includes(studentClass))) &&
          (!r.subject || r.subject === 'General' || subjects.length === 0 || subjects.includes(r.subject))
      );
    }
    if (role === 'teacher') {
      const teacherSubjects = this.getSubjectsForTeacher(teacherObj);
      const teacherClasses = this.getClassesForTeacher(teacherObj);
      if (teacherObj?.assignedClasses && teacherObj.assignedClasses.length > 0) {
        return all.filter(
          (r) =>
            r.uploadedBy === teacherObj?.name ||
            teacherSubjects.includes(r.subject) ||
            r.allClasses ||
            (r.classes && r.classes.some((c) => teacherClasses.includes(c)))
        );
      }
    }
    return all;
  },
  async addResource(data) {
    const res = await apiClient.post('/resources', data);
    if (res && !res.error) {
      state.resources = [res, ...(state.resources || [])];
      notifyChange('resources');
    }
    return res;
  },
  async deleteResource(id) {
    await apiClient.delete(`/resources/${id}`).catch(() => {});
    state.resources = (state.resources || []).filter((r) => r.id !== id);
    notifyChange('resources');
    return state.resources;
  },

  // Documents
  getDocuments() {
    return state.documents || [];
  },
  getDocumentsForUser(user) {
    return state.documents || [];
  },
  async addDocument(data) {
    const res = await apiClient.post('/documents', data);
    if (res && !res.error) {
      state.documents = [res, ...(state.documents || [])];
      notifyChange('documents');
    }
    return res;
  },
  async updateDocumentAccess(id, access) {
    const res = await apiClient.patch(`/documents/${id}/access`, { access });
    if (res && !res.error) {
      state.documents = (state.documents || []).map((d) => (d.id === id ? res : d));
      notifyChange('documents');
    }
    return res;
  },
  async deleteDocument(id) {
    await apiClient.delete(`/documents/${id}`).catch(() => {});
    state.documents = (state.documents || []).filter((d) => d.id !== id);
    notifyChange('documents');
    return state.documents;
  },

  // Equipment & Maintenance
  getEquipment() {
    return state.equipment || [];
  },
  async addEquipment(data) {
    const res = await apiClient.post('/equipment', data);
    if (res && !res.error) {
      state.equipment = [...(state.equipment || []), res];
      notifyChange('equipment');
    }
    return res;
  },
  async deleteEquipment(id) {
    await apiClient.delete(`/equipment/${id}`).catch(() => {});
    state.equipment = (state.equipment || []).filter((e) => e.id !== id);
    notifyChange('equipment');
    return state.equipment;
  },
  getMaintenance() {
    return state.maintenance || [];
  },
  async addMaintenance(data) {
    const res = await apiClient.post('/maintenance', data);
    if (res && !res.error) {
      state.maintenance = [...(state.maintenance || []), res];
      notifyChange('maintenance');
    }
    return res;
  },
  async updateMaintenanceStatus(id, status) {
    const res = await apiClient.patch(`/maintenance/${id}`, { status });
    if (res && !res.error) {
      state.maintenance = (state.maintenance || []).map((m) => (m.id === id ? res : m));
      notifyChange('maintenance');
    }
    return res;
  },

  // Requests
  getRequests() {
    return state.requests || [];
  },
  async addRequest(data) {
    const res = await apiClient.post('/requests', data);
    if (res && !res.error) {
      state.requests = [res, ...(state.requests || [])];
      notifyChange('requests');
    }
    return res;
  },
  async updateRequestStatus(id, status) {
    const res = await apiClient.patch(`/requests/${id}/status`, { status });
    if (res && !res.error) {
      state.requests = (state.requests || []).map((r) => (r.id === id ? res : r));
      notifyChange('requests');
    }
    return res;
  },

  // Teacher Availability
  getTeacherAvailability() {
    return state.availability || [];
  },
  getTeacherAvailabilityByDay(arg1, arg2) {
    const list = state.availability || [];
    if (arg2 !== undefined) {
      return list.filter((a) => a.teacherId === arg1 && a.day === arg2);
    }
    return list.filter((a) => a.day === arg1);
  },
  async addTeacherAvailabilitySlot(slot) {
    const res = await apiClient.post('/availability', slot);
    if (res && !res.error) {
      state.availability = [...(state.availability || []), res];
      notifyChange('availability');
    }
    return res;
  },
  async toggleTeacherAvailabilitySlot(id) {
    const res = await apiClient.patch(`/availability/${id}/toggle`, {});
    if (res && !res.error) {
      state.availability = (state.availability || []).map((a) => (a.id === id ? res : a));
      notifyChange('availability');
    }
    return res;
  },
  async deleteTeacherAvailabilitySlot(id) {
    await apiClient.delete(`/availability/${id}`).catch(() => {});
    state.availability = (state.availability || []).filter((a) => a.id !== id);
    notifyChange('availability');
    return state.availability;
  },

  // Alerts
  getAlertsForUser(user) {
    return state.alerts || [];
  },
  async dismissAlert(id) {
    await apiClient.delete(`/alerts/${id}`).catch(() => {});
    state.alerts = (state.alerts || []).filter((a) => a.id !== id);
    notifyChange('alerts');
    return state.alerts;
  },

  // Auth & Profile
  async requestPasswordResetOtp(identifier) {
    return await apiClient.post('/auth/forgot-password', { identifier });
  },
  async resetPasswordWithOtp(identifier, otp, newPassword) {
    return await apiClient.post('/auth/reset-password', { identifier, otp, newPassword });
  },
  async uploadProfileAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('file', file);
    const res = await apiClient.request('/auth/profile/avatar', {
      method: 'POST',
      body: formData
    });
    if (res?.user || res?.avatarUrl) {
      try {
        const current = JSON.parse(localStorage.getItem('alamin_user') || '{}');
        const updated = {
          ...current,
          ...(res.user || {}),
          avatarUrl: res.avatarUrl || res.user?.avatarUrl || current.avatarUrl
        };
        localStorage.setItem('alamin_user', JSON.stringify(updated));
      } catch {}
      await refreshCloudData();
    }
    return res;
  },

  // Academic Promotion & Rollover
  async getPromotionCandidates() {
    return await apiClient.get('/academic/promotion-candidates');
  },
  async executeSessionRollover(payload) {
    const res = await apiClient.post('/academic/rollover-session', payload);
    await refreshCloudData();
    return res;
  },

  // Direct Messages
  async getDirectMessages() {
    return await apiClient.get('/messages');
  },
  async addDirectMessage(data) {
    const res = await apiClient.post('/messages', data);
    notifyChange('direct_messages');
    return res;
  },

  // Staff Leaves
  async getStaffLeaves(teacherId) {
    const url = teacherId ? `/staff-leaves?teacherId=${encodeURIComponent(teacherId)}` : '/staff-leaves';
    return await apiClient.get(url);
  },
  async addStaffLeave(data) {
    const res = await apiClient.post('/staff-leaves', data);
    notifyChange('staff_leaves');
    return res;
  },

  // Help Tickets
  async getHelpTickets() {
    return await apiClient.get('/help-tickets');
  },
  async addHelpTicket(data) {
    const res = await apiClient.post('/help-tickets', data);
    notifyChange('help_tickets');
    return res;
  },
  async addHelpTicketReply(ticketId, message) {
    const res = await apiClient.post(`/help-tickets/${ticketId}/reply`, { message });
    notifyChange('help_tickets');
    return res;
  }
};

export const schoolData = {
  getTeachers: () => schoolStore.getTeachers(),
  getTeacherById: (id) => schoolStore.getTeacherById(id),
  assignTeacherClass: (id, payload) => schoolStore.assignTeacherClass(id, payload),
  removeTeacherClass: (id, payload) => schoolStore.removeTeacherClass(id, payload),
  assignClassTeacher: (className, teacherId) => schoolStore.assignClassTeacher(className, teacherId),
  setTeacherClassTeacherOf: (teacherId, classes) => schoolStore.setTeacherClassTeacherOf(teacherId, classes)
};
