import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  BookOpen,
  CalendarCheck,
  HelpCircle
} from 'lucide-react';
import { schoolStore, subscribeSchoolSync } from '../../../shared/data/schoolData';
import { Button } from '../../../shared/components/Button/Button';
import { Pagination } from '../../../shared/components/Pagination/Pagination';

export function StudentBookings() {
  const [activeTab, setActiveTab] = useState('bookings');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingError, setBookingError] = useState('');
  const [toast, setToast] = useState(null);
  const [requestsList, setRequestsList] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [activeStudent, setActiveStudent] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [studentSubjects, setStudentSubjects] = useState([]);
  const [, setSyncTick] = useState(0);

  const [newBooking, setNewBooking] = useState({
    subject: 'Mathematics',
    teacher: 'no-preference',
    date: '',
    time: '15:00',
    duration: '1',
    type: 'booking',
    reason: '',
    notes: '',
    priority: 'medium'
  });

  const loadRequests = async () => {
    try {
      const [student, list, teacherList, availability, subjects] = await Promise.all([
        schoolStore.fetchCurrentStudent(),
        schoolStore.fetchRequests(),
        schoolStore.fetchTeachers(),
        schoolStore.fetchAvailability(),
        schoolStore.fetchSubjects()
      ]);
      setActiveStudent(student);
      setRequestsList(Array.isArray(list) ? list : []);
      setTeachers(Array.isArray(teacherList) ? teacherList : teacherList?.data || []);
      setAvailabilitySlots(Array.isArray(availability) ? availability : []);
      setStudentSubjects(Array.isArray(subjects) ? subjects.map((subject) => subject.name || subject) : []);
      setSyncTick((t) => t + 1);
    } catch (error) {
      console.error('Failed to load student bookings:', error);
      setActiveStudent(null);
      setRequestsList([]);
      setTeachers([]);
      setAvailabilitySlots([]);
      setStudentSubjects([]);
    }
  };

  useEffect(() => {
    loadRequests();
    return subscribeSchoolSync(loadRequests);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleCreateBooking = (e) => {
    e?.preventDefault();
    if (!newBooking.subject || !newBooking.reason.trim()) {
      setBookingError('Please select a subject and describe the topic/reason for your session.');
      return;
    }
    setBookingError('');

    // Active logged-in student
    const currentUser = JSON.parse(localStorage.getItem('alamin_user') || '{}');
    const studentName = activeStudent?.name || currentUser.name || 'Student';
    const studentAdmission = activeStudent?.admissionNumber || currentUser.admissionNumber || 'Pending Assignment';
    const studentClass = activeStudent?.class || currentUser.class || '';

    const newReq = {
      studentId: activeStudent?.id || currentUser.id || '',
      studentName,
      admissionNumber: studentAdmission,
      class: studentClass,
      title: `${newBooking.type === 'booking' ? 'Consultation' : newBooking.type === 'makeup' ? 'Makeup Session' : 'Extra Tutorial'}: ${newBooking.subject}`,
      subject: newBooking.subject,
      requestType: newBooking.type,
      priority: newBooking.priority,
      preferredDate: newBooking.date || 'Flexible Date',
      preferredTime: newBooking.time || 'Flexible Time',
      duration: newBooking.duration === '1' ? '1 hour' : `${newBooking.duration} hours`,
      preferredTeacher: newBooking.teacher === 'no-preference' ? 'Any Assigned Teacher' : newBooking.teacher,
      message: newBooking.reason.trim()
    };

    schoolStore.addRequest(newReq);
    loadRequests();
    showToast('Your consultation request has been submitted to your subject teachers!');
    setActiveTab('bookings');

    setNewBooking({
      subject: 'Mathematics',
      teacher: 'no-preference',
      date: '',
      time: '15:00',
      duration: '1',
      type: 'booking',
      reason: '',
      notes: '',
      priority: 'medium'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Approved / Confirmed</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 shadow-xs">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Declined</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pending Review</span>
          </span>
        );
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'booking':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 shadow-xs">
            <CalendarCheck className="w-3 h-3 text-sky-600" />
            <span>Consultation</span>
          </span>
        );
      case 'makeup':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Makeup Session</span>
          </span>
        );
      case 'help':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
            <HelpCircle className="w-3 h-3 text-emerald-600" />
            <span>Extra Help</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-800 border border-stone-200 shadow-xs">
            <BookOpen className="w-3 h-3 text-stone-600" />
            <span>Tutorial</span>
          </span>
        );
    }
  };

  const pendingCount = requestsList.filter((r) => r.status === 'pending').length;
  const approvedCount = requestsList.filter((r) => r.status === 'approved' || r.status === 'completed').length;

  const paginatedRequests = requestsList.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getSelectedWeekday = (dateStr) => {
    if (!dateStr) return 'Monday';
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const selectedWeekday = getSelectedWeekday(selectedDate);
  const availableSlotsForDay = availabilitySlots.filter((slot) => slot.day === selectedWeekday);
  const studentSubjectOptions = studentSubjects;

  const handleRequestOpenSlot = (slot) => {
    setNewBooking((prev) => ({
      ...prev,
      teacher: slot.teacherName,
      subject: slot.subjects?.[0] || prev.subject,
      date: selectedDate,
      time: slot.startTime
    }));
    setActiveTab('book');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-12">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Book Extra Classes & Consultations
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Schedule academic coaching, makeup practical sessions, and teacher consultations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#faf8f0] text-[#494900] border border-[#c9c7b6] shadow-xs">
            <Clock className="w-3.5 h-3.5 text-[#616218]" />
            <span>{pendingCount} Pending Requests</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{approvedCount} Confirmed</span>
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-[#c9c7b6]/60 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'bookings'
              ? 'border-[#616218] text-[#494900] bg-[#faf8f0]/60'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          My Inquiries & Bookings
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('book')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'book'
              ? 'border-[#616218] text-[#494900] bg-[#faf8f0]/60'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          Request New Session
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('availability')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'availability'
              ? 'border-[#616218] text-[#494900] bg-[#faf8f0]/60'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          Teacher Availability
        </button>
      </div>

      {/* TAB 1: My Bookings */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          {requestsList.length === 0 ? (
            <div className="rounded-lg border border-[#c9c7b6] bg-white p-12 text-center shadow-xs">
              <Calendar className="w-12 h-12 text-[#c9c7b6] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#1c1c14]">No Consultation Bookings Yet</h3>
              <p className="text-xs text-[#797869] mt-1 max-w-md mx-auto">
                Need extra assistance with your WAEC, NECO, or term syllabus topics? Book a session with your subject teacher.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('book')}
                className="mt-4 h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Book Your First Session</span>
              </button>
            </div>
          ) : (
            <>
            {paginatedRequests.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs hover:border-[#616218]/50 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {getTypeBadge(item.requestType)}
                      <span className="text-xs font-bold text-[#616218] bg-[#faf8f0] px-2 py-0.5 rounded border border-[#c9c7b6]/60">
                        {item.subject}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    <h3 className="text-base font-bold text-[#1c1c14]">{item.title}</h3>
                  </div>

                  <div className="text-xs text-[#797869] shrink-0 sm:text-right">
                    <div>Preferred: <span className="font-semibold text-[#1c1c14]">{item.preferredDate || 'Flexible'}</span></div>
                    <div>Time: <span className="font-semibold text-[#1c1c14]">{item.preferredTime || 'After Class'}</span></div>
                  </div>
                </div>

                <div className="text-xs text-[#44443b] bg-[#faf8f0] p-3 rounded-lg border border-[#c9c7b6]/60">
                  <span className="font-bold text-[#1c1c14] block mb-0.5">Topic / Reason:</span>
                  <p>{item.message}</p>
                </div>

                {item.staffResponse && (
                  <div className="text-xs bg-emerald-50 text-emerald-900 p-3 rounded-lg border border-emerald-200">
                    <span className="font-bold block mb-0.5 text-emerald-800">Teacher Response:</span>
                    <p>{item.staffResponse}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#c9c7b6]/40 text-[11px] text-[#797869]">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      Student: <span className="font-semibold text-[#1c1c14]">{item.studentName}</span>
                    </div>
                    <div>
                      Admission No: <span className="font-mono font-semibold text-[#616218]">{item.admissionNumber}</span>
                    </div>
                  </div>
                  <div>
                    Submitted: {new Date(item.submittedDate || Date.now()).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
            ))
            }
            <Pagination
              currentPage={currentPage}
              totalItems={requestsList.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              itemLabel="inquiries"
            />
            </>
          )}
        </div>
      )}

      {/* TAB 2: Book Session */}
      {activeTab === 'book' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border border-[#c9c7b6] bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-[#1c1c14] mb-1">
              Submit Session Booking Request
            </h3>
            <p className="text-xs text-[#797869] mb-5">
              Fill out the details below. Your request will be routed directly to the designated teacher.
            </p>

            <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#1c1c14] block mb-1.5">Session Type *</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    value={newBooking.type}
                    onChange={(e) => setNewBooking({ ...newBooking, type: e.target.value })}
                  >
                    <option value="booking">Consultation / 1-on-1 Help</option>
                    <option value="makeup">Missed Practical / Makeup</option>
                    <option value="help">Extra Exam Prep Tutorial</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#1c1c14] block mb-1.5">Subject *</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    value={newBooking.subject}
                    onChange={(e) => setNewBooking({ ...newBooking, subject: e.target.value })}
                  >
                    {studentSubjectOptions.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#1c1c14] block mb-1.5">Preferred Teacher</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    value={newBooking.teacher}
                    onChange={(e) => setNewBooking({ ...newBooking, teacher: e.target.value })}
                  >
                    <option value="no-preference">Any Assigned Teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#1c1c14] block mb-1.5">Priority</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    value={newBooking.priority}
                    onChange={(e) => setNewBooking({ ...newBooking, priority: e.target.value })}
                  >
                    <option value="medium">Standard Priority</option>
                    <option value="high">Urgent</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#1c1c14] block mb-1.5">Preferred Date</label>
                  <input
                    type="date"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    value={newBooking.date}
                    onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#1c1c14] block mb-1.5">Preferred Time</label>
                  <input
                    type="time"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    value={newBooking.time}
                    onChange={(e) => setNewBooking({ ...newBooking, time: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#1c1c14] block mb-1.5">Estimated Duration</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    value={newBooking.duration}
                    onChange={(e) => setNewBooking({ ...newBooking, duration: e.target.value })}
                  >
                    <option value="0.5">30 minutes</option>
                    <option value="1">1 hour</option>
                    <option value="1.5">1.5 hours</option>
                    <option value="2">2 hours</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1c1c14] block mb-1.5">
                  Reason / Topics for Assistance *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Specify the topics you would like assistance with..."
                  value={newBooking.reason}
                  onChange={(e) => setNewBooking({ ...newBooking, reason: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
              </div>

              {bookingError && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs">
                  {bookingError}
                </div>
              )}

              <button
                type="submit"
                className="w-full h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white font-semibold text-xs shadow-xs inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                Submit Consultation Request
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-[#c9c7b6] bg-[#faf8f0] p-5 text-xs space-y-3">
              <span className="font-bold text-sm text-[#1c1c14] block">
                Booking Guidelines
              </span>
              <ul className="space-y-2 text-[#797869]">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#616218]">•</span>
                  <span><strong>Notice:</strong> Submit requests at least 24 hours prior to preferred time.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#616218]">•</span>
                  <span><strong>Venues:</strong> Approved sessions take place in designated subject labs or library discussion rooms.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#616218]">•</span>
                  <span><strong>Preparation:</strong> Bring your textbooks, notebooks, and homework worksheets.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 text-xs space-y-2">
              <span className="font-bold text-sm text-[#1c1c14] block">
                Academic Support Hotline
              </span>
              <p className="text-[#797869]">
                For urgent examination guidance or schedule clashes, contact the Vice Principal, Academics:
              </p>
              <div className="font-semibold text-[#1c1c14] pt-1">
                +234 803 456 7890 · academics@alamin.sch.ng
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Check Availability */}
      {activeTab === 'availability' && (
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#c9c7b6]/50">
            <div>
              <h3 className="text-base font-bold text-[#1c1c14]">
                Teacher Consultation Availability ({selectedWeekday})
              </h3>
              <p className="text-xs text-[#797869]">
                Live consultation hours configured by teachers for {selectedWeekday}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
              />
            </div>
          </div>

          {availableSlotsForDay.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableSlotsForDay.map((slot) => (
                <div
                  key={slot.id}
                  className={`p-4 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    slot.isAvailable
                      ? 'bg-[#faf8f0] border-[#c9c7b6]'
                      : 'bg-stone-50 border-stone-200 opacity-65'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-[#1c1c14]">
                      <Clock className="w-3.5 h-3.5 text-[#616218]" />
                      <span>
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </div>
                    <div className="text-[#1c1c14] font-semibold">{slot.teacherName}</div>
                    <div className="text-[#616218] font-medium">{slot.subjectLabel}</div>
                    {slot.note && <div className="text-[11px] text-[#797869]">{slot.note}</div>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        slot.isAvailable
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {slot.isAvailable ? 'Open Slot' : 'Unavailable'}
                    </span>
                    {slot.isAvailable && (
                      <Button variant="outline" onClick={() => handleRequestOpenSlot(slot)}>
                        Request Slot
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-lg border border-dashed border-[#c9c7b6] text-center text-xs text-[#797869]">
              No teacher consultation hours are listed for {selectedWeekday}. Choose a weekday from Monday to Friday.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StudentBookings;
