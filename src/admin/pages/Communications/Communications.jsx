import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Mail,
  Send,
  Plus,
  Users,
  CheckCircle2,
  Trash2,
  Pin
} from 'lucide-react';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { schoolStore, SCHOOL_CLASSES, subscribeSchoolSync } from '../../../shared/data/schoolData';

const AUDIENCE_OPTIONS = [
  'Everyone',
  'Teaching Staff',
  'All Students',
  'Parents',
  ...SCHOOL_CLASSES
];

export function AdminCommunications() {
  const [activeTab, setActiveTab] = useState('announcements');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAudience, setFilterAudience] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
  const announcementRequest = useRef(0);

  const [announcements, setAnnouncements] = useState([]);
  const [totalAnnouncements, setTotalAnnouncements] = useState(0);
  const [recipients, setRecipients] = useState([]);
  const [recipientSearchTerm, setRecipientSearchTerm] = useState('');
  const [isAddAnnOpen, setIsAddAnnOpen] = useState(false);
  const [confirmDeleteAnn, setConfirmDeleteAnn] = useState(null);
  const [toast, setToast] = useState(null);

  const [messages, setMessages] = useState([]);

  const loadMessages = async () => {
    try {
      const res = await schoolStore.getDirectMessages();
      if (Array.isArray(res)) setMessages(res);
    } catch {}
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const [annForm, setAnnForm] = useState({
    title: '',
    content: '',
    type: 'general',
    priority: 'medium',
    targetAudiences: ['Everyone'],
    isPinned: false,
    eventDate: '',
    eventTime: '',
    location: ''
  });

  const [msgForm, setMsgForm] = useState({
    recipient: '',
    subject: '',
    content: ''
  });

  const refreshData = async () => {
    const requestId = ++announcementRequest.current;
    try {
      const announcementsRes = await schoolStore.fetchAnnouncements({
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        audience: filterAudience
      });
      if (requestId !== announcementRequest.current) return;
      setAnnouncements(Array.isArray(announcementsRes?.data) ? announcementsRes.data : []);
      setTotalAnnouncements(announcementsRes?.total || 0);
    } catch (error) {
      if (requestId !== announcementRequest.current) return;
      console.error('Failed to load announcements:', error);
      setAnnouncements([]);
      setTotalAnnouncements(0);
    }
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = subscribeSchoolSync(refreshData);
    return () => {
      announcementRequest.current += 1;
      unsubscribe();
    };
  }, [currentPage, searchTerm, filterAudience]);

  useEffect(() => {
    let active = true;
    const loadRecipients = async () => {
      try {
        const [teachersRes, studentsRes] = await Promise.all([
          schoolStore.fetchTeachers({ page: 1, limit: 100, search: recipientSearchTerm }),
          schoolStore.fetchStudents({ page: 1, limit: 100, search: recipientSearchTerm })
        ]);
        if (!active) return;
        const teachers = (Array.isArray(teachersRes) ? teachersRes : teachersRes?.data || [])
          .map((teacher) => ({ name: teacher.name, role: 'Teacher' }));
        const students = (Array.isArray(studentsRes) ? studentsRes : studentsRes?.data || [])
          .map((student) => ({ name: student.name, role: student.class }));
        setRecipients([
          { name: 'All Teaching Staff', role: 'Group' },
          { name: 'All Parents', role: 'Group' },
          ...teachers,
          ...students
        ]);
      } catch (error) {
        if (!active) return;
        console.error('Failed to load communication recipients:', error);
        setRecipients([]);
      }
    };
    loadRecipients();
    const unsubscribe = subscribeSchoolSync(loadRecipients);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [recipientSearchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterAudience, activeTab]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleAudience = (aud) => {
    setAnnForm((prev) => {
      if (aud === 'Everyone') {
        return { ...prev, targetAudiences: ['Everyone'] };
      }
      const cleaned = prev.targetAudiences.filter((a) => a !== 'Everyone');
      const exists = cleaned.includes(aud);
      const next = exists ? cleaned.filter((a) => a !== aud) : [...cleaned, aud];
      return {
        ...prev,
        targetAudiences: next.length > 0 ? next : ['Everyone']
      };
    });
  };

  const handlePublishAnnouncement = (e) => {
    e.preventDefault();
    if (!annForm.title.trim() || !annForm.content.trim()) {
      showToast('Please provide announcement title and message.');
      return;
    }

    schoolStore.addAnnouncement({
      title: annForm.title.trim(),
      content: annForm.content.trim(),
      type: annForm.type,
      priority: annForm.priority,
      targetAudiences: annForm.targetAudiences,
      isPinned: annForm.isPinned,
      eventDate: annForm.eventDate || undefined,
      eventTime: annForm.eventTime || undefined,
      location: annForm.location || undefined,
      author: 'School Administration',
      authorRole: 'Admin Office',
      status: 'published'
    });

    setAnnForm({
      title: '',
      content: '',
      type: 'general',
      priority: 'medium',
      targetAudiences: ['Everyone'],
      isPinned: false,
      eventDate: '',
      eventTime: '',
      location: ''
    });
    setIsAddAnnOpen(false);
    refreshData();
    showToast('Announcement published to selected school portals.');
  };

  const handleTogglePin = (ann) => {
    schoolStore.updateAnnouncement(ann.id, { isPinned: !ann.isPinned });
    refreshData();
  };

  const handleDeleteAnnouncement = () => {
    if (!confirmDeleteAnn) return;
    schoolStore.deleteAnnouncement(confirmDeleteAnn.id);
    setConfirmDeleteAnn(null);
    refreshData();
    showToast('Announcement removed.');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgForm.recipient || !msgForm.subject.trim() || !msgForm.content.trim()) {
      showToast('Please complete recipient, subject, and message.');
      return;
    }
    const found = recipients.find((r) => r.name === msgForm.recipient);
    try {
      const created = await schoolStore.addDirectMessage({
        recipient: msgForm.recipient,
        role: found?.role || 'Recipient',
        subject: msgForm.subject.trim(),
        content: msgForm.content.trim(),
        sentDate: new Date().toISOString().split('T')[0],
        status: 'delivered'
      });
      setMessages((prev) => [created, ...prev]);
      setMsgForm({ recipient: '', subject: '', content: '' });
      showToast('Direct message dispatched and saved to database.');
    } catch (err) {
      showToast(err?.message || 'Failed to dispatch message.');
    }
  };

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
            Communications
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Publish school-wide notices to staff, parents, and student classes, or send direct dispatches.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsAddAnnOpen(true)}
          icon={<Plus className="w-4 h-4" />}
        >
          New Announcement
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#c9c7b6]/60 pb-2">
        {[
          { id: 'announcements', label: 'School Announcements', icon: Bell },
          { id: 'messages', label: 'Direct Messages', icon: Mail }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-10 px-4 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#616218] text-white shadow-xs'
                  : 'bg-white border border-[#c9c7b6] text-[#44443b] hover:bg-[#faf8f0]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-lg border border-[#c9c7b6] shadow-xs">
            <div className="w-full md:w-80">
              <SearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search announcements..."
              />
            </div>

            <select
              value={filterAudience}
              onChange={(e) => setFilterAudience(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            >
              <option value="all">All Audiences</option>
              <option value="Teaching Staff">Teaching Staff</option>
              <option value="All Students">All Students</option>
              <option value="Parents">Parents</option>
              {SCHOOL_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {announcements.length > 0 ? (
              announcements.map((ann) => {
                const targets = ann.targetAudiences || ann.targetAudience || ['Everyone'];
                return (
                  <div
                    key={ann.id}
                    className={`rounded-lg border p-5 shadow-xs transition-colors ${
                      ann.isPinned
                        ? 'bg-[#faf8f0] border-[#616218]'
                        : 'bg-white border-[#c9c7b6]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityBadge(
                              ann.priority
                            )}`}
                          >
                            {ann.priority || 'medium'}
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

                        <div className="text-[11px] text-[#797869] flex flex-wrap items-center gap-3 pt-1">
                          <span>By {ann.author || 'School Administration'}</span>
                          <span>Date: {ann.date}</span>
                          {ann.eventDate && <span>Event: {ann.eventDate}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          onClick={() => handleTogglePin(ann)}
                          icon={<Pin className="w-4 h-4" />}
                        >
                          {ann.isPinned ? 'Unpin' : 'Pin'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteAnn(ann)}
                          className="h-10 w-10 rounded-lg border border-[#c9c7b6] bg-white hover:bg-rose-50 hover:text-rose-700 text-[#44443b] inline-flex items-center justify-center transition-colors cursor-pointer"
                          title="Delete Announcement"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-[#c9c7b6] bg-white p-10 text-center text-xs text-[#797869]">
                No announcements found matching your selection.
              </div>
            )}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={totalAnnouncements}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#1c1c14]">Send Direct Dispatch</h2>
            <form onSubmit={handleSendMessage} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14] block">Recipient</label>
                <SearchInput
                  value={recipientSearchTerm}
                  onChange={(e) => setRecipientSearchTerm(e.target.value)}
                  placeholder="Search students and staff..."
                />
                <select
                  value={msgForm.recipient}
                  onChange={(e) => setMsgForm({ ...msgForm, recipient: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
                >
                  <option value="">Select Recipient...</option>
                  {recipients.map((r, idx) => (
                    <option key={idx} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14] block">Subject</label>
                <input
                  type="text"
                  value={msgForm.subject}
                  onChange={(e) => setMsgForm({ ...msgForm, subject: e.target.value })}
                  placeholder="Enter message subject"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14] block">Message</label>
                <textarea
                  rows={4}
                  value={msgForm.content}
                  onChange={(e) => setMsgForm({ ...msgForm, content: e.target.value })}
                  placeholder="Write your official message..."
                  className="w-full p-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
                />
              </div>

              <Button variant="primary" type="submit" fullWidth icon={<Send className="w-4 h-4" />}>
                Send Message
              </Button>
            </form>
          </div>

          <div className="lg:col-span-2 rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-[#1c1c14]">Sent Message Log</h2>
            {messages.length > 0 ? (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-lg border border-[#c9c7b6]/70 bg-[#faf8f0]/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#1c1c14]">{m.subject}</span>
                      <span className="text-[#797869]">{m.sentDate}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-[#616218]">
                      To: {m.recipient}
                    </div>
                    <p className="text-xs text-[#44443b]">{m.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-[#797869]">
                No direct messages sent yet.
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={isAddAnnOpen}
        onClose={() => setIsAddAnnOpen(false)}
        title="Publish School Announcement"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAddAnnOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handlePublishAnnouncement}>
              Publish Announcement
            </Button>
          </>
        }
      >
        <form onSubmit={handlePublishAnnouncement} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Title</label>
            <input
              type="text"
              required
              value={annForm.title}
              onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
              placeholder="e.g. Second Term Mid-Term Break Schedule"
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Category</label>
              <select
                value={annForm.type}
                onChange={(e) => setAnnForm({ ...annForm, type: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                <option value="general">General</option>
                <option value="event">School Event</option>
                <option value="test">Examination & CA</option>
                <option value="urgent">Urgent Notice</option>
                <option value="achievement">Achievement</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Priority</label>
              <select
                value={annForm.priority}
                onChange={(e) => setAnnForm({ ...annForm, priority: e.target.value })}
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
              {AUDIENCE_OPTIONS.map((aud) => (
                <label
                  key={aud}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                    annForm.targetAudiences.includes(aud)
                      ? 'bg-[#faf8f0] border-[#616218] font-semibold text-[#1c1c14]'
                      : 'bg-white border-[#c9c7b6] text-[#44443b]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={annForm.targetAudiences.includes(aud)}
                    onChange={() => toggleAudience(aud)}
                    className="w-4 h-4 accent-[#616218] rounded"
                  />
                  <span>{aud}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Event Date</label>
              <input
                type="date"
                value={annForm.eventDate}
                onChange={(e) => setAnnForm({ ...annForm, eventDate: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Event Time</label>
              <input
                type="text"
                value={annForm.eventTime}
                onChange={(e) => setAnnForm({ ...annForm, eventTime: e.target.value })}
                placeholder="e.g. 09:00 AM"
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Message</label>
            <textarea
              rows={4}
              required
              value={annForm.content}
              onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })}
              placeholder="Write the full announcement details..."
              className="w-full p-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-[#1c1c14] cursor-pointer">
            <input
              type="checkbox"
              checked={annForm.isPinned}
              onChange={(e) => setAnnForm({ ...annForm, isPinned: e.target.checked })}
              className="w-4 h-4 accent-[#616218] rounded"
            />
            <span>Pin to top of notice board</span>
          </label>
        </form>
      </Modal>

      <Modal
        variant="confirm"
        isOpen={!!confirmDeleteAnn}
        onClose={() => setConfirmDeleteAnn(null)}
        title="Delete Announcement"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDeleteAnn(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteAnnouncement}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-xs text-[#44443b]">
          Remove <strong>{confirmDeleteAnn?.title}</strong> from school notice boards?
        </p>
      </Modal>
    </div>
  );
}

export default AdminCommunications;
