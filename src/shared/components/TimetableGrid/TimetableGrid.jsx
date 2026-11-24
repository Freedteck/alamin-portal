import React from 'react';
import { Pencil, Trash2, RefreshCw, Plus } from 'lucide-react';
import { TIMETABLE_DAYS } from '../../data/schoolData';

const BASELINE_BOUNDARIES = [
  '08:00',
  '08:30',
  '09:30',
  '10:30',
  '12:00',
  '13:00',
  '14:00',
  '14:20',
  '15:50',
  '16:10'
];

const toMinutes = (timeStr) => {
  const [h, m] = String(timeStr || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const formatTime12 = (timeStr) => {
  const [hRaw, mRaw] = String(timeStr || '00:00').split(':').map(Number);
  const h = Number.isFinite(hRaw) ? hRaw : 0;
  const m = Number.isFinite(mRaw) ? mRaw : 0;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const formatRangeCompact = (start, end) => {
  const s = formatTime12(start);
  const e = formatTime12(end);
  const sSuffix = s.slice(-2);
  const eSuffix = e.slice(-2);
  if (sSuffix === eSuffix) {
    return `${s.replace(/\s?(AM|PM)$/, '')} – ${e}`;
  }
  return `${s} – ${e}`;
};

const getFixedBlockLabel = (interval) => {
  if (interval.start === '08:00' && interval.end === '08:30') return 'Assembly';
  if (interval.start === '12:00' && interval.end === '13:00') return 'Break';
  if (interval.start === '14:00' && interval.end === '14:20') return 'Zuhr Solat';
  if (interval.start === '15:50' && interval.end === '16:10') return 'Asr Solat';
  return null;
};

export function TimetableGrid({
  slots = [],
  days = TIMETABLE_DAYS,
  showClassBadge = false,
  allowRowMerge = true,
  onEditSlot,
  onDeleteSlot,
  onRescheduleSlot,
  canRescheduleSlot,
  onAddAtSlot
}) {
  const boundarySet = new Set(BASELINE_BOUNDARIES);
  slots.forEach((slot) => {
    if (slot.startTime && slot.endTime && toMinutes(slot.endTime) > toMinutes(slot.startTime)) {
      boundarySet.add(slot.startTime);
      boundarySet.add(slot.endTime);
    }
  });

  const sortedTimes = Array.from(boundarySet).sort((a, b) => toMinutes(a) - toMinutes(b));
  const intervals = [];
  for (let i = 0; i < sortedTimes.length - 1; i++) {
    const start = sortedTimes[i];
    const end = sortedTimes[i + 1];
    const startMin = toMinutes(start);
    const endMin = toMinutes(end);
    if (endMin > startMin) {
      intervals.push({ start, end, startMin, endMin });
    }
  }

  let periodCounter = 0;
  const rows = intervals.map((interval) => {
    const fixed = getFixedBlockLabel(interval);
    if (fixed) {
      return { ...interval, label: fixed, isFixedBlock: true };
    }
    periodCounter += 1;
    return { ...interval, label: `Period ${periodCounter}`, isFixedBlock: false };
  });

  const dayHasOverlaps = (day) => {
    const daySlots = slots.filter((s) => s.day === day);
    for (let i = 0; i < daySlots.length; i++) {
      for (let j = i + 1; j < daySlots.length; j++) {
        const a = daySlots[i];
        const b = daySlots[j];
        if (
          toMinutes(a.startTime) < toMinutes(b.endTime) &&
          toMinutes(a.endTime) > toMinutes(b.startTime)
        ) {
          return true;
        }
      }
    }
    return false;
  };

  const mergedRowIndices = new Set();
  if (allowRowMerge && days.length > 1) {
    rows.forEach((row, rowIdx) => {
      const firstDaySlots = slots.filter(
        (s) =>
          s.day === days[0] &&
          toMinutes(s.startTime) < row.endMin &&
          toMinutes(s.endTime) > row.startMin
      );
      if (firstDaySlots.length !== 1) return;
      const ref = firstDaySlots[0];
      if (
        ref.class !== 'All Classes' ||
        toMinutes(ref.startTime) !== row.startMin ||
        toMinutes(ref.endTime) !== row.endMin ||
        ref.type === 'lesson'
      ) {
        return;
      }

      const everyDayMatches = days.every((d) => {
        const matching = slots.filter(
          (s) =>
            s.day === d &&
            toMinutes(s.startTime) < row.endMin &&
            toMinutes(s.endTime) > row.startMin
        );
        return (
          matching.length === 1 &&
          matching[0].class === 'All Classes' &&
          matching[0].type === ref.type &&
          matching[0].title === ref.title &&
          toMinutes(matching[0].startTime) === row.startMin &&
          toMinutes(matching[0].endTime) === row.endMin
        );
      });

      if (everyDayMatches) {
        mergedRowIndices.add(rowIdx);
      }
    });
  }

  const occupiedByDay = {};
  days.forEach((d) => {
    occupiedByDay[d] = new Set();
  });

  const getCellTint = (type) => {
    switch (type) {
      case 'break':
        return 'bg-amber-50/75 text-amber-950';
      case 'solat':
        return 'bg-emerald-50/75 text-emerald-950';
      case 'activity':
        return 'bg-[#f7f5eb] text-[#494900]';
      default:
        return 'bg-white text-[#1c1c14] hover:bg-[#faf8f0]/60';
    }
  };

  const renderSlotEntry = (slot, isStacked = false) => {
    const isLesson = slot.type === 'lesson';
    const primaryLabel = isLesson
      ? slot.subject || slot.title
      : slot.title || slot.subject;
    const secondaryTitle =
      isLesson && slot.title && slot.title !== slot.subject ? slot.title : null;

    return (
      <div
        key={slot.id}
        className={
          isStacked
            ? `p-2.5 rounded-md border ${
                isLesson
                  ? 'border-[#e5e3d8] bg-[#faf8f0]/60'
                  : 'border-[#e5e3d8] ' + getCellTint(slot.type)
              }`
            : 'flex flex-col justify-between gap-2 h-full'
        }
      >
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-1.5">
            <div className="space-y-0.5 min-w-0 flex-1">
              {showClassBadge && (
                <span className="inline-block px-1.5 py-0.5 rounded bg-[#faf8f0] border border-[#c9c7b6] text-[10px] font-semibold text-[#494900] mb-0.5">
                  {slot.class}
                </span>
              )}

              <div className="text-[13px] font-semibold leading-snug text-[#1c1c14] break-words">
                {primaryLabel}
              </div>

              {secondaryTitle && (
                <div className="text-[11px] font-medium text-[#616218] leading-snug">
                  {secondaryTitle}
                </div>
              )}
            </div>

            {(onEditSlot || onDeleteSlot) && (
              <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover/cell:opacity-100 transition-opacity">
                {onEditSlot && (
                  <button
                    type="button"
                    onClick={() => onEditSlot(slot)}
                    className="p-1 rounded text-[#797869] hover:text-[#616218] hover:bg-[#faf8f0] transition-colors cursor-pointer"
                    title="Edit period"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDeleteSlot && (
                  <button
                    type="button"
                    onClick={() => onDeleteSlot(slot)}
                    className="p-1 rounded text-[#797869] hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete period"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {slot.teacherName && (
            <div className="text-[11px] text-[#797869] leading-snug">
              {slot.teacherName}
            </div>
          )}
        </div>

        {onRescheduleSlot && isLesson && (!canRescheduleSlot || canRescheduleSlot(slot)) && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => onRescheduleSlot(slot)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#616218] hover:text-[#494900] hover:underline transition-colors cursor-pointer"
              title="Reschedule period"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reschedule</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className={`w-full border-collapse text-left ${
            days.length > 1 ? 'table-fixed min-w-[820px]' : 'min-w-[460px]'
          }`}
        >
          <thead>
            <tr className="bg-[#faf8f0] border-b border-[#c9c7b6]">
              <th
                scope="col"
                className="w-36 px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-[#494900] border-r border-[#c9c7b6]"
              >
                Time
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-[#1c1c14] border-r last:border-r-0 border-[#e5e3d8]"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#e5e3d8]">
            {rows.map((row, rowIdx) => {
              if (mergedRowIndices.has(rowIdx)) {
                const sampleSlot = slots.find(
                  (s) =>
                    s.day === days[0] &&
                    toMinutes(s.startTime) === row.startMin &&
                    toMinutes(s.endTime) === row.endMin
                );
                const bandTitle =
                  sampleSlot?.type === 'break'
                    ? 'Long Break & Refreshments'
                    : sampleSlot?.title || sampleSlot?.subject || row.label;
                const bandStyle =
                  sampleSlot?.type === 'break'
                    ? 'bg-amber-50/75 text-amber-900'
                    : sampleSlot?.type === 'solat'
                    ? 'bg-emerald-50/75 text-emerald-900'
                    : 'bg-[#f7f5eb] text-[#494900]';

                return (
                  <tr key={`${row.start}-${row.end}`}>
                    <th
                      scope="row"
                      className={`px-4 py-2.5 border-r border-[#c9c7b6] align-middle ${bandStyle}`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        {row.label}
                      </div>
                      <div className="text-xs font-semibold whitespace-nowrap mt-0.5">
                        {formatRangeCompact(row.start, row.end)}
                      </div>
                    </th>
                    <td
                      colSpan={days.length}
                      className={`group/band px-4 py-2.5 text-center align-middle relative ${bandStyle}`}
                    >
                      <span className="text-xs font-semibold tracking-wide">
                        {bandTitle}
                      </span>
                      {onEditSlot && sampleSlot && (
                        <button
                          type="button"
                          onClick={() => onEditSlot(sampleSlot)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover/band:opacity-100 text-current/70 hover:text-current hover:bg-white/60 transition-all cursor-pointer"
                          title={`Edit ${bandTitle}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={`${row.start}-${row.end}`}>
                  <th
                    scope="row"
                    className={`px-4 py-3.5 border-r border-[#c9c7b6] align-top ${
                      row.isFixedBlock ? 'bg-[#faf8f0]/80' : 'bg-[#faf8f0]/40'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#616218]">
                      {row.label}
                    </div>
                    <div className="text-xs font-semibold text-[#1c1c14] whitespace-nowrap mt-0.5">
                      {formatRangeCompact(row.start, row.end)}
                    </div>
                  </th>

                  {days.map((day) => {
                    if (occupiedByDay[day].has(rowIdx)) {
                      return null;
                    }

                    const hasOverlap = dayHasOverlaps(day);
                    const daySlots = slots
                      .filter((s) => s.day === day)
                      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

                    if (!hasOverlap) {
                      const exactSlot = daySlots.find(
                        (s) => toMinutes(s.startTime) === row.startMin
                      );

                      if (exactSlot) {
                        const slotEndMin = toMinutes(exactSlot.endTime);
                        let span = 1;
                        while (
                          rowIdx + span < rows.length &&
                          !mergedRowIndices.has(rowIdx + span) &&
                          rows[rowIdx + span].endMin <= slotEndMin
                        ) {
                          occupiedByDay[day].add(rowIdx + span);
                          span += 1;
                        }

                        const compactFixedRow =
                          exactSlot.type === 'break' || exactSlot.type === 'solat';

                        return (
                          <td
                            key={`${day}-${rowIdx}`}
                            rowSpan={span}
                            className={`group/cell border-r last:border-r-0 border-[#e5e3d8] ${
                              compactFixedRow ? 'px-3.5 py-2.5' : 'px-3.5 py-3.5'
                            } align-top transition-colors ${getCellTint(exactSlot.type)}`}
                          >
                            {renderSlotEntry(exactSlot, false)}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={`${day}-${rowIdx}`}
                          className="group/cell border-r last:border-r-0 border-[#e5e3d8] px-3.5 py-3.5 align-middle text-center bg-[#faf8f0]/20"
                        >
                          {onAddAtSlot ? (
                            <button
                              type="button"
                              onClick={() =>
                                onAddAtSlot({
                                  day,
                                  startTime: row.start,
                                  endTime: row.end
                                })
                              }
                              className="w-full py-2 rounded text-[11px] font-medium text-[#a3a18d] hover:text-[#616218] hover:bg-white inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 opacity-60 group-hover/cell:opacity-100" />
                              <span>Add</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#b8b6a4]">—</span>
                          )}
                        </td>
                      );
                    }

                    const cellSlots = daySlots.filter(
                      (s) =>
                        toMinutes(s.startTime) < row.endMin &&
                        toMinutes(s.endTime) > row.startMin
                    );

                    if (cellSlots.length === 0) {
                      return (
                        <td
                          key={`${day}-${rowIdx}`}
                          className="group/cell border-r last:border-r-0 border-[#e5e3d8] px-3.5 py-3.5 align-middle text-center bg-[#faf8f0]/20"
                        >
                          {onAddAtSlot ? (
                            <button
                              type="button"
                              onClick={() =>
                                onAddAtSlot({
                                  day,
                                  startTime: row.start,
                                  endTime: row.end
                                })
                              }
                              className="w-full py-2 rounded text-[11px] font-medium text-[#a3a18d] hover:text-[#616218] hover:bg-white inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 opacity-60 group-hover/cell:opacity-100" />
                              <span>Add</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#b8b6a4]">—</span>
                          )}
                        </td>
                      );
                    }

                    if (cellSlots.length === 1) {
                      return (
                        <td
                          key={`${day}-${rowIdx}`}
                          className={`group/cell border-r last:border-r-0 border-[#e5e3d8] px-3.5 py-3.5 align-top transition-colors ${getCellTint(
                            cellSlots[0].type
                          )}`}
                        >
                          {renderSlotEntry(cellSlots[0], false)}
                        </td>
                      );
                    }

                    return (
                      <td
                        key={`${day}-${rowIdx}`}
                        className="group/cell border-r last:border-r-0 border-[#e5e3d8] p-2.5 align-top bg-white space-y-2"
                      >
                        {cellSlots.map((slot) => renderSlotEntry(slot, true))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TimetableGrid;
