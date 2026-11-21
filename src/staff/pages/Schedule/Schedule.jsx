import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  Bell
} from 'lucide-react';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { TimetableGrid } from '../../../shared/components/TimetableGrid/TimetableGrid';
import {
  schoolStore,
  SCHOOL_CLASSES,
  TIMETABLE_DAYS,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';

export function ClassScheduling() {
  const [slots, setSlots] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [schoolClasses, setSchoolClasses] = useState(SCHOOL_CLASSES);
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedDay, setSelectedDay] = useState('Full Week');
  const [viewMode, setViewMode] = useState('mine'); // 'all' | 'mine'
  const [rescheduleSlot, setRescheduleSlot] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    day: 'Monday',
    startTime: '08:00',
    endTime: '09:00'
  });
  const [toast, setToast] = useState(null);

  const loadScheduleData = async () => {
    try {
      const [teacher, ttRes, alRes, classes] = await Promise.all([
        schoolStore.fetchCurrentTeacher(),
        schoolStore.fetchTimetable(),
        schoolStore.fetchAlerts(),
        schoolStore.fetchClasses()
      ]);
      setCurrentTeacher(teacher);
      setSlots(Array.isArray(ttRes) ? ttRes : []);
      setAlerts(Array.isArray(alRes) ? alRes : []);
      if (Array.isArray(classes)) setSchoolClasses(classes.map((item) => item.name || item));
    } catch (error) {
      console.error('Failed to load staff schedule:', error);
      setCurrentTeacher(null);
      setSlots([]);
      setAlerts([]);
    }
  };

  useEffect(() => {
    loadScheduleData();
    const unsubscribe = subscribeSchoolSync((topic) => {
      if (
        topic === 'timetable' || topic === 'alerts' || topic === 'teachers' ||
        topic === 'classes' || !topic
      ) {
        loadScheduleData();
      }
    });
    return unsubscribe;
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleDismissAlert = async (id) => {
    try {
      await schoolStore.dismissAlert(id);
      await loadScheduleData();
    } catch (error) {
      console.error('Failed to dismiss timetable alert:', error);
      showToast('Unable to dismiss timetable alert.');
    }
  };

  const openReschedule = (slot) => {
    setRescheduleSlot(slot);
    setRescheduleForm({
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime
    });
  };

  const getReschedulePreview = () => {
    if (!rescheduleSlot) return null;
    if (rescheduleForm.startTime >= rescheduleForm.endTime) {
      return { type: 'invalid', message: 'End time must be after start time.' };
    }

    const toMinutes = (t) => {
      const [h, m] = String(t).split(':').map(Number);
      return h * 60 + m;
    };
    const overlaps = (aStart, aEnd, bStart, bEnd) =>
      toMinutes(aStart) < toMinutes(bEnd) && toMinutes(aEnd) > toMinutes(bStart);

    const fixedBlock = slots.find(
      (s) =>
        s.id !== rescheduleSlot.id &&
        s.day === rescheduleForm.day &&
        s.class === 'All Classes' &&
        (s.type === 'break' || s.type === 'solat') &&
        overlaps(s.startTime, s.endTime, rescheduleForm.startTime, rescheduleForm.endTime)
    );
    if (fixedBlock) {
      return {
        type: 'blocked',
        message: `Overlaps protected ${fixedBlock.title} block (${fixedBlock.startTime} – ${fixedBlock.endTime}). Please pick another time.`
      };
    }

    const occupied = slots.find(
      (s) =>
        s.id !== rescheduleSlot.id &&
        s.day === rescheduleForm.day &&
        s.class === rescheduleSlot.class &&
        s.type === 'lesson' &&
        overlaps(s.startTime, s.endTime, rescheduleForm.startTime, rescheduleForm.endTime)
    );
    if (occupied) {
      return {
        type: 'swap',
        occupied,
        message: `Slot currently holds ${occupied.subject} by ${occupied.teacherName}. Rescheduling will swap both periods and alert ${occupied.teacherName}, ${rescheduleSlot.class} students, and Admin.`
      };
    }

    return {
      type: 'free',
      message: `This period is free. Moving will update the ${rescheduleSlot.class} Time Table and notify Admin and affected students.`
    };
  };

  const preview = getReschedulePreview();

  const handleConfirmReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleSlot) return;
    const result = await schoolStore.rescheduleTeacherSlot(
      rescheduleSlot.id,
      rescheduleForm.day,
      rescheduleForm.startTime,
      rescheduleForm.endTime,
      currentTeacher?.name || 'Subject Teacher'
    );
    if (!result || !result.success) {
      showToast(result?.message || 'Failed to reschedule class period.');
      return;
    }
    setRescheduleSlot(null);
    loadScheduleData();
    showToast(
      result.wasOccupied
        ? `Periods swapped! ${result.affectedTeacher}, class students, and Admin were alerted.`
        : 'Time Table updated! Affected class students and Admin were alerted.'
    );
  };

  const daysToDisplay = selectedDay === 'Full Week' ? TIMETABLE_DAYS : [selectedDay];

  const filterSlot = (slot) => {
    const classMatch =
      selectedClass === 'All Classes'
        ? true
        : slot.class === selectedClass || slot.class === 'All Classes';
    const teacherMatch =
      viewMode === 'all' ||
      slot.class === 'All Classes' ||
      slot.teacherName === currentTeacher?.name;
    return classMatch && teacherMatch;
  };

  const filteredSlots = slots.filter(filterSlot);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold max-w-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Time Table
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            View the weekly school timetable including Break and Solat hours, or reschedule a lesson period.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setViewMode('all');
              if (selectedClass === 'All Classes') {
                setSelectedClass(currentTeacher?.assignedClasses?.[0]?.class || schoolClasses[0] || 'JSS 1');
              }
            }}
            className={`h-10 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'all'
                ? 'bg-[#616218] text-white'
                : 'bg-white border border-[#c9c7b6] text-[#1c1c14] hover:bg-[#faf8f0]'
            }`}
          >
            All School Periods
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('mine');
              setSelectedClass('All Classes');
            }}
            className={`h-10 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'mine'
                ? 'bg-[#616218] text-white'
                : 'bg-white border border-[#c9c7b6] text-[#1c1c14] hover:bg-[#faf8f0]'
            }`}
          >
            My Teaching Periods
          </button>
        </div>
      </div>

      {/* Incoming Teacher Schedule Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((al) => (
            <div
              key={al.id}
              className="p-4 rounded-lg border border-amber-300 bg-amber-50 flex items-start justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <Bell className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-900">{al.title}</div>
                  <p className="text-amber-800 mt-0.5">{al.message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDismissAlert(al.id)}
                className="p-1 text-amber-700 hover:text-amber-950 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar & Legend */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-white p-4 rounded-lg border border-[#c9c7b6] shadow-xs">
        <div className="flex flex-wrap gap-2">
          {['Full Week', ...TIMETABLE_DAYS].map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`h-10 px-3.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedDay === day
                  ? 'bg-[#616218] text-white'
                  : 'bg-[#faf8f0] border border-[#c9c7b6] text-[#44443b] hover:bg-[#f4f2e1]'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4">
          <div className="text-xs text-[#797869] flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-200 border border-amber-400"></span>
              Break
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 border border-emerald-400"></span>
              Solat
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#f4f2e1] border border-[#c9c7b6]"></span>
              Activity
            </span>
          </div>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs font-semibold text-[#1c1c14]"
          >
            <option value="All Classes">All My Classes</option>
            {[...new Set((currentTeacher?.assignedClasses || []).map((assignment) => assignment.class))].map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabular School Time Table */}
      <TimetableGrid
        slots={filteredSlots}
        days={daysToDisplay}
        showClassBadge={selectedClass === 'All Classes'}
        allowRowMerge={true}
        onRescheduleSlot={openReschedule}
      />

      {/* Reschedule Lesson Modal */}
      <Modal
        isOpen={!!rescheduleSlot}
        onClose={() => setRescheduleSlot(null)}
        title="Reschedule Class Period"
        subtitle="Move period to a free slot or swap with a colleague"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRescheduleSlot(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={preview?.type === 'blocked' || preview?.type === 'invalid'}
              onClick={handleConfirmReschedule}
            >
              Confirm Reschedule
            </Button>
          </>
        }
      >
        {rescheduleSlot && (
          <form onSubmit={handleConfirmReschedule} className="space-y-4">
            <div className="p-3.5 rounded-lg bg-[#faf8f0] border border-[#c9c7b6] space-y-1 text-xs">
              <div className="text-[#797869]">Current Schedule</div>
              <div className="text-sm font-bold text-[#1c1c14]">
                {rescheduleSlot.class} · {rescheduleSlot.subject}
              </div>
              <div className="text-[#494900] font-semibold">
                {rescheduleSlot.day} · {rescheduleSlot.startTime} – {rescheduleSlot.endTime}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Target Weekday</label>
              <select
                value={rescheduleForm.day}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, day: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                {TIMETABLE_DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14] block">Start Time</label>
                <input
                  type="time"
                  required
                  value={rescheduleForm.startTime}
                  onChange={(e) =>
                    setRescheduleForm({ ...rescheduleForm, startTime: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14] block">End Time</label>
                <input
                  type="time"
                  required
                  value={rescheduleForm.endTime}
                  onChange={(e) =>
                    setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
                />
              </div>
            </div>

            {preview && (
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                  preview.type === 'blocked' || preview.type === 'invalid'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : preview.type === 'swap'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {preview.type === 'free' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <p className="leading-relaxed font-medium">{preview.message}</p>
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}

export default ClassScheduling;
