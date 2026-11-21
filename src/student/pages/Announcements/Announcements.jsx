import React, { useState, useEffect } from 'react';
import {
  Bell,
  Pin,
  Users,
  Calendar
} from 'lucide-react';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { schoolStore, subscribeSchoolSync } from '../../../shared/data/schoolData';

export function StudentAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [activeStudent, setActiveStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    const loadNotices = async () => {
      try {
        const [sRes, aRes] = await Promise.all([
          schoolStore.fetchStudents(),
          schoolStore.fetchAnnouncements()
        ]);
        const saved = JSON.parse(localStorage.getItem('alamin_user') || '{}');
        const students = Array.isArray(sRes) ? sRes : (sRes?.data || []);
        const matched =
          students.find(
            (s) => s.email === saved.email || s.id === saved.id || s.name === saved.name
          ) || students[0];
        setActiveStudent(matched);
        setAnnouncements(Array.isArray(aRes) ? aRes.filter((a) => !a.targetRole || a.targetRole === 'all' || a.targetRole === 'student') : []);
      } catch {
        const saved = JSON.parse(localStorage.getItem('alamin_user') || '{}');
        const students = schoolStore.getStudents();
        const matched =
          students.find(
            (s) => s.email === saved.email || s.id === saved.id || s.name === saved.name
          ) || students[0];
        setActiveStudent(matched);
        setAnnouncements(schoolStore.getAnnouncementsForUser('student', matched?.class || ''));
      }
    };
    loadNotices();
    return subscribeSchoolSync(loadNotices);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const filtered = announcements.filter((a) => {
    const matchSearch =
      a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'all' || a.type === filterType;
    return matchSearch && matchType;
  });

  const sorted = [...filtered].sort(
    (a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))
  );

  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-[#faf8f0] text-[#494900] border-[#c9c7b6]';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-['Poppins',sans-serif] pb-16">
      {/* Header */}
      <div className="pb-2 border-b border-[#c9c7b6]/50">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
          Announcements
        </h1>
        <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
          Official school circulars and teacher notices addressed to all students and{' '}
          {activeStudent?.class || 'your class'}.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-lg border border-[#c9c7b6] shadow-xs">
        <div className="w-full md:w-80">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search announcements..."
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
        >
          <option value="all">All Categories</option>
          <option value="general">General</option>
          <option value="test">Examinations & CA</option>
          <option value="event">Events</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {/* Announcements List */}
      <div className="space-y-3">
        {paginated.length > 0 ? (
          paginated.map((ann) => {
            const targets = ann.targetAudiences || ann.targetAudience || ['Everyone'];
            return (
              <div
                key={ann.id}
                className={`rounded-lg border p-5 shadow-xs space-y-2 ${
                  ann.isPinned ? 'bg-[#faf8f0] border-[#616218]' : 'bg-white border-[#c9c7b6]'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityBadge(
                      ann.priority
                    )}`}
                  >
                    {ann.priority || 'notice'}
                  </span>
                  {ann.isPinned && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#616218] text-white">
                      <Pin className="w-3 h-3" />
                      Pinned
                    </span>
                  )}
                  <h3 className="text-sm font-bold text-[#1c1c14]">{ann.title}</h3>
                </div>

                <p className="text-xs text-[#44443b] leading-relaxed">{ann.content}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#c9c7b6]/40 text-[11px] text-[#797869]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#494900]">
                      From: {ann.author || 'School Administration'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3 h-3 text-[#616218]" />
                      {targets.join(', ')}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {ann.date}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-10 text-center text-xs text-[#797869]">
            <Bell className="w-8 h-8 mx-auto mb-2 text-[#c9c7b6]" />
            No school announcements found.
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={sorted.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

export default StudentAnnouncements;
