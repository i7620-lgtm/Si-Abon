import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, AttendanceCorrection } from '../types';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

export default function CorrectionPanel({ user }: { user: User }) {
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCorrection, setNewCorrection] = useState({
    date: '',
    type: 'IN',
    reason: ''
  });

  useEffect(() => {
    loadCorrections();
  }, []);

  const loadCorrections = async () => {
    const data = await api.getCorrections(user.role === 'admin' || user.role === 'headmaster' ? undefined : user.id);
    setCorrections(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.requestCorrection({
        user_id: user.id,
        ...newCorrection
      });
      setIsCreating(false);
      setNewCorrection({ date: '', type: 'IN', reason: '' });
      loadCorrections();
    } catch (e) {
      alert('Gagal mengajukan koreksi');
    }
  };

  const handleVerify = async (id: number, status: string) => {
    try {
      await api.verifyCorrection(id, status, user.id);
      loadCorrections();
    } catch (e) {
      alert('Gagal verifikasi');
    }
  };

  const isAdmin = user.role === 'admin' || user.role === 'headmaster';

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Koreksi Absensi (Lupa Absen)</h2>
      </div>

      {!isCreating ? (
        <button 
          onClick={() => setIsCreating(true)}
          className="mb-6 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          + Laporkan Lupa Absen
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <h3 className="font-bold text-slate-800 mb-4">Form Lupa Absen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tanggal</label>
              <input 
                type="date" 
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                value={newCorrection.date}
                onChange={e => setNewCorrection({...newCorrection, date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tipe Absen</label>
              <select 
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                value={newCorrection.type}
                onChange={e => setNewCorrection({...newCorrection, type: e.target.value})}
              >
                <option value="IN">Masuk</option>
                <option value="OUT">Pulang</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">Alasan</label>
            <textarea 
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              rows={3}
              value={newCorrection.reason}
              onChange={e => setNewCorrection({...newCorrection, reason: e.target.value})}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">Batal</button>
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">Kirim Laporan</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {corrections.map((corr: any) => (
          <div key={corr.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    corr.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                    corr.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {corr.status}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(corr.created_at).toLocaleDateString()}</span>
                </div>
                {isAdmin && <p className="font-bold text-slate-800">{corr.name} <span className="text-slate-400 font-normal text-xs">({corr.role})</span></p>}
                <p className="text-sm font-medium text-slate-700">
                  {new Date(corr.date).toLocaleDateString()} - {corr.type === 'IN' ? 'Masuk' : 'Pulang'}
                </p>
                <p className="text-sm text-slate-500 mt-1">{corr.reason}</p>
              </div>
              
              {isAdmin && corr.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleVerify(corr.id, 'verified')} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Verifikasi">
                    <CheckCircle size={20} />
                  </button>
                  <button onClick={() => handleVerify(corr.id, 'rejected')} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Tolak">
                    <XCircle size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {corrections.length === 0 && <p className="text-center text-slate-500 py-8">Belum ada data koreksi.</p>}
      </div>
    </div>
  );
}
