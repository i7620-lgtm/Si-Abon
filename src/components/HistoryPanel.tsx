import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, AttendanceLog } from '../types';
import { format } from 'date-fns';

export default function HistoryPanel({ user }: { user: User }) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);

  useEffect(() => {
    api.getAttendance({ user_id: user.id }).then(setLogs);
  }, [user.id]);

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Riwayat Absensi</h2>
      <div className="space-y-4">
        {logs.length === 0 && <p className="text-slate-500">Belum ada data absensi.</p>}
        {logs.map(log => (
          <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-400">
              {log.photo_url ? (
                <img src={log.photo_url} alt="Log" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold">{log.type}</span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  log.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 
                  log.type === 'OUT' ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {log.type === 'IN' ? 'Masuk' : log.type === 'OUT' ? 'Pulang' : log.type}
                </span>
                <span className="text-xs text-slate-400">
                  {format(new Date(log.timestamp), 'dd MMM yyyy')}
                </span>
              </div>
              <p className="text-lg font-mono font-medium text-slate-800">
                {format(new Date(log.timestamp), 'HH:mm')}
              </p>
              {log.notes ? (
                <p className="text-xs text-slate-600 italic mt-1">
                  "{log.notes}"
                </p>
              ) : (
                <p className="text-xs text-slate-500 truncate max-w-[200px]">
                  {log.lat.toFixed(6)}, {log.lng.toFixed(6)}
                </p>
              )}
            </div>
            {log.is_late && log.type === 'IN' && (
              <div className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded font-medium">
                Terlambat
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
