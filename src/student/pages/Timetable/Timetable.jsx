import React, { useState, useEffect } from 'react';
import {
  Printer,
  Bell,
  X
} from 'lucide-react';
import { Button } from '../../../shared/components/Button/Button';
import { TimetableGrid } from '../../../shared/components/TimetableGrid/TimetableGrid';
import {
  schoolStore,
  SCHOOL_CLASSES,
  TIMETABLE_DAYS,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';

export function StudentTimetable() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDay, setSelectedDay] = useState('Full Week');
  const [slots, setSlots] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const loadTimetable = async (cls) => {
    if (!cls) return;
    try {
      const [ttRes, alRes] = await Promise.all([
        schoolStore.fetchTimetable(cls),
        schoolStore.fetchAlerts()
      ]);
      setSlots(Array.isArray(ttRes) ? ttRes : []);
      setAlerts(Array.isArray(alRes) ? alRes : []);
    } catch (error) {
      console.error('Failed to load student timetable:', error);
      setSlots([]);
      setAlerts([]);
    }
  };

  useEffect(() => {
    let active = true;
    schoolStore.fetchCurrentStudent().then((student) => {
      if (active) setSelectedClass(student?.class || SCHOOL_CLASSES[0] || 'JSS 1');
    }).catch((error) => {
      console.error('Failed to load current student:', error);
      if (active) setSelectedClass(SCHOOL_CLASSES[0] || 'JSS 1');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    loadTimetable(selectedClass);
    return subscribeSchoolSync(() => loadTimetable(selectedClass));
  }, [selectedClass]);

  const handleClassChange = (nextClass) => {
    setSelectedClass(nextClass);
    loadTimetable(nextClass);
  };

  const handleDismissAlert = async (id) => {
    try {
      await schoolStore.dismissAlert(id);
      await loadTimetable(selectedClass);
    } catch (error) {
      console.error('Failed to dismiss timetable alert:', error);
    }
  };

  const daysToDisplay = selectedDay === 'Full Week' ? TIMETABLE_DAYS : [selectedDay];

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      {/* Print Header */}
      <div className="hidden print:block pb-3 border-b border-[#c9c7b6]">
        <h1 className="text-xl font-bold text-[#1c1c14]">
          Al-Amin Group of Schools
        </h1>
        <p className="text-xs font-semibold text-[#494900]">
          {selectedClass} Weekly Time Table
        </p>
      </div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Time Table
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Weekly lesson timetable, Break hours, and Solat periods for {selectedClass}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedClass}
            onChange={(e) => handleClassChange(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs font-semibold text-[#1c1c14]"
          >
            {SCHOOL_CLASSES.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>

          <Button
            variant="primary"
            onClick={() => window.print()}
            icon={<Printer className="w-4 h-4" />}
          >
            Print Time Table
          </Button>
        </div>
      </div>

      {/* Live Class Schedule Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2 print:hidden">
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

      {/* Day Filter Tabs & Legend */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#c9c7b6] shadow-xs print:hidden">
        <div className="flex flex-wrap gap-2">
          {['Full Week', ...TIMETABLE_DAYS].map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`h-10 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedDay === day
                  ? 'bg-[#616218] text-white'
                  : 'bg-[#faf8f0] border border-[#c9c7b6] text-[#44443b] hover:bg-[#f4f2e1]'
              }`}
            >
              {day}
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

      {/* Tabular School Time Table */}
      <TimetableGrid
        slots={slots}
        days={daysToDisplay}
        showClassBadge={false}
        allowRowMerge={true}
      />
    </div>
  );
}

export default StudentTimetable;
