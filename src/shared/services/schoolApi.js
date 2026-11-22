import { apiClient } from '../lib/apiClient';
import {
  SSS_DEPARTMENTS,
  ACADEMIC_SESSIONS,
  TIMETABLE_DAYS,
  computeGrade,
  getClassCode,
  generateAdmissionNumber
} from '../constants/academic';

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

export function initializeSchoolSync() {
  if (typeof window === 'undefined') return () => {};

  let eventSource = null;
  const connectSSE = () => {
    const token = apiClient.getToken();
    if (!token) {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      return;
    }
    if (eventSource) return;

    try {
      const url = apiClient.resolveUrl(`/events?token=${encodeURIComponent(token)}`);
      eventSource = new EventSource(url);
      eventSource.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data || '{}');
          if (parsed.action === 'connected') return;
          notifyChange(parsed.resource || 'all');
        } catch {}
      };
      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      };
    } catch {}
  };

  connectSSE();

  const unbindAuth = apiClient.onAuthChange(({ authenticated }) => {
    if (authenticated) {
      connectSSE();
      notifyChange('auth');
    } else {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      notifyChange('logout');
    }
  });

  return () => {
    unbindAuth();
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

export const schoolStore = {
  async fetchAdminDashboardSummary() {
    return await apiClient.get('/dashboard/admin');
  },
  async fetchStaffDashboardSummary() {
    return await apiClient.get('/dashboard/staff');
  },

  // Classes
  async fetchClasses() {
    return await apiClient.get('/classes');
  },
  async fetchClassOverviewSummary() {
    return await apiClient.get('/classes/summary');
  },
  async addClass(classData) {
    const res = await apiClient.post('/classes', classData);
    if (res && !res.error) notifyChange('classes');
    return res;
  },
  async deleteClass(id) {
    const res = await apiClient.delete(`/classes/${id}`);
    notifyChange('classes');
    return res;
  },
  async assignClassTeacher(className, teacherId) {
    const res = await apiClient.post(`/classes/${encodeURIComponent(className)}/class-teacher`, { teacherId });
    if (res && !res.error) {
      notifyChange('classes');
      notifyChange('teachers');
    }
    return res;
  },
  async setTeacherClassTeacherOf(teacherId, classes) {
    const res = await apiClient.post(`/teachers/${teacherId}/class-teacher-of`, { classes });
    if (res && !res.error) {
      notifyChange('teachers');
      notifyChange('classes');
    }
    return res;
  },

  // Subjects
  async fetchSubjects(params = {}) {
    const query = new URLSearchParams();
    if (params.class) query.set('class', String(params.class));
    if (params.department) query.set('department', String(params.department));
    const qs = query.toString();
    return await apiClient.get(`/subjects${qs ? `?${qs}` : ''}`);
  },
  async addSubject(subject) {
    const res = await apiClient.post('/subjects', subject);
    if (res && !res.error) notifyChange('subjects');
    return res;
  },
  async updateSubject(id, data) {
    const res = await apiClient.put(`/subjects/${id}`, data);
    if (res && !res.error) notifyChange('subjects');
    return res;
  },
  async deleteSubject(id) {
    const res = await apiClient.delete(`/subjects/${id}`);
    notifyChange('subjects');
    return res;
  },

  // Students
  async fetchStudents(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', String(params.search));
    if (params.class && params.class !== 'all') query.set('class', String(params.class));
    if (params.subject && params.subject !== 'all') query.set('subject', String(params.subject));
    if (params.department && params.department !== 'all') query.set('department', String(params.department));
    if (params.status && params.status !== 'all') query.set('status', String(params.status));
    const qs = query.toString();
    return await apiClient.get(`/students${qs ? `?${qs}` : ''}`);
  },
  async fetchCurrentStudent() {
    const students = await apiClient.get('/students');
    if (!Array.isArray(students)) {
      throw new Error('Unexpected response while loading the current student.');
    }
    return students[0] || null;
  },
  async fetchStudentById(id) {
    return await apiClient.get(`/students/${id}`);
  },
  async createStudentAsync(studentData) {
    const res = await apiClient.post('/students', studentData);
    if (res && !res.error) notifyChange('students');
    return res;
  },
  async updateStudent(id, data) {
    const res = await apiClient.put(`/students/${id}`, data);
    if (res && !res.error) notifyChange('students');
    return res;
  },
  async deleteStudent(id) {
    const res = await apiClient.delete(`/students/${id}`);
    notifyChange('students');
    return res;
  },
  async resetStudentCredentials(studentId, payload) {
    return await apiClient.post(`/students/${studentId}/credentials`, payload);
  },
  async addStudentToClassSubject(studentId, subject) {
    const res = await apiClient.post(`/students/${studentId}/enroll-subject`, { subject });
    if (res && !res.error) notifyChange('students');
    return res;
  },
  async enrollStudentSubject(studentId, subject) {
    return this.addStudentToClassSubject(studentId, subject);
  },

  // Teachers
  async fetchTeachers(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', String(params.search));
    if (params.class && params.class !== 'all') query.set('class', String(params.class));
    if (params.subject && params.subject !== 'all') query.set('subject', String(params.subject));
    if (params.status && params.status !== 'all') query.set('status', String(params.status));
    const qs = query.toString();
    return await apiClient.get(`/teachers${qs ? `?${qs}` : ''}`);
  },
  async fetchCurrentTeacher() {
    return await apiClient.get('/teachers/me');
  },
  async fetchTeacherById(id) {
    return await apiClient.get(`/teachers/${encodeURIComponent(id)}`);
  },
  async createTeacherAsync(teacherData) {
    const res = await apiClient.post('/teachers', teacherData);
    if (res && !res.error) notifyChange('teachers');
    return res;
  },
  async updateTeacher(id, data) {
    const res = await apiClient.put(`/teachers/${id}`, data);
    if (res && !res.error) notifyChange('teachers');
    return res;
  },
  async deleteTeacher(id) {
    const res = await apiClient.delete(`/teachers/${id}`);
    notifyChange('teachers');
    return res;
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
    if (res && !res.error) notifyChange('teachers');
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

    const query = `class=${encodeURIComponent(cls)}&subject=${encodeURIComponent(sub)}`;
    const res = await apiClient.delete(`/teachers/${teacherId}/assign-class?${query}`, {
      class: cls,
      subject: sub
    });
    if (res && !res.error) notifyChange('teachers');
    return res;
  },

  // Timetable
  async fetchTimetable(className) {
    const qs = className ? `?class=${encodeURIComponent(className)}` : '';
    return await apiClient.get(`/timetable${qs}`);
  },
  async addTimetableSlot(slot) {
    const res = await apiClient.post('/timetable', slot);
    if (res && !res.error) notifyChange('timetable');
    return res;
  },
  async updateTimetableSlot(id, slot) {
    const res = await apiClient.put(`/timetable/${id}`, slot);
    if (res && !res.error) notifyChange('timetable');
    return res;
  },
  async deleteTimetableSlot(id) {
    const res = await apiClient.delete(`/timetable/${id}`);
    if (res && !res.error) notifyChange('timetable');
    return res;
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
    if (res && !res.error) notifyChange('timetable');
    return res;
  },

  // Attendance
  async fetchAttendanceSummary(date) {
    const query = new URLSearchParams({ date });
    return await apiClient.get(`/attendance/summary?${query.toString()}`);
  },
  async fetchAttendance(params = {}) {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.class) query.set('class', params.class);
    const qs = query.toString();
    return await apiClient.get(`/attendance${qs ? `?${qs}` : ''}`);
  },
  async fetchStudentAttendanceHistory(studentId) {
    try {
      return await apiClient.get(`/attendance/student/${studentId}`);
    } catch {
      return null;
    }
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
    if (res && !res.error) notifyChange('attendance');
    return res;
  },

  // Grades & Reports
  async fetchGrades() {
    return await apiClient.get('/grades');
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

    const res = await apiClient.post('/grades', payload);
    if (res && !res.error) notifyChange('grades');
    return res;
  },

  // Announcements
  async fetchAnnouncements(params = {}) {
    const query = new URLSearchParams();
    if (params.page != null) query.set('page', String(params.page));
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.search) query.set('search', String(params.search));
    if (params.type && params.type !== 'all') query.set('type', String(params.type));
    if (params.audience && params.audience !== 'all') query.set('audience', String(params.audience));
    if (params.scope && params.scope !== 'all') query.set('scope', String(params.scope));
    const qs = query.toString();
    return await apiClient.get(`/announcements${qs ? `?${qs}` : ''}`);
  },
  async addAnnouncement(data) {
    const res = await apiClient.post('/announcements', data);
    if (res && !res.error) notifyChange('announcements');
    return res;
  },
  async updateAnnouncement(id, data) {
    const res = await apiClient.put(`/announcements/${id}`, data);
    if (res && !res.error) notifyChange('announcements');
    return res;
  },
  async deleteAnnouncement(id) {
    const res = await apiClient.delete(`/announcements/${id}`);
    notifyChange('announcements');
    return res;
  },

  // Assignments
  async fetchAssignments(params = {}) {
    const query = new URLSearchParams();
    if (params.page != null) query.set('page', String(params.page));
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.search) query.set('search', String(params.search));
    if (params.class && params.class !== 'all') query.set('class', String(params.class));
    if (params.subject && params.subject !== 'all') query.set('subject', String(params.subject));
    const qs = query.toString();
    return await apiClient.get(`/assignments${qs ? `?${qs}` : ''}`);
  },
  async addAssignment(data) {
    const res = await apiClient.post('/assignments', data);
    if (res && !res.error) notifyChange('assignments');
    return res;
  },
  async updateAssignment(id, data) {
    const res = await apiClient.put(`/assignments/${id}`, data);
    if (res && !res.error) notifyChange('assignments');
    return res;
  },
  async deleteAssignment(id) {
    const res = await apiClient.delete(`/assignments/${id}`);
    notifyChange('assignments');
    return res;
  },
  async submitStudentAssignment(assignmentId, submission) {
    const res = await apiClient.post(`/assignments/${assignmentId}/submit`, submission);
    notifyChange('assignments');
    return res;
  },

  // Resources
  async fetchResources(params = {}) {
    const query = new URLSearchParams();
    if (params.page != null) query.set('page', String(params.page));
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.search) query.set('search', String(params.search));
    if (params.subject && params.subject !== 'all') query.set('subject', String(params.subject));
    if (params.type && params.type !== 'all') query.set('type', String(params.type));
    if (params.class && params.class !== 'all') query.set('class', String(params.class));
    const qs = query.toString();
    return await apiClient.get(`/resources${qs ? `?${qs}` : ''}`);
  },
  async addResource(data) {
    const res = await apiClient.post('/resources', data);
    if (res && !res.error) notifyChange('resources');
    return res;
  },
  async deleteResource(id) {
    const res = await apiClient.delete(`/resources/${id}`);
    notifyChange('resources');
    return res;
  },

  // Documents
  async fetchDocuments(params = {}) {
    const query = new URLSearchParams();
    if (params.page != null) query.set('page', String(params.page));
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.search) query.set('search', String(params.search));
    if (params.category && params.category !== 'all') query.set('category', String(params.category));
    if (params.access && params.access !== 'all') query.set('access', String(params.access));
    const qs = query.toString();
    return await apiClient.get(`/documents${qs ? `?${qs}` : ''}`);
  },
  async addDocument(data) {
    const res = await apiClient.post('/documents', data);
    if (res && !res.error) notifyChange('documents');
    return res;
  },
  async updateDocumentAccess(id, access) {
    const res = await apiClient.patch(`/documents/${id}/access`, { access });
    if (res && !res.error) notifyChange('documents');
    return res;
  },
  async deleteDocument(id) {
    const res = await apiClient.delete(`/documents/${id}`);
    notifyChange('documents');
    return res;
  },

  // Equipment & Maintenance
  async fetchEquipment(params = {}) {
    const query = new URLSearchParams();
    if (params.page != null) query.set('page', String(params.page));
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.search) query.set('search', String(params.search));
    const qs = query.toString();
    return await apiClient.get(`/equipment${qs ? `?${qs}` : ''}`);
  },
  async addEquipment(data) {
    const res = await apiClient.post('/equipment', data);
    if (res && !res.error) notifyChange('equipment');
    return res;
  },
  async deleteEquipment(id) {
    const res = await apiClient.delete(`/equipment/${id}`);
    notifyChange('equipment');
    return res;
  },
  async fetchMaintenance(params = {}) {
    const query = new URLSearchParams();
    if (params.page != null) query.set('page', String(params.page));
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.search) query.set('search', String(params.search));
    const qs = query.toString();
    return await apiClient.get(`/maintenance${qs ? `?${qs}` : ''}`);
  },
  async addMaintenance(data) {
    const res = await apiClient.post('/maintenance', data);
    if (res && !res.error) notifyChange('maintenance');
    return res;
  },
  async updateMaintenanceStatus(id, status) {
    const res = await apiClient.patch(`/maintenance/${id}`, { status });
    if (res && !res.error) notifyChange('maintenance');
    return res;
  },

  // Requests
  async fetchRequests() {
    return await apiClient.get('/requests');
  },
  async addRequest(data) {
    const res = await apiClient.post('/requests', data);
    if (res && !res.error) notifyChange('requests');
    return res;
  },
  async updateRequestStatus(id, status) {
    const res = await apiClient.patch(`/requests/${id}/status`, { status });
    if (res && !res.error) notifyChange('requests');
    return res;
  },

  // Teacher Availability
  async fetchAvailability() {
    return await apiClient.get('/availability');
  },
  async addTeacherAvailabilitySlot(slot) {
    const res = await apiClient.post('/availability', slot);
    if (res && !res.error) notifyChange('availability');
    return res;
  },
  async toggleTeacherAvailabilitySlot(id) {
    const res = await apiClient.patch(`/availability/${id}/toggle`, {});
    if (res && !res.error) notifyChange('availability');
    return res;
  },
  async deleteTeacherAvailabilitySlot(id) {
    const res = await apiClient.delete(`/availability/${id}`);
    if (res && !res.error) notifyChange('availability');
    return res;
  },

  // Alerts
  async fetchAlerts() {
    return await apiClient.get('/alerts');
  },
  async dismissAlert(id) {
    const res = await apiClient.delete(`/alerts/${id}`);
    if (res && !res.error) notifyChange('alerts');
    return res;
  },

  // Auth & Profile
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
      notifyChange('users');
    }
    return res;
  },

  // Academic Promotion & Rollover
  async getPromotionCandidates() {
    const response = await apiClient.get('/academic/promotion-candidates');
    if (!Array.isArray(response?.candidates)) {
      throw new Error('Unexpected response while loading promotion candidates.');
    }
    return response.candidates;
  },
  async executeSessionRollover(payload) {
    const res = await apiClient.post('/academic/rollover-session', payload);
    notifyChange('students');
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
  assignTeacherClass: (id, payload) => schoolStore.assignTeacherClass(id, payload),
  removeTeacherClass: (id, payload) => schoolStore.removeTeacherClass(id, payload),
  assignClassTeacher: (className, teacherId) => schoolStore.assignClassTeacher(className, teacherId),
  setTeacherClassTeacherOf: (teacherId, classes) => schoolStore.setTeacherClassTeacherOf(teacherId, classes)
};
