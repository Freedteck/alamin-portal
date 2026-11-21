import React, { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  Bell,
  X,
  AlertTriangle
} from 'lucide-react';
import { TimetableGrid } from '../../../shared/components/TimetableGrid/TimetableGrid';
import { Modal } from '../../../shared/components/Modal/Modal';
import { Button } from '../../../shared/components/Button/Button';
import {
  schoolStore,
  SCHOOL_CLASSES,
  TIMETABLE_DAYS,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';

export function AdminTimetable() {
  const [selectedClass, setSelectedClass] = useState('SSS 2');
  const [, setRevision] = useState(0);
  const [teachers, setTeachers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState('');

  const [formState, setFormState] = useState({
    class: 'SSS 2',
    day: 'Monday',
    type: 'lesson',
    subject: 'Mathematics',
    title: '',
    teacherId: '',
    startTime: '08:30',
    endTime: '09:30',
    notes: ''
  });

  const loadData = () => {
    setRevision((n) => n + 1);
    setTeachers(schoolStore.getTeachers());
    setAlerts(schoolStore.getAlertsForUser('admin'));
  };

  useEffect(() => {
    loadData();
    return subscribeSchoolSync(loadData);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const classTimetable = schoolStore.getTimetableForClass(selectedClass);

  const openAddModal = (preset = {}) => {
    const targetClass = selectedClass === 'All Classes' ? 'SSS 2' : selectedClass;
    const classSubjects = schoolStore.getSubjectsForClass(targetClass);
    setEditingSlot(null);
    setFormState({
      class: selectedClass,
      day: preset.day || 'Monday',
      type: 'lesson',
      subject: classSubjects[0] || '',
      title: '',
      teacherId: teachers[0]?.id || '',
      startTime: preset.startTime || '08:30',
      endTime: preset.endTime || '09:30',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (slot) => {
    setEditingSlot(slot);
    setFormState({
      class: slot.class || selectedClass,
      day: slot.day || 'Monday',
      type: slot.type || 'lesson',
      subject: slot.subject || '',
      title: slot.title || '',
      teacherId: slot.teacherId || teachers[0]?.id || '',
      startTime: slot.startTime || '08:30',
      endTime: slot.endTime || '09:30',
      notes: slot.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveSlot = (e) => {
    e.preventDefault();
    if (formState.endTime <= formState.startTime) {
      showToast('End time must be later than start time.');
      return;
    }

    const teacherObj = teachers.find((t) => t.id === formState.teacherId);
    const resolvedTitle =
      formState.type === 'lesson'
        ? (formState.title.trim() || formState.subject)
        : (formState.title.trim() || (formState.type === 'break' ? 'Long Break' : formState.type === 'solat' ? 'Solat Congregation' : 'School Activity'));

    const payload = {
      class: formState.type === 'break' || formState.type === 'solat' ? formState.class : formState.class,
      day: formState.day,
      type: formState.type,
      subject: formState.type === 'lesson' ? formState.subject : resolvedTitle,
      title: resolvedTitle,
      teacherId: formState.type === 'lesson' ? formState.teacherId : '',
      teacherName:
        formState.type === 'lesson'
          ? (teacherObj?.name || 'Subject Teacher')
          : formState.type === 'solat'
          ? 'Imam / Mosque Coordinators'
          : 'School-Wide',
      startTime: formState.startTime,
      endTime: formState.endTime,
      notes: formState.notes.trim()
    };

    if (editingSlot) {
      schoolStore.updateTimetableSlot(editingSlot.id, payload);
      showToast('Time table period updated.');
    } else {
      schoolStore.addTimetableSlot(payload);
      showToast('New time table period added.');
    }

    loadData();
    setIsModalOpen(false);
    setEditingSlot(null);
  };

  const handleDeleteSlot = () => {
    if (!confirmDelete) return;
    schoolStore.deleteTimetableSlot(confirmDelete.id);
    loadData();
    setConfirmDelete(null);
    showToast('Removed period from weekly time table.');
  };

  const handleDismissAlert = (id) => {
    schoolStore.dismissAlert(id);
    loadData();
  };

  const availableSubjects = schoolStore.getSubjectsForClass(
    formState.class === 'All Classes' ? '' : formState.class
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Master Weekly Time Table
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Build and edit class schedules, daily Break, Zuhr & Asr Solat times, and multi-period school activities.
          </p>
        </div>

        <Button onClick={() => openAddModal()} className="gap-2">
          <Plus className="w-4 h-4" />
          <span>Add Period</span>
        </Button>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((al) => (
            <div
              key={al.id}
              className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 flex items-start justify-between gap-3 text-xs text-amber-950"
            >
              <div className="flex items-start gap-2.5">
                <Bell className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">{al.title}</div>
                  <p className="mt-0.5 leading-relaxed">{al.message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDismissAlert(al.id)}
                className="p-1 rounded hover:bg-amber-100 text-amber-800 cursor-pointer"
                title="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#797869] mr-1">Class View:</span>
          {[...SCHOOL_CLASSES, 'All Classes'].map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => setSelectedClass(cls)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedClass === cls
                  ? 'bg-[#616218] text-white shadow-xs'
                  : 'bg-[#faf8f0] text-[#48482d] border border-[#c9c7b6] hover:bg-white'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>

        <div className="text-xs text-[#797869] flex flex-wrap items-center gap-3 shrink-0">
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
      </div>

      <TimetableGrid
        slots={classTimetable}
        days={TIMETABLE_DAYS}
        showClassBadge={selectedClass === 'All Classes'}
        allowRowMerge={true}
        onEditSlot={openEditModal}
        onDeleteSlot={(slot) => setConfirmDelete(slot)}
        onAddAtSlot={(preset) => openAddModal(preset)}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSlot ? 'Edit Time Table Period' : 'Add Time Table Period'}
        subtitle="Configure lesson periods, breaks, Solat times, or multi-period school activities"
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="admin-timetable-form">
              {editingSlot ? 'Save Changes' : 'Add to Time Table'}
            </Button>
          </>
        }
      >
        <form id="admin-timetable-form" onSubmit={handleSaveSlot} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]">Class</label>
              <select
                value={formState.class}
                onChange={(e) => {
                  const nextCls = e.target.value;
                  const subs = schoolStore.getSubjectsForClass(nextCls === 'All Classes' ? '' : nextCls);
                  setFormState({
                    ...formState,
                    class: nextCls,
                    subject: subs.includes(formState.subject) ? formState.subject : (subs[0] || '')
                  });
                }}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
              >
                {SCHOOL_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
                <option value="All Classes">All Classes</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]">Period Type</label>
              <select
                value={formState.type}
                onChange={(e) => setFormState({ ...formState, type: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
              >
                <option value="lesson">Subject Lesson</option>
                <option value="break">Break Period</option>
                <option value="solat">Solat Prayer Break</option>
                <option value="activity">Multi-Period Activity / Assembly</option>
              </select>
            </div>
          </div>

          {formState.type === 'lesson' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]">Subject</label>
                <select
                  required
                  value={formState.subject}
                  onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
                >
                  {availableSubjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]">Assigned Teacher</label>
                <select
                  value={formState.teacherId}
                  onChange={(e) => setFormState({ ...formState, teacherId: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]">Activity / Block Title</label>
              <input
                required
                value={formState.title}
                onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                placeholder="e.g. Zuhr Solat Congregation or Long Break"
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
              />
            </div>
          )}

          {formState.type === 'lesson' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]">Custom Period Label</label>
              <input
                value={formState.title}
                onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                placeholder="Optional, e.g. Chemistry Practical Double Period"
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]">Day</label>
              <select
                value={formState.day}
                onChange={(e) => setFormState({ ...formState, day: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
              >
                {TIMETABLE_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]">Start Time</label>
              <input
                type="time"
                required
                value={formState.startTime}
                onChange={(e) => setFormState({ ...formState, startTime: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]">End Time</label>
              <input
                type="time"
                required
                value={formState.endTime}
                onChange={(e) => setFormState({ ...formState, endTime: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14]">Notes</label>
            <textarea
              rows={2}
              value={formState.notes}
              onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
              placeholder="Optional topic or schedule notes..."
              className="w-full px-3 py-2.5 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        variant="confirm"
        title="Remove Time Table Period"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteSlot}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Remove Period
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 text-xs text-[#44443b]">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sm text-[#1c1c14] mb-1">
              Remove {confirmDelete?.title || confirmDelete?.subject}?
            </p>
            <p>
              This period will be removed from {confirmDelete?.class} ({confirmDelete?.day}).
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdminTimetable;
