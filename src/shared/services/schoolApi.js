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
      category: isSeniorClass(name) ? 'Senior' : 'Junior'
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
  async assignTeacherClass(teacherId, classSubject) {
    const res = await apiClient.post(`/teachers/${teacherId}/assign-class`, classSubject);
    if (res?.teacher) {
      state.teachers = (state.teachers || []).map((t) => (t.id === teacherId ? res.teacher : t));
      notifyChange('teachers');
    }
    return res;
  },
  async removeTeacherClass(teacherId, classSubject) {
    const res = await apiClient.delete(`/teachers/${teacherId}/assign-class?classSubject=${encodeURIComponent(classSubject)}`);
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
  async rescheduleTeacherSlot(payload) {
    const res = await apiClient.post('/timetable/reschedule', payload);
    await refreshCloudData();
    return res;
  },

  // Attendance
  getAttendance() {
    return state.attendance || {};
  },
  getAttendanceForDateAndClass(date, className) {
    const att = state.attendance || {};
    return (att[date] && att[date][className]) || [];
  },
  getStudentAttendanceHistory(studentId) {
    const history = [];
    const att = state.attendance || {};
    Object.keys(att).forEach((d) => {
      Object.keys(att[d]).forEach((cls) => {
        const records = att[d][cls] || [];
        const found = records.find((r) => r.studentId === studentId);
        if (found) {
          history.push({ date: d, class: cls, ...found });
        }
      });
    });
    return history.sort((a, b) => (a.date > b.date ? -1 : 1));
  },
  async saveAttendance({ date, class: className, records }) {
    const res = await apiClient.post('/attendance', { date, class: className, records });
    if (!state.attendance[date]) state.attendance[date] = {};
    state.attendance[date][className] = records;
    notifyChange('attendance');
    return res;
  },

  // Grades & Reports
  getGrades() {
    return state.grades || {};
  },
  getStudentSubjectGrade(studentId, subjectId) {
    return (state.grades && state.grades[studentId] && state.grades[studentId][subjectId]) || null;
  },
  async getStudentReportCard(studentId, term = 'Term1', session = '2026/2027') {
    try {
      return await apiClient.get(`/reports/${studentId}?term=${encodeURIComponent(term)}&session=${encodeURIComponent(session)}`);
    } catch {
      return null;
    }
  },
  async saveGrade(payload) {
    const res = await apiClient.post('/grades', payload);
    const { studentId, subjectId, gradeData } = payload;
    if (!state.grades[studentId]) state.grades[studentId] = {};
    state.grades[studentId][subjectId] = gradeData;
    notifyChange('grades');
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
  getResourcesForUser(user) {
    return state.resources || [];
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
  getTeacherAvailabilityByDay(teacherId, day) {
    return (state.availability || []).filter((a) => a.teacherId === teacherId && a.day === day);
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
    const res = await apiClient.request('/auth/profile/avatar', {
      method: 'POST',
      body: formData
    });
    if (res?.user) {
      try {
        const current = JSON.parse(localStorage.getItem('alamin_user') || '{}');
        localStorage.setItem('alamin_user', JSON.stringify({ ...current, ...res.user }));
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
  }
};

export const schoolData = {
  getTeachers: () => schoolStore.getTeachers(),
  getTeacherById: (id) => schoolStore.getTeacherById(id),
  assignTeacherClass: (id, payload) => schoolStore.assignTeacherClass(id, payload),
  removeTeacherClass: (id, payload) => schoolStore.removeTeacherClass(id, payload)
};
