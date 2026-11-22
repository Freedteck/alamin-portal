import React, { useState, useEffect } from 'react';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { ProfileAvatar } from '../../../shared/components/ProfileAvatar/ProfileAvatar';
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar,
  Send,
  Check,
  X,
  FileText,
  HelpCircle,
  CalendarCheck
} from 'lucide-react';
import { schoolStore, subscribeSchoolSync } from '../../../shared/data/schoolData';

export function StaffStudentRequests() {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const loadRequests = async () => {
    try {
      const list = await schoolStore.fetchRequests();
      setRequests(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to load student requests:', error);
      setRequests([]);
    }
  };

  useEffect(() => {
    loadRequests();
    return subscribeSchoolSync(loadRequests);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleQuickStatusChange = (requestId, newStatus) => {
    schoolStore.updateRequestStatus(requestId, newStatus);
    loadRequests();
    showToast(`Request ${newStatus === 'approved' ? 'Approved' : 'Declined'} successfully.`);
  };

  const handleDetailedResponse = (action) => {
    if (!selectedRequest) return;
    const finalStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'completed';
    schoolStore.updateRequestStatus(selectedRequest.id, finalStatus, responseText);
    loadRequests();
    showToast(`Response dispatched to ${selectedRequest.studentName}. Status: ${finalStatus.toUpperCase()}`);
    setSelectedRequest(null);
    setResponseText('');
  };

  const filteredRequests = requests.filter((req) => {
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
    const matchesType = filterType === 'all' || req.requestType === filterType;
    const matchesSearch =
      req.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.admissionNumber && req.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      req.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const highPriorityPending = requests.filter((r) => r.priority === 'high' && r.status === 'pending').length;

  const getTypeBadge = (type) => {
    switch (type) {
      case 'booking':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 shadow-xs">
            <CalendarCheck className="w-3 h-3 text-sky-600" />
            <span>Consultation</span>
          </span>
        );
      case 'help':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
            <HelpCircle className="w-3 h-3 text-emerald-600" />
            <span>Extra Help</span>
          </span>
        );
      case 'clarification':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200 shadow-xs">
            <MessageSquare className="w-3 h-3 text-purple-600" />
            <span>Clarification</span>
          </span>
        );
      case 'makeup':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Makeup Session</span>
          </span>
        );
      case 'resource':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-xs">
            <FileText className="w-3 h-3 text-indigo-600" />
            <span>Syllabus Material</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-800 border border-stone-200">
            <span>Inquiry</span>
          </span>
        );
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>High Priority</span>
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
            <span>Medium Priority</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 shadow-xs">
            <span>Low Priority</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pending Review</span>
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Approved</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            <span>Completed</span>
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Student Consultations & Help Requests
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Review and respond to Al-Amin secondary school students for tutoring, syllabus clarifications, and test prep
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {highPriorityPending > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{highPriorityPending} Urgent Requests</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#fdf9ec] text-[#494900] border border-[#c9c7b6] shadow-xs">
            <Clock className="w-4 h-4 text-[#616218]" />
            <span>{pendingCount} Awaiting Review</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
          <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">Total Received</span>
          <div className="text-2xl font-bold text-[#1c1c14] tabular-nums mt-1">{requests.length}</div>
          <span className="text-[11px] text-[#616218] font-medium">All academic terms</span>
        </div>
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
          <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">Pending Action</span>
          <div className="text-2xl font-bold text-amber-700 tabular-nums mt-1">{pendingCount}</div>
          <span className="text-[11px] text-amber-600 font-medium">Requires teacher response</span>
        </div>
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
          <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">Approved / Scheduled</span>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
            {requests.filter((r) => r.status === 'approved' || r.status === 'completed').length}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Coaching confirmed</span>
        </div>
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
          <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">Response Rate</span>
          <div className="text-2xl font-bold text-[#494900] tabular-nums mt-1">
            {requests.length > 0
              ? Math.round(((requests.length - pendingCount) / requests.length) * 100)
              : 100}
            %
          </div>
          <span className="text-[11px] text-[#797869]">Staff response rate</span>
        </div>
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <SearchInput
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by student name, admission number, or topic..."
            />
          </div>
          <div className="w-full sm:w-44 shrink-0">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="rejected">Declined</option>
            </select>
          </div>
          <div className="w-full sm:w-48 shrink-0">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              <option value="all">All Inquiries</option>
              <option value="booking">Consultation Booking</option>
              <option value="help">Extra Help</option>
              <option value="clarification">Clarification</option>
              <option value="makeup">Makeup Practical</option>
              <option value="resource">Syllabus Resource</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-12 text-center shadow-xs">
            <MessageSquare className="w-12 h-12 text-[#c9c7b6] mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#1c1c14]">No Student Requests Found</h3>
            <p className="text-xs text-[#797869] mt-1 max-w-md mx-auto">
              There are currently no inquiries matching your filter criteria. Adjust your search or filter options.
            </p>
          </div>
        ) : (
          <>
          {paginatedRequests.map((request) => {
            const isPending = request.status === 'pending';
            const isUrgent = request.priority === 'high' && isPending;

            return (
              <div
                key={request.id}
                className={`rounded-lg border bg-white p-5 sm:p-6 shadow-xs transition-all hover:border-[#616218]/50 ${
                  isUrgent
                    ? 'border-rose-300 ring-2 ring-rose-100 bg-[#fffdfd]'
                    : 'border-[#c9c7b6]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#c9c7b6]/40">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar src={request.avatarUrl} name={request.studentName} size="md" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-1 text-xs">
                      <div>
                        <span className="text-[10px] text-[#797869] block">Student</span>
                        <span className="font-bold text-[#1c1c14] text-sm">{request.studentName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#797869] block">Admission No</span>
                        <span className="font-mono font-bold text-[#494900]">{request.admissionNumber || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#797869] block">Class</span>
                        <span className="font-semibold text-[#616218]">
                          {request.class || request.studentClass || 'Secondary'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#797869] block">Subject & Date</span>
                        <span className="font-medium text-[#48482d]">
                          {request.subject} · {new Date(request.submittedDate).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {getTypeBadge(request.requestType)}
                    {getPriorityBadge(request.priority)}
                    {getStatusBadge(request.status)}
                  </div>
                </div>

                <div className="py-3 space-y-2">
                  <h3 className="text-sm font-bold text-[#1c1c14]">{request.title}</h3>
                  <p className="text-xs sm:text-sm text-[#48482d] leading-relaxed">
                    {request.message || request.description}
                  </p>

                  {(request.preferredDate || request.requestedDate || request.preferredTime || request.requestedTime) && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-800 text-xs border border-sky-200 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-sky-600" />
                      <span className="font-semibold">Requested Session:</span>
                      <span>
                        {(request.preferredDate || request.requestedDate) &&
                          new Date(request.preferredDate || request.requestedDate).toLocaleDateString('en-GB')}
                        {(request.preferredTime || request.requestedTime)
                          ? ` at ${request.preferredTime || request.requestedTime}`
                          : ''}
                      </span>
                    </div>
                  )}

                  {request.staffResponse && (
                    <div className="mt-3 p-3.5 rounded-lg bg-[#f9fbf4] border border-emerald-200 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Teacher Response Dispatched:</span>
                      </div>
                      <p className="text-emerald-900 leading-relaxed">{request.staffResponse}</p>
                      {request.responseDate && (
                        <div className="text-[11px] text-emerald-700">
                          Responded on {new Date(request.responseDate).toLocaleDateString('en-GB')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#c9c7b6]/30">
                  <span className="text-xs text-[#797869] font-mono">
                    {request.studentEmail || `${request.studentName.toLowerCase().replace(' ', '.')}@student.alaminschools.edu.ng`}
                  </span>

                  <div className="flex items-center gap-2">
                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(request.id, 'approved')}
                          className="h-10 px-4 text-xs font-semibold rounded-lg bg-[#616218] hover:bg-[#494900] text-white shadow-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(request.id, 'rejected')}
                          className="h-10 px-4 text-xs font-semibold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 shadow-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedRequest(request);
                        setResponseText(request.staffResponse || '');
                      }}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#616218]" />
                      <span>{isPending ? 'Write Response' : 'View Full Details'}</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
          }
          <Pagination
            currentPage={currentPage}
            totalItems={filteredRequests.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            itemLabel="requests"
          />
          </>
        )}
      </div>

      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Student Consultation & Response Desk"
        subtitle="Review student academic inquiry and dispatch teacher guidance"
        size="lg"
        footer={
          selectedRequest && (
            <div className="flex flex-wrap items-center justify-between gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => setSelectedRequest(null)}
              >
                Close
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDetailedResponse('reject')}
                  className="h-10 px-4 rounded-lg text-xs font-semibold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 shadow-xs inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  Decline Request
                </button>
                <button
                  type="button"
                  onClick={() => handleDetailedResponse('complete')}
                  className="h-10 px-4 rounded-lg text-xs font-semibold border border-[#c9c7b6] bg-white hover:bg-[#faf8f0] text-[#1c1c14] shadow-xs inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  Mark Completed
                </button>
                <button
                  type="button"
                  onClick={() => handleDetailedResponse('approve')}
                  className="h-10 px-4 rounded-lg text-xs font-semibold bg-[#616218] hover:bg-[#494900] text-white shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Response & Approve</span>
                </button>
              </div>
            </div>
          )
        }
      >
        {selectedRequest && (
          <div className="space-y-5 font-['Poppins',sans-serif]">
            <div className="p-4 rounded-xl bg-[#fdf9ec] border border-[#c9c7b6]/60 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ProfileAvatar src={selectedRequest.avatarUrl} name={selectedRequest.studentName} size="md" />
                  <div>
                    <h4 className="font-bold text-sm text-[#1c1c14]">{selectedRequest.studentName}</h4>
                    <span className="text-xs text-[#797869]">{selectedRequest.studentEmail}</span>
                  </div>
                </div>
                <div>{getStatusBadge(selectedRequest.status)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#c9c7b6]/40 text-xs">
                <div>
                  <span className="text-[#797869] block">Admission Number</span>
                  <span className="font-mono font-bold text-[#494900]">{selectedRequest.admissionNumber}</span>
                </div>
                <div>
                  <span className="text-[#797869] block">Class</span>
                  <span className="font-bold text-[#1c1c14]">
                    {selectedRequest.class || selectedRequest.studentClass || 'Secondary'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-[#c9c7b6]/50 bg-white space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#494900] uppercase tracking-wider">
                  {selectedRequest.subject}
                </span>
                <span className="text-[#797869]">
                  {new Date(selectedRequest.submittedDate).toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <h5 className="font-bold text-xs text-[#1c1c14]">{selectedRequest.title}</h5>
              <p className="text-xs text-[#48482d] leading-relaxed bg-[#faf8f0] p-3 rounded-lg border border-[#c9c7b6]/40">
                {selectedRequest.message || selectedRequest.description}
              </p>

              {(selectedRequest.preferredDate ||
                selectedRequest.requestedDate ||
                selectedRequest.preferredTime ||
                selectedRequest.requestedTime) && (
                <div className="text-xs p-2.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-sky-600" />
                  <span className="font-semibold">Student Requested Schedule:</span>
                  <span>
                    {(selectedRequest.preferredDate || selectedRequest.requestedDate) &&
                      new Date(
                        selectedRequest.preferredDate || selectedRequest.requestedDate
                      ).toLocaleDateString('en-GB')}
                    {(selectedRequest.preferredTime || selectedRequest.requestedTime)
                      ? ` at ${selectedRequest.preferredTime || selectedRequest.requestedTime}`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#1c1c14]">
                Teacher Feedback & Consultation Notes
              </label>
              <textarea
                rows={4}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Type your response, schedule instructions, or study advice for the student..."
                className="w-full px-3 py-2.5 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default StaffStudentRequests;
