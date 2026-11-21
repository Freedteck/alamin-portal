import React, { useState, useEffect, useRef } from 'react';
import {
  Megaphone,
  Plus,
  Pin,
  Trash2,
  Users,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { schoolStore, SCHOOL_CLASSES, subscribeSchoolSync } from '../../../shared/data/schoolData';

const TEACHER_AUDIENCE_OPTIONS = [
  'Everyone',
  'All Students',
  'Teaching Staff',
  'Parents',
  ...SCHOOL_CLASSES
];

export function StaffAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [totalAnnouncements, setTotalAnnouncements] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
  const loadRequest = useRef(0);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentTeacher, setCurrentTeacher] = useState(null);

  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'general',
    priority: 'medium',
    targetAudiences: ['All Students'],
    isPinned: false
  });

  const refreshData = async () => {
    const requestId = ++loadRequest.current;
    try {
      const [teacher, aRes] = await Promise.all([
        schoolStore.fetchCurrentTeacher(),
        schoolStore.fetchAnnouncements({
          page: currentPage,
          limit: pageSize,
          search: searchTerm,
          scope: activeTab
        })
      ]);
      if (requestId !== loadRequest.current) return;
      setCurrentTeacher(teacher);
      setAnnouncements(Array.isArray(aRes?.data) ? aRes.data : []);
      setTotalAnnouncements(aRes?.total || 0);
    } catch (error) {
      if (requestId !== loadRequest.current) return;
      console.error('Failed to load staff announcements:', error);
      setCurrentTeacher(null);
      setAnnouncements([]);
      setTotalAnnouncements(0);
    }
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = subscribeSchoolSync(refreshData);
    return () => {
      loadRequest.current += 1;
      unsubscribe();
    };
  }, [activeTab, currentPage, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleAudience = (aud) => {
    setForm((prev) => {
      if (aud === 'Everyone') {
        return { ...prev, targetAudiences: ['Everyone'] };
      }
      const cleaned = prev.targetAudiences.filter((a) => a !== 'Everyone');
      const exists = cleaned.includes(aud);
      const next = exists ? cleaned.filter((a) => a !== aud) : [...cleaned, aud];
      return {
        ...prev,
        targetAudiences: next.length > 0 ? next : ['All Students']
      };
    });
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      showToast('Please enter a title and announcement message.');
      return;
    }

    schoolStore.addAnnouncement({
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
      priority: form.priority,
      targetAudiences: form.targetAudiences,
      isPinned: form.isPinned,
      author: currentTeacher?.name || 'Teaching Staff',
      authorRole: 'Teaching Staff',
      status: 'published'
    });

    setForm({
      title: '',
      content: '',
      type: 'general',
      priority: 'medium',
      targetAudiences: ['All Students'],
      isPinned: false
    });
    setIsAddOpen(false);
    refreshData();
    showToast('Announcement published to selected classes.');
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    schoolStore.deleteAnnouncement(confirmDelete.id);
    setConfirmDelete(null);
    refreshData();
    showToast('Announcement deleted.');
  };

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
            Announcements
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Read school administration bulletins addressed to staff and publish notices for your classes.
          </p>
        </div>

        <Button variant="primary" onClick={() => setIsAddOpen(true)} icon={<Plus className="w-4 h-4" />}>
          New Announcement
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-lg border border-[#c9c7b6] shadow-xs">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All Bulletins' },
            { id: 'admin', label: 'Admin Bulletins' },
            { id: 'mine', label: 'My Published Notices' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-10 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#616218] text-white'
                  : 'bg-[#faf8f0] border border-[#c9c7b6] text-[#44443b] hover:bg-[#f4f2e1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full md:w-72">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search announcements..."
          />
        </div>
      </div>

      <div className="space-y-3">
        {announcements.length > 0 ? (
          announcements.map((ann) => {
            const targets = ann.targetAudiences || ann.targetAudience || ['Everyone'];
            const isOwn = ann.authorRole === 'Teaching Staff';
            return (
              <div
                key={ann.id}
                className={`rounded-lg border p-5 shadow-xs ${
                  ann.isPinned ? 'bg-[#faf8f0] border-[#616218]' : 'bg-white border-[#c9c7b6]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-white border border-[#c9c7b6] text-[10px] font-bold uppercase text-[#494900]">
                        {ann.authorRole || 'School Notice'}
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

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-[#797869] flex items-center gap-1 mr-1">
                        <Users className="w-3.5 h-3.5 text-[#616218]" />
                        Audience:
                      </span>
                      {targets.map((aud) => (
                        <span
                          key={aud}
                          className="px-2 py-0.5 rounded bg-white border border-[#c9c7b6] text-[10px] font-semibold text-[#494900]"
                        >
                          {aud}
                        </span>
                      ))}
                    </div>

                    <div className="text-[11px] text-[#797869] flex items-center gap-3 pt-1">
                      <span>By {ann.author}</span>
                      <span>Date: {ann.date}</span>
                    </div>
                  </div>

                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(ann)}
                      className="h-10 w-10 rounded-lg border border-[#c9c7b6] bg-white hover:bg-rose-50 hover:text-rose-700 text-[#44443b] inline-flex items-center justify-center shrink-0 cursor-pointer"
                      title="Delete Notice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-10 text-center text-xs text-[#797869]">
            <Megaphone className="w-8 h-8 mx-auto mb-2 text-[#c9c7b6]" />
            No announcements available in this view.
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalAnnouncements}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Publish Class Announcement"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate}>
              Publish
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. SSS 2 Mathematics Revision Session"
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Category</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                <option value="general">General</option>
                <option value="test">Test & CA Notice</option>
                <option value="event">Event</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#1c1c14] block">Target Audience</label>
            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
              {TEACHER_AUDIENCE_OPTIONS.map((aud) => (
                <label
                  key={aud}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                    form.targetAudiences.includes(aud)
                      ? 'bg-[#faf8f0] border-[#616218] font-semibold text-[#1c1c14]'
                      : 'bg-white border-[#c9c7b6] text-[#44443b]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.targetAudiences.includes(aud)}
                    onChange={() => toggleAudience(aud)}
                    className="w-4 h-4 accent-[#616218] rounded"
                  />
                  <span>{aud}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Message</label>
            <textarea
              rows={4}
              required
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Write your announcement message..."
              className="w-full p-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-[#1c1c14] cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
              className="w-4 h-4 accent-[#616218] rounded"
            />
            <span>Pin to top of class notices</span>
          </label>
        </form>
      </Modal>

      <Modal
        variant="confirm"
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Announcement"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-xs text-[#44443b]">
          Are you sure you want to delete <strong>{confirmDelete?.title}</strong>?
        </p>
      </Modal>
    </div>
  );
}

export default StaffAnnouncements;
