import { apiClient } from './apiClient';

export async function submitPublicEnquiry(kind, payload) {
  return apiClient.post('/enquiries', {
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
    message: payload.message || ''
  });
}
