import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, LeaveRequest } from '../types';
import { Calendar, CheckCircle, XCircle, Clock, MessageSquare, Bell } from 'lucide-react';

export default function LeavePanel({ user }: { user: User }) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newLeave, setNewLeave] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [showReasonModal, setShowReasonModal] = useState<{id: number, status: string} | null>(null);
  const [adminReason, setAdminReason] = useState('');
  const [notifications, setNotifications] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    loadLeaves();
  }, []);

  const loadLeaves = async () => {
    const data = await api.getLeaves(user.role === 'admin' || user.role === 'headmaster' ? undefined : user.id);
    setLeaves(data);

    // Check for unread notifications for the current user
    if (user.role === 'employee' || user.role === 'admin') {
      const unread = data.filter((l: LeaveRequest) => 
        l.user_id === user.id && 
        (l.status === 'diterima' || l.status === 'ditolak') && 
        !l.is_read
      );
      setNotifications(unread);
    }
  };

  const handleMarkRead = async () => {
    for (const notif of notifications) {
      await api.markLeaveRead(notif.id);
    }
    setNotifications([]);
    loadLeaves();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.requestLeave({
        user_id: user.id,
        ...newLeave
      });
      setIsCreating(false);
      setNewLeave({ start_date: '', end_date: '', reason: '' });
      loadLeaves();
    } catch (e) {
      alert('Gagal mengajukan cuti');
    }
  };

  const handleStatusUpdate = async () => {
    if (!showReasonModal) return;
    try {
      await api.updateLeaveStatus(showReasonModal.id, showReasonModal.status, adminReason);
      setShowReasonModal(null);
      setAdminReason('');
      loadLeaves();
    } catch (e) {
      alert('Gagal update status');
    }
  };

  const canApprove = (requesterRole: string) => {
    if (user.role === 'headmaster') return true;
    if (user.role === 'admin' && requesterRole === 'employee') return true;
    return false;
  };

  return (
    <div className="p-6 h-full overflow-y-auto relative">
      {/* Notification Modal */}
      {notifications.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4 text-emerald-600">
              <Bell size={24} />
              <h3 className="text-lg font-bold text-slate-800">Update Status Cuti</h3>
            </div>
            <div className="space-y-4 mb-6">
              {notifications.map(n => (
                <div key={n.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="font-medium text-slate-800">
                    Pengajuan cuti tanggal {new Date(n.start_date).toLocaleDateString()} telah 
                    <span className={`font-bold mx-1 ${n.status === 'diterima' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {n.status.toUpperCase()}
                    </span>
                  </p>
                  {n.admin_reason && (
                    <p className="text-sm text-slate-500 mt-1 italic">"Catatan: {n.admin_reason}"</p>
                  )}
                </div>
              ))}
            </div>
            <button 
              onClick={handleMarkRead}
              className="w-full py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {showReasonModal.status === 'diterima' ? 'Setujui Pengajuan' : 'Tolak Pengajuan'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Silakan berikan alasan atau catatan untuk keputusan ini.
            </p>
            <textarea 
              className="w-full p-3 border border-slate-200 rounded-lg mb-4 focus:ring-2 focus:ring-emerald-500 outline-none"
              rows={3}
              placeholder="Contoh: Disetujui, selamat berlibur."
              value={adminReason}
              onChange={e => setAdminReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button 
                onClick={() => { setShowReasonModal(null); setAdminReason(''); }}
                className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
              >
                Batal
              </button>
              <button 
                onClick={handleStatusUpdate}
                className={`flex-1 py-2 text-white rounded-lg font-medium ${
                  showReasonModal.status === 'diterima' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Pengajuan Cuti</h2>
        <div className="text-right">
          <p className="text-sm text-slate-500">Sisa Kuota Cuti</p>
          <p className="text-2xl font-bold text-emerald-600">{user.leave_quota || 0} Hari</p>
        </div>
      </div>

      {!isCreating ? (
        <button 
          onClick={() => setIsCreating(true)}
          className="mb-6 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          + Ajukan Cuti Baru
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <h3 className="font-bold text-slate-800 mb-4">Form Pengajuan Cuti</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tanggal Mulai</label>
              <input 
                type="date" 
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                value={newLeave.start_date}
                onChange={e => setNewLeave({...newLeave, start_date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tanggal Selesai</label>
              <input 
                type="date" 
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                value={newLeave.end_date}
                onChange={e => setNewLeave({...newLeave, end_date: e.target.value})}
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">Alasan Cuti</label>
            <textarea 
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              rows={3}
              value={newLeave.reason}
              onChange={e => setNewLeave({...newLeave, reason: e.target.value})}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">Batal</button>
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">Kirim Pengajuan</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {leaves.map((leave: any) => (
          <div key={leave.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    leave.status === 'diterima' ? 'bg-emerald-100 text-emerald-700' :
                    leave.status === 'ditolak' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {leave.status}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(leave.created_at).toLocaleDateString()}</span>
                </div>
                {(user.role === 'admin' || user.role === 'headmaster') && (
                  <p className="font-bold text-slate-800">
                    {leave.name} 
                    <span className="text-slate-400 font-normal text-xs ml-1">
                      ({leave.role === 'employee' ? 'Pegawai' : leave.role === 'headmaster' ? 'Kepala Sekolah' : leave.role})
                    </span>
                  </p>
                )}
                <p className="text-sm font-medium text-slate-700">
                  {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                </p>
                <p className="text-sm text-slate-500 mt-1">"{leave.reason}"</p>
                {leave.admin_reason && (
                  <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-100 text-slate-600 flex gap-2 items-start">
                    <MessageSquare size={14} className="mt-0.5 flex-shrink-0" />
                    <span><span className="font-bold">Catatan Admin:</span> {leave.admin_reason}</span>
                  </div>
                )}
              </div>
              
              {leave.status === 'pending' && canApprove(leave.role) && (
                <div className="flex gap-2 ml-4">
                  <button 
                    onClick={() => setShowReasonModal({id: leave.id, status: 'diterima'})} 
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" 
                    title="Setujui"
                  >
                    <CheckCircle size={24} />
                  </button>
                  <button 
                    onClick={() => setShowReasonModal({id: leave.id, status: 'ditolak'})} 
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                    title="Tolak"
                  >
                    <XCircle size={24} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {leaves.length === 0 && <p className="text-center text-slate-500 py-8">Belum ada data cuti.</p>}
      </div>
    </div>
  );
}
