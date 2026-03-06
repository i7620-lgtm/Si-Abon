import React, { useEffect, useState } from 'react';
import { User, AttendanceLog } from '../types';
import { api } from '../services/api';
import { Clock, Calendar, AlertCircle, CheckCircle, ThumbsUp, AlertTriangle } from 'lucide-react';

interface DashboardPanelProps {
  user: User;
  setActiveTab: (tab: string) => void;
}

export default function DashboardPanel({ user, setActiveTab }: DashboardPanelProps) {
  const isAdmin = ['admin', 'headmaster', 'dinas'].includes(user.role);
  const [todayLog, setTodayLog] = useState<AttendanceLog[]>([]);
  const [lateCount, setLateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [allCompliance, setAllCompliance] = useState<{name: string, late: number}[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const [todayLogs, allLogs] = await Promise.all([
        api.getAttendance({ user_id: user.id, start_date: today, end_date: today }),
        api.getAttendance({ user_id: user.id }) // Fetch all history for compliance
      ]);
      
      setTodayLog(todayLogs);
      
      // Calculate compliance (number of late arrivals and early departures)
      const nonCompliant = allLogs.filter(l => l.is_late).length;
      setLateCount(nonCompliant);

      if (isAdmin) {
        const leaves = await api.getLeaves();
        setPendingLeaves(leaves.filter((l: any) => l.status === 'pending'));

        // Calculate all compliance
        const users = await api.getUsers();
        const complianceData = [];
        for (const u of users) {
           const uLogs = await api.getAttendance({ user_id: u.id });
           const uNonCompliant = uLogs.filter(l => l.is_late).length;
           complianceData.push({ name: u.name, late: uNonCompliant });
        }
        setAllCompliance(complianceData.sort((a, b) => b.late - a.late).slice(0, 5));
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const inTime = todayLog.find(l => l.type === 'IN');
  const outTime = todayLog.find(l => l.type === 'OUT');

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Halo, {user.name.split(' ')[0]}! 👋</h1>
        <p className="text-slate-500">Selamat datang di Si-Abon. Semangat bekerja hari ini!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Jam Masuk */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jam Masuk</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {inTime ? new Date(inTime.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${inTime ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              <Clock size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            {inTime ? 'Sudah absen masuk' : 'Belum absen masuk'}
          </p>
        </div>

        {/* Card 2: Jam Keluar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jam Keluar</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {outTime ? new Date(outTime.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${outTime ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
              <LogOutIcon size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            {outTime ? 'Sudah absen pulang' : 'Belum absen pulang'}
          </p>
        </div>

        {/* Card 3: Sisa Cuti */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sisa Cuti</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{user.leave_quota || 0} Hari</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
              <Calendar size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-400">Gunakan dengan bijak</p>
        </div>

        {/* Card 4: Kepatuhan */}
        <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between h-32 ${lateCount === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${lateCount === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                Kepatuhan
              </p>
              <p className={`text-lg font-bold mt-1 leading-tight ${lateCount === 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                {lateCount === 0 ? 'Luar Biasa!' : `${lateCount}x Terlambat`}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${lateCount === 0 ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>
              {lateCount === 0 ? <ThumbsUp size={20} /> : <AlertTriangle size={20} />}
            </div>
          </div>
          <p className={`text-xs ${lateCount === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {lateCount === 0 ? 'Pertahankan disiplin Anda!' : 'Tingkatkan kedisiplinan Anda!'}
          </p>
        </div>
      </div>
      
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-orange-500" />
              Permintaan Cuti Pending
            </h3>
            {pendingLeaves.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Tidak ada permintaan cuti baru.</p>
            ) : (
              <div className="space-y-3">
                {pendingLeaves.slice(0, 3).map((leave: any) => (
                  <div key={leave.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm text-slate-800">{leave.name}</p>
                        <p className="text-xs text-slate-500">{new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-600 mt-1 italic">"{leave.reason}"</p>
                      </div>
                      <button 
                        onClick={() => setActiveTab('leave')}
                        className="text-xs bg-white border border-slate-200 px-2 py-1 rounded text-emerald-600 font-medium hover:bg-emerald-50"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))}
                {pendingLeaves.length > 3 && (
                  <button onClick={() => setActiveTab('leave')} className="text-xs text-emerald-600 font-medium hover:underline w-full text-center mt-2">
                    Lihat {pendingLeaves.length - 3} lainnya...
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LogOutIcon({ size }: { size: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}
