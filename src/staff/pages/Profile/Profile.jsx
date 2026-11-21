import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { ProfileAvatar } from '../../../shared/components/ProfileAvatar/ProfileAvatar';
import {
  GraduationCap,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Upload,
  Download,
  Camera
} from 'lucide-react';
import {
  schoolStore,
  SCHOOL_CLASSES,
  TIMETABLE_DAYS,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';
import { uploadSchoolFile, downloadSchoolFile } from '../../../shared/lib/storageService';

export function StaffProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [sharedResources, setSharedResources] = useState([]);
  const [subjectNames, setSubjectNames] = useState([]);
  const [toast, setToast] = useState(null);

  const [staffData, setStaffData] = useState({
    id: '',
    staffId: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    startDate: '',
    position: 'Subject Teacher',
    avatarUrl: '',
    qualifications: [],
    emergencyContact: {
      name: '',
      relationship: '',
      phone: ''
    },
    department: 'Academic Staff'
  });
  const avatarInputRef = useRef(null);

  const [assignedClasses, setAssignedClasses] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);

  const loadLeaves = async (teacherId) => {
    try {
      const res = await schoolStore.getStaffLeaves(teacherId);
      if (Array.isArray(res)) setLeaveRequests(res);
    } catch {}
  };

  const [newLeave, setNewLeave] = useState({
    type: 'Casual Leave',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const [newResource, setNewResource] = useState({
    title: '',
    subject: 'Mathematics',
    class: 'SSS 1',
    format: 'PDF Document',
    fileName: '',
    fileSize: '',
    fileObj: null
  });

  const [newAvailability, setNewAvailability] = useState({
    day: 'Monday',
    startTime: '14:30',
    endTime: '15:30',
    note: ''
  });

  const refreshProfileStores = async () => {
    const savedUser = JSON.parse(localStorage.getItem('alamin_user') || '{}');
    try {
      const teacher = await schoolStore.fetchCurrentTeacher();
      const [availability, resources, allocationStudents, subjects] = await Promise.all([
        schoolStore.fetchAvailability(),
        schoolStore.fetchResources(),
        Promise.all((teacher.assignedClasses || []).map(async (assignment) => {
          const result = await schoolStore.fetchStudents({
            class: assignment.class,
            ...(assignment.subject ? { subject: assignment.subject } : {})
          });
          return Array.isArray(result) ? result : result?.data || [];
        })),
        schoolStore.fetchSubjects()
      ]);
      const resolvedName = teacher.name || savedUser.name || 'Teaching Staff';
      const resolvedId = teacher.id || savedUser.teacherId || savedUser.id || '';

      setStaffData({
        id: resolvedId,
        staffId: teacher.staffId || teacher.employeeId || savedUser.employeeId || 'Pending Assignment',
        name: resolvedName,
        email: teacher.email || savedUser.email || '',
        phone: teacher.phone || '',
        address: teacher.address || '',
        dateOfBirth: teacher.dateOfBirth || '',
        startDate: teacher.startDate || '',
        position: teacher.position || teacher.qualification || 'Subject Teacher',
        avatarUrl: teacher.avatarUrl || savedUser?.avatarUrl || '',
        qualifications: Array.isArray(teacher.qualifications)
          ? teacher.qualifications
          : teacher.qualification
          ? [teacher.qualification]
          : [],
        emergencyContact: teacher.emergencyContact || {
          name: '',
          relationship: '',
          phone: ''
        },
        department: teacher.department || 'Academic Faculty'
      });

      setAssignedClasses((teacher.assignedClasses || []).map((assignment, index) => ({
        class: assignment.class,
        subject: assignment.subject,
        sessions: 'Weekly Schedule',
        students: allocationStudents[index].length
      })));

      setAvailabilitySlots(
        (Array.isArray(availability) ? availability : []).filter(
          (slot) => slot.teacherName === resolvedName || (resolvedId && slot.teacherId === resolvedId)
        )
      );
      setSharedResources(Array.isArray(resources) ? resources : []);
      setSubjectNames(Array.isArray(subjects) ? subjects.map((subject) => subject.name) : []);
      if (resolvedId) {
        loadLeaves(resolvedId);
      }
    } catch (error) {
      console.error('Failed to load staff profile:', error);
      setStaffData((current) => ({ ...current, id: '', name: savedUser.name || 'Teaching Staff' }));
      setAssignedClasses([]);
      setAvailabilitySlots([]);
      setSharedResources([]);
      setSubjectNames([]);
    }
  };

  useEffect(() => {
    refreshProfileStores();
    return subscribeSchoolSync(refreshProfileStores);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Uploading profile picture...');
      const res = await schoolStore.uploadProfileAvatar(file);
      if (res?.avatarUrl) {
        setStaffData((prev) => ({ ...prev, avatarUrl: res.avatarUrl }));
        showToast('Profile picture updated successfully!');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to update profile picture.');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (staffData.id) {
      await schoolStore.updateTeacher(staffData.id, {
        name: staffData.name,
        email: staffData.email,
        phone: staffData.phone,
        address: staffData.address,
        dateOfBirth: staffData.dateOfBirth,
        startDate: staffData.startDate,
        position: staffData.position,
        qualifications: staffData.qualifications,
        emergencyContact: staffData.emergencyContact,
        department: staffData.department
      });
    }
    setIsEditing(false);
    showToast('Educator profile saved to database.');
  };

  const handleAddLeave = async (e) => {
    e.preventDefault();
    if (!newLeave.startDate || !newLeave.endDate || !newLeave.reason) return;
    const startMs = new Date(newLeave.startDate).getTime();
    const endMs = new Date(newLeave.endDate).getTime();
    const days = endMs >= startMs ? Math.max(1, Math.round((endMs - startMs) / 86400000) + 1) : 1;
    try {
      const created = await schoolStore.addStaffLeave({
        teacherId: staffData.id || '',
        teacherName: staffData.name || 'Staff',
        type: newLeave.type,
        startDate: newLeave.startDate,
        endDate: newLeave.endDate,
        days,
        reason: newLeave.reason,
        status: 'pending',
        submittedDate: new Date().toISOString().split('T')[0]
      });
      setLeaveRequests((prev) => [created, ...prev]);
      setShowLeaveModal(false);
      setNewLeave({ type: 'Casual Leave', startDate: '', endDate: '', reason: '' });
      showToast('Academic leave request submitted and saved to database.');
    } catch (err) {
      showToast(err?.message || 'Failed to submit leave request.');
    }
  };

  const handleAddResource = async (e) => {
    e.preventDefault();
    if (!newResource.title || !newResource.fileName) {
      showToast('Please enter a title and attach a resource file.');
      return;
    }

    const uploaded = newResource.fileObj
      ? await uploadSchoolFile('resources', newResource.fileObj)
      : { fileName: newResource.fileName, fileSize: newResource.fileSize || '1.1 MB', filePath: '', fileUrl: '' };

    schoolStore.addResource({
      title: newResource.title,
      type: 'document',
      subject: newResource.subject,
      description: `${newResource.format} shared by ${staffData.name || 'Teaching Staff'}`,
      classes: [newResource.class],
      accessLevel: 'students',
      fileName: uploaded.fileName,
      fileSize: uploaded.fileSize || newResource.fileSize || '1.1 MB',
      filePath: uploaded.filePath,
      fileUrl: uploaded.fileUrl,
      uploadedBy: staffData.name || 'Teaching Staff'
    });
    refreshProfileStores();
    setShowResourceModal(false);
    setNewResource({
      title: '',
      subject: 'Mathematics',
      class: 'SSS 1',
      format: 'PDF Document',
      fileName: '',
      fileSize: '',
      fileObj: null
    });
    showToast('Teaching resource uploaded and shared with students.');
  };

  const handleAddAvailability = (e) => {
    e.preventDefault();
    if (!newAvailability.startTime || !newAvailability.endTime) return;
    schoolStore.addTeacherAvailabilitySlot({
      teacherId: staffData.id || '',
      teacherName: staffData.name || 'Teaching Staff',
      day: newAvailability.day,
      startTime: newAvailability.startTime,
      endTime: newAvailability.endTime,
      note: newAvailability.note.trim() || 'Student academic consultation'
    });
    refreshProfileStores();
    setShowAvailabilityModal(false);
    setNewAvailability({ day: 'Monday', startTime: '14:30', endTime: '15:30', note: '' });
    showToast('Consultation availability slot published to Student Bookings.');
  };

  const handleToggleAvailability = (id) => {
    schoolStore.toggleTeacherAvailabilitySlot(id);
    refreshProfileStores();
  };

  const handleDeleteAvailability = async (id) => {
    try {
      await schoolStore.deleteTeacherAvailabilitySlot(id);
      await refreshProfileStores();
      showToast('Availability slot removed.');
    } catch (error) {
      console.error('Failed to delete availability slot:', error);
      showToast('Unable to remove availability slot.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif]">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            My Educator Profile
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Manage your educator credentials, consultation availability, teaching allocations, and lesson resources
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <div className="flex gap-2">
              <Button onClick={() => setIsEditing(false)} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleSaveProfile}>
                Save Changes
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      <div className="flex border-b border-[#c9c7b6]/60 gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-[#616218] text-[#494900]'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          Bio & Qualifications
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('availability')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'availability'
              ? 'border-[#616218] text-[#494900]'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          Consultation Availability
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('allocations')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'allocations'
              ? 'border-[#616218] text-[#494900]'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          Assigned Classes & Subjects
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('resources')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'resources'
              ? 'border-[#616218] text-[#494900]'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          Teaching Resources
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('leave')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'leave'
              ? 'border-[#616218] text-[#494900]'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          Academic Leave & Permissions
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="p-5 rounded-lg border border-[#c9c7b6] bg-white shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-[#c9c7b6]/40">
              <div className="relative group shrink-0">
                <ProfileAvatar src={staffData.avatarUrl} name={staffData.name} size="xl" shape="rounded" />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Update profile picture"
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#616218] hover:bg-[#494900] text-white rounded-full flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-105"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[#1c1c14]">{staffData.name}</h2>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#f0ebd5] text-[#494900] border border-[#c9c7b6]">
                    {staffData.staffId || 'Pending Assignment'}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    Active Teaching Staff
                  </span>
                </div>
                <p className="text-xs text-[#797869]">{staffData.position}</p>
                <p className="text-xs text-[#494900] font-medium">{staffData.department} • Al-Amin Group of Schools</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-xs">
              <div className="space-y-3">
                <h3 className="font-bold text-[#1c1c14] uppercase tracking-wider text-[11px]">
                  Institutional Information
                </h3>
                <div className="space-y-2.5">
                  <div>
                    <label className="text-xs font-semibold text-[#1c1c14] block mb-1">Email</label>
                    <input
                      disabled={!isEditing}
                      value={staffData.email}
                      onChange={(e) => setStaffData({ ...staffData, email: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#1c1c14] block mb-1">Phone Number</label>
                    <input
                      disabled={!isEditing}
                      value={staffData.phone}
                      onChange={(e) => setStaffData({ ...staffData, phone: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#1c1c14] block mb-1">Residential Address</label>
                    <input
                      disabled={!isEditing}
                      value={staffData.address}
                      onChange={(e) => setStaffData({ ...staffData, address: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-[#1c1c14] uppercase tracking-wider text-[11px]">
                  Emergency Contact
                </h3>
                <div className="space-y-2.5">
                  <div>
                    <label className="text-xs font-semibold text-[#1c1c14] block mb-1">Contact Name</label>
                    <input
                      disabled={!isEditing}
                      value={staffData.emergencyContact.name}
                      onChange={(e) =>
                        setStaffData({
                          ...staffData,
                          emergencyContact: { ...staffData.emergencyContact, name: e.target.value }
                        })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#1c1c14] block mb-1">Relationship</label>
                    <input
                      disabled={!isEditing}
                      value={staffData.emergencyContact.relationship}
                      onChange={(e) =>
                        setStaffData({
                          ...staffData,
                          emergencyContact: { ...staffData.emergencyContact, relationship: e.target.value }
                        })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#1c1c14] block mb-1">Emergency Phone</label>
                    <input
                      disabled={!isEditing}
                      value={staffData.emergencyContact.phone}
                      onChange={(e) =>
                        setStaffData({
                          ...staffData,
                          emergencyContact: { ...staffData.emergencyContact, phone: e.target.value }
                        })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#c9c7b6]/40">
              <h3 className="font-bold text-[#1c1c14] uppercase tracking-wider text-[11px] mb-3">
                Academic Degrees & TRCN Certifications
              </h3>
              <div className="space-y-2">
                {staffData.qualifications.length === 0 ? (
                  <div className="p-3 rounded-lg border border-dashed border-[#c9c7b6] text-xs text-[#797869]">
                    No academic certifications recorded on file yet.
                  </div>
                ) : (
                  staffData.qualifications.map((q, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 p-3 rounded-lg border border-[#c9c7b6]/50 bg-[#fdf9ec]"
                    >
                      <GraduationCap className="w-4 h-4 text-[#616218] shrink-0" />
                      <span className="text-xs text-[#1c1c14] font-medium">{q}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'allocations' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-[#616218]/20 bg-[#fdf9ec]">
            <h3 className="text-xs font-bold text-[#494900] uppercase tracking-wider">
              Teaching Scope & Allocations
            </h3>
            <p className="text-xs text-[#797869] mt-0.5">
              Teachers can be assigned to multiple classes and subjects across JSS 1 to SSS 3.
            </p>
          </div>

          {assignedClasses.length === 0 ? (
            <div className="p-8 rounded-lg border border-[#c9c7b6] bg-white text-center text-xs text-[#797869]">
              No class & subject allocations assigned to this profile yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedClasses.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-[#c9c7b6] bg-white shadow-xs hover:border-[#616218] transition-colors"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#c9c7b6]/40">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#616218] text-white">
                      {item.class}
                    </span>
                    <span className="text-xs font-bold text-[#494900]">{item.subject}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#797869] block text-[11px]">Workload</span>
                      <span className="font-semibold text-[#1c1c14]">{item.sessions}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block text-[11px]">Enrolled Students</span>
                      <span className="font-semibold text-[#1c1c14]">{item.students} students</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'availability' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-[#c9c7b6] bg-[#faf8f0]">
            <div>
              <h3 className="text-sm font-bold text-[#1c1c14]">Weekly Consultation Hours</h3>
              <p className="text-xs text-[#797869]">
                Slots configured here appear directly under Teacher Availability in Student Bookings.
              </p>
            </div>
            <Button onClick={() => setShowAvailabilityModal(true)} icon={<Plus className="w-4 h-4" />}>
              Add Availability Slot
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availabilitySlots.length > 0 ? (
              availabilitySlots.map((slot) => (
                <div
                  key={slot.id}
                  className="p-4 rounded-lg border border-[#c9c7b6] bg-white shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-[#faf8f0] border border-[#c9c7b6] text-xs font-bold text-[#494900]">
                        {slot.day}
                      </span>
                      <span className="text-xs font-bold text-[#1c1c14] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#616218]" />
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </div>
                    <p className="text-xs text-[#797869]">{slot.note}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(slot.id)}
                      className={`h-9 px-3 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                        slot.isAvailable
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {slot.isAvailable ? 'Active' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAvailability(slot.id)}
                      className="h-9 w-9 rounded-lg border border-[#c9c7b6] bg-white hover:bg-rose-50 hover:text-rose-700 text-[#44443b] inline-flex items-center justify-center cursor-pointer"
                      title="Delete Slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="md:col-span-2 p-8 rounded-lg border border-[#c9c7b6] bg-white text-center text-xs text-[#797869]">
                No consultation slots added yet. Add your weekly hours so students can book academic help.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'resources' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#1c1c14]">Lesson Materials & Syllabus Notes</h3>
              <p className="text-xs text-[#797869]">Teaching materials shared with Al-Amin secondary students</p>
            </div>
            <Button
              onClick={() => setShowResourceModal(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Upload Material
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sharedResources.map((res) => (
              <div key={res.id} className="p-4 rounded-lg border border-[#c9c7b6] bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f0ebd5] text-[#494900]">
                      {(res.classes || ['All Classes']).join(', ')}
                    </span>
                    <span className="text-[11px] font-semibold text-[#616218]">
                      {res.subject}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadSchoolFile({
                        fileUrl: res.fileUrl,
                        fileName: res.fileName || `${res.title}.txt`,
                        fallbackContent: `${res.title}\nSubject: ${res.subject}\n${res.description || ''}`
                      })
                    }
                    className="p-1.5 rounded-md hover:bg-[#faf8f0] text-[#616218] cursor-pointer"
                    title="Download Material"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
                <h4 className="text-xs font-bold text-[#1c1c14] line-clamp-2">{res.title}</h4>
                <div className="flex items-center justify-between text-[11px] text-[#797869] pt-2 border-t border-[#c9c7b6]/30">
                  <span className="truncate">{res.fileName || res.type}</span>
                  <span>{res.fileSize || '1.0 MB'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'leave' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#1c1c14]">Academic Leave & Excuses</h3>
              <p className="text-xs text-[#797869]">Submit leave requests directly to the Principal's office</p>
            </div>
            <Button
              onClick={() => setShowLeaveModal(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Request Leave</span>
            </Button>
          </div>

          <div className="space-y-3">
            {leaveRequests.length === 0 ? (
              <div className="p-8 rounded-lg border border-[#c9c7b6] bg-white text-center text-xs text-[#797869]">
                No leave requests submitted yet.
              </div>
            ) : (
              leaveRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-lg border border-[#c9c7b6] bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#1c1c14]">{req.reason}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          req.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {req.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-[#797869] mt-0.5">
                      {req.type} · {req.startDate} to {req.endDate} · {req.days} day{req.days === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="text-xs text-[#48482d] font-medium">
                    Status: {req.approvedBy}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="Submit Academic Leave Request"
        subtitle="Send leave notification for Principal review"
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setShowLeaveModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="teacher-leave-form">
              Submit Request
            </Button>
          </>
        }
      >
        <form id="teacher-leave-form" onSubmit={handleAddLeave} className="space-y-5 font-['Poppins',sans-serif]">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14]">Leave Category</label>
            <select
              value={newLeave.type}
              onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              <option value="Casual Leave">Casual Leave</option>
              <option value="Medical / Sick Leave">Medical / Sick Leave</option>
              <option value="Conference / Workshop">Academic Conference / Workshop</option>
              <option value="Compassionate Leave">Compassionate Leave</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]">Start Date</label>
              <input
                type="date"
                required
                value={newLeave.startDate}
                onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]">End Date</label>
              <input
                type="date"
                required
                value={newLeave.endDate}
                onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14]">Purpose / Reason</label>
            <textarea
              required
              rows={4}
              value={newLeave.reason}
              onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
              placeholder="Provide reason for absence..."
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showResourceModal}
        onClose={() => setShowResourceModal(false)}
        title="Upload Teaching Resource"
        subtitle="Share lesson guides and past questions with classes"
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setShowResourceModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="teacher-resource-form">
              Upload Material
            </Button>
          </>
        }
      >
        <form id="teacher-resource-form" onSubmit={handleAddResource} className="space-y-4 font-['Poppins',sans-serif]">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Resource File *</label>
            <label className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-[#c9c7b6] bg-[#faf8f0] hover:bg-[#f4f2e1] cursor-pointer transition-colors">
              <Upload className="w-5 h-5 text-[#616218] mb-1.5" />
              <span className="text-xs font-semibold text-[#1c1c14]">
                {newResource.fileName ? newResource.fileName : 'Click to attach resource file'}
              </span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const sizeLabel =
                    file.size < 1024 * 1024
                      ? `${(file.size / 1024).toFixed(1)} KB`
                      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
                  setNewResource((prev) => ({
                    ...prev,
                    fileName: file.name,
                    fileSize: sizeLabel,
                    fileObj: file,
                    title: prev.title || file.name.replace(/\.[^/.]+$/, '')
                  }));
                }}
              />
            </label>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14]">Material Title *</label>
            <input
              required
              value={newResource.title}
              onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
              placeholder="SSS 2 Physics Light & Optics Notes"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]">Subject</label>
              <select
                value={newResource.subject}
                onChange={(e) => setNewResource({ ...newResource, subject: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm"
              >
                {subjectNames.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]">Target Class</label>
              <select
                value={newResource.class}
                onChange={(e) => setNewResource({ ...newResource, class: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm"
              >
                <option value="All Classes">All Classes</option>
                {SCHOOL_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showAvailabilityModal}
        onClose={() => setShowAvailabilityModal(false)}
        title="Add Consultation Availability"
        subtitle="Publish office hours for student consultation bookings"
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setShowAvailabilityModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="teacher-availability-form">
              Save Slot
            </Button>
          </>
        }
      >
        <form id="teacher-availability-form" onSubmit={handleAddAvailability} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Weekday</label>
            <select
              value={newAvailability.day}
              onChange={(e) => setNewAvailability({ ...newAvailability, day: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14]"
            >
              {TIMETABLE_DAYS.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Start Time</label>
              <input
                type="time"
                required
                value={newAvailability.startTime}
                onChange={(e) => setNewAvailability({ ...newAvailability, startTime: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">End Time</label>
              <input
                type="time"
                required
                value={newAvailability.endTime}
                onChange={(e) => setNewAvailability({ ...newAvailability, endTime: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Consultation Topic / Note</label>
            <input
              type="text"
              value={newAvailability.note}
              onChange={(e) => setNewAvailability({ ...newAvailability, note: e.target.value })}
              placeholder="e.g. Mathematics & Physics Clinic"
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14]"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default StaffProfile;
