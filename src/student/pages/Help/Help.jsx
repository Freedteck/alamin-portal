import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../shared/components/Button/Button';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  PlusCircle,
  Calendar,
  Headphones,
  Send
} from 'lucide-react';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { schoolStore } from '../../../shared/data/schoolData';

export function StudentHelp() {
  const [activeTab, setActiveTab] = useState('contact');
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(4);

  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'Academic Support',
    priority: 'medium'
  });

  const [tickets, setTickets] = useState([]);

  const loadTickets = async () => {
    try {
      const res = await schoolStore.getHelpTickets();
      if (Array.isArray(res)) setTickets(res);
    } catch {}
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const contactInfo = [
    {
      type: 'Phone',
      icon: Phone,
      value: '+234 803 456 7890',
      description: 'Monday to Friday, 7:30 AM - 4:00 PM',
      action: 'Copy Number',
      onClick: () => {
        navigator.clipboard?.writeText('+234 803 456 7890');
        showToast('School helpdesk phone number copied to clipboard.');
      }
    },
    {
      type: 'Email',
      icon: Mail,
      value: 'support@alaminschools.edu.ng',
      description: 'We typically respond within 24 hours',
      action: 'Copy Email',
      onClick: () => {
        navigator.clipboard?.writeText('support@alaminschools.edu.ng');
        showToast('Support email copied to clipboard.');
      }
    },
    {
      type: 'Address',
      icon: MapPin,
      value: 'Al-Amin Campus, 14 Ahmadu Bello Way, Nassarawa GRA',
      description: 'Main Academic & Administrative Secretariat',
      action: 'View Location',
      onClick: () => {
        showToast('Main Secretariat is located at Block A, Ground Floor.');
      }
    }
  ];

  const officeHours = [
    { day: 'Monday - Thursday', hours: '7:30 AM - 4:00 PM' },
    { day: 'Friday', hours: '7:30 AM - 12:30 PM' },
    { day: 'Saturday & Sunday', hours: 'Closed' }
  ];

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim() || !newTicket.category) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    setErrorMsg('');
    try {
      const created = await schoolStore.addHelpTicket({
        subject: newTicket.subject.trim(),
        description: newTicket.description.trim(),
        category: newTicket.category,
        priority: newTicket.priority
      });
      setTickets((prev) => [created, ...prev]);
      setNewTicket({ subject: '', description: '', category: 'Academic Support', priority: 'medium' });
      setActiveTab('tickets');
      showToast('Support ticket submitted and stored in database! An advisor will respond shortly.');
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to submit support ticket.');
    }
  };

  const handleSendReply = async (ticketId) => {
    const text = (replyDrafts[ticketId] || '').trim();
    if (!text) return;

    try {
      const updated = await schoolStore.addHelpTicketReply(ticketId, text);
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: '' }));
      showToast('Reply sent and saved to database.');
    } catch (err) {
      showToast(err?.message || 'Failed to send reply.');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-3.5 h-3.5 text-sky-600" />;
      case 'in-progress':
        return <Clock className="w-3.5 h-3.5 text-amber-600" />;
      case 'resolved':
      case 'closed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'in-progress':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'resolved':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in-progress').length;
  const paginatedTickets = tickets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-12">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Student Support & Helpdesk
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Reach out to Al-Amin Group of Schools student advisors or submit a support ticket
          </p>
        </div>
        {openTickets > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            {openTickets} Open Ticket{openTickets !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex border-b border-[#c9c7b6]/60 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'contact'
                ? 'border-[#616218] text-[#494900] bg-[#faf8f0]/60'
                : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
            }`}
          >
            Contact Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'tickets'
                ? 'border-[#616218] text-[#494900] bg-[#faf8f0]/60'
                : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
            }`}
          >
            My Tickets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new-ticket')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'new-ticket'
                ? 'border-[#616218] text-[#494900] bg-[#faf8f0]/60'
                : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
            }`}
          >
            New Ticket
          </button>
        </div>

        {activeTab === 'contact' && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-[#c9c7b6] bg-white p-6 shadow-xs">
                <div className="mb-4 pb-2 border-b border-[#c9c7b6]/40">
                  <h3 className="font-bold text-base text-[#1c1c14] flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-[#616218]" />
                    <span>Get in Touch</span>
                  </h3>
                </div>
                <div className="space-y-3">
                  {contactInfo.map((contact, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3.5 border border-[#c9c7b6]/60 bg-[#faf8f0] rounded-lg"
                    >
                      <div className="w-9 h-9 bg-[#e7e78f]/50 rounded-lg flex items-center justify-center shrink-0">
                        <contact.icon className="w-4 h-4 text-[#494900]" />
                      </div>
                      <div className="flex-1 text-xs">
                        <h4 className="font-bold text-[#1c1c14]">{contact.type}</h4>
                        <p className="text-[#616218] font-semibold mt-0.5">{contact.value}</p>
                        <p className="text-[#797869] mt-0.5">{contact.description}</p>
                      </div>
                      <Button variant="outline" onClick={contact.onClick}>
                        {contact.action}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#c9c7b6] bg-white p-6 shadow-xs">
                <div className="mb-4 pb-2 border-b border-[#c9c7b6]/40">
                  <h3 className="font-bold text-base text-[#1c1c14] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#616218]" />
                    <span>Secretariat Office Hours</span>
                  </h3>
                </div>
                <div className="space-y-3 text-xs">
                  {officeHours.map((schedule, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center py-2.5 border-b border-[#c9c7b6]/40 last:border-b-0"
                    >
                      <span className="font-semibold text-[#1c1c14]">{schedule.day}</span>
                      <span className="text-[#797869]">{schedule.hours}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3.5 bg-[#faf8f0] border border-[#c9c7b6]/60 rounded-lg text-xs text-[#44443b]">
                  <strong>Urgent Academic Matters:</strong> Contact your form master directly or submit a high-priority support ticket.
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#c9c7b6] bg-white p-6 shadow-xs">
              <div className="mb-4 pb-2 border-b border-[#c9c7b6]/40">
                <h3 className="font-bold text-base text-[#1c1c14]">Quick Support Actions</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('new-ticket')}
                >
                  <PlusCircle className="w-4 h-4 text-[#616218]" />
                  <span>Create New Ticket</span>
                </Button>
                <Link
                  to="/student/bookings"
                  className="h-10 px-4 rounded-lg border border-[#c9c7b6] bg-white hover:bg-[#faf8f0] text-xs font-semibold text-[#1c1c14] shadow-xs inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-[#616218]" />
                  <span>Book Consultation</span>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => showToast('Callback request logged! Student Affairs will reach out shortly.')}
                >
                  <Phone className="w-4 h-4 text-[#616218]" />
                  <span>Request Callback</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {tickets.length === 0 ? (
              <div className="rounded-lg border border-[#c9c7b6] bg-white p-8 text-center shadow-xs">
                <h3 className="text-base font-bold mb-2">No Support Tickets</h3>
                <p className="text-xs text-[#797869] mb-4">You haven't created any support tickets yet.</p>
                <Button onClick={() => setActiveTab('new-ticket')}>Create Your First Ticket</Button>
              </div>
            ) : (
              <>
              {paginatedTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="rounded-lg border border-[#c9c7b6] bg-white p-6 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[#1c1c14]">{ticket.subject}</h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getPriorityColor(
                            ticket.priority
                          )}`}
                        >
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)} Priority
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#797869]">
                        <span>Created: {new Date(ticket.createdDate).toLocaleDateString('en-GB')}</span>
                        <span>· Category: {ticket.category}</span>
                        {ticket.assignedTo && <span>· Assigned: {ticket.assignedTo}</span>}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${getStatusColor(
                        ticket.status
                      )}`}
                    >
                      {getStatusIcon(ticket.status)}
                      <span>{ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1).replace('-', ' ')}</span>
                    </span>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-[#c9c7b6]/40">
                    {ticket.responses.map((response) => (
                      <div
                        key={response.id}
                        className={`flex gap-3 ${
                          response.authorType === 'student' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[82%] ${
                            response.authorType === 'student' ? 'order-2' : 'order-1'
                          }`}
                        >
                          <div
                            className={`p-3 rounded-lg text-xs leading-relaxed ${
                              response.authorType === 'student'
                                ? 'bg-[#616218] text-white'
                                : 'bg-[#faf8f0] text-[#1c1c14] border border-[#c9c7b6]/60'
                            }`}
                          >
                            {response.message}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-[#797869]">
                            <span className="font-semibold">{response.author}</span>
                            <span>•</span>
                            <span>{response.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {(ticket.status === 'open' || ticket.status === 'in-progress') && (
                    <div className="flex gap-2 pt-3 border-t border-[#c9c7b6]/40">
                      <input
                        type="text"
                        value={replyDrafts[ticket.id] || ''}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === 'Enter' && handleSendReply(ticket.id)}
                        placeholder="Type your reply..."
                        className="flex-1 h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      />
                      <Button
                        onClick={() => handleSendReply(ticket.id)}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Reply</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))
              }
              <Pagination
                currentPage={currentPage}
                totalItems={tickets.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[4, 8, 12]}
                itemLabel="tickets"
              />
              </>
            )}
          </div>
        )}

        {activeTab === 'new-ticket' && (
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-6 shadow-xs space-y-4">
            <div className="pb-2 border-b border-[#c9c7b6]/40">
              <h3 className="font-bold text-base text-[#1c1c14] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#616218]" />
                <span>Create New Support Ticket</span>
              </h3>
              <p className="text-xs text-[#797869] mt-0.5">
                Describe your academic, scheduling, or technical issue and our secretariat will assist you.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]">Subject *</label>
                <input
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  placeholder="Brief description of your issue"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]">Category *</label>
                <select
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  value={newTicket.category}
                  onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                >
                  <option value="Academic Support">Academic Support</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Scheduling">Scheduling</option>
                  <option value="Academic Records">Academic Records</option>
                  <option value="General Inquiry">General Inquiry</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-xs font-semibold text-[#1c1c14]">Priority</label>
              <select
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                value={newTicket.priority}
                onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-xs font-semibold text-[#1c1c14]">Description *</label>
              <textarea
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                placeholder="Provide clear details regarding your issue..."
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreateTicket}>Submit Ticket</Button>
              <Button
                variant="outline"
                onClick={() =>
                  setNewTicket({ subject: '', description: '', category: 'Academic Support', priority: 'medium' })
                }
              >
                Clear Form
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentHelp;
