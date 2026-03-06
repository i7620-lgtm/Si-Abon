import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, AttendanceLog } from '../types';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Printer, Download } from 'lucide-react';

export default function RecapPanel({ user }: { user: User }) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filterRole, setFilterRole] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    api.getAttendance({ start_date: startDate, end_date: endDate }).then(setLogs);
    api.getUsers().then(setUsers);
  }, [startDate, endDate]);

  const filteredLogs = logs.filter(log => {
    const roleMatch = filterRole ? log.role === filterRole : true;
    const userMatch = filterUser ? log.user_id === parseInt(filterUser) : true;
    return roleMatch && userMatch;
  });

  const selectedUser = users.find(u => u.id === parseInt(filterUser));

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const input = document.getElementById('recap-table');
    if (input) {
      // Temporary fix for html2canvas oklch error by adding standard colors
      const style = document.createElement('style');
      style.innerHTML = `
        #recap-table { background-color: white !important; color: #1e293b !important; }
        #recap-table .bg-emerald-600 { background-color: #059669 !important; }
        #recap-table .text-emerald-700 { color: #047857 !important; }
        #recap-table .text-emerald-600 { color: #059669 !important; }
        #recap-table .bg-emerald-100 { background-color: #d1fae5 !important; }
        #recap-table .text-orange-700 { color: #c2410c !important; }
        #recap-table .text-orange-600 { color: #ea580c !important; }
        #recap-table .bg-orange-100 { background-color: #ffedd5 !important; }
        #recap-table .text-blue-700 { color: #1d4ed8 !important; }
        #recap-table .text-blue-600 { color: #2563eb !important; }
        #recap-table .bg-blue-100 { background-color: #dbeafe !important; }
        #recap-table .text-slate-900 { color: #0f172a !important; }
        #recap-table .text-slate-800 { color: #1e293b !important; }
        #recap-table .text-slate-700 { color: #334155 !important; }
        #recap-table .text-slate-600 { color: #475569 !important; }
        #recap-table .text-slate-500 { color: #64748b !important; }
        #recap-table .text-slate-400 { color: #94a3b8 !important; }
        #recap-table .border-slate-200 { border-color: #e2e8f0 !important; }
        #recap-table .border-slate-100 { border-color: #f1f5f9 !important; }
        #recap-table .bg-slate-50 { background-color: #f8fafc !important; }
        #recap-table .bg-slate-100 { background-color: #f1f5f9 !important; }
        #recap-table .text-white { color: white !important; }
        #recap-table .font-mono { font-family: monospace !important; }
      `;
      document.head.appendChild(style);

      html2canvas(input, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`recap-absensi-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        document.head.removeChild(style);
      }).catch(err => {
        console.error('PDF Export Error:', err);
        document.head.removeChild(style);
        alert('Gagal mengekspor PDF. Silakan gunakan fitur Print dan pilih "Save as PDF".');
      });
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto print:p-0 print:overflow-visible print:bg-white">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
        <h2 className="text-xl font-bold text-slate-800">Rekap Laporan Absensi</h2>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium">
            <Printer size={16} /> Print
          </button>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Download size={16} /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:hidden">
        <select 
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
        >
          <option value="">Semua Role</option>
          <option value="employee">Pegawai</option>
          <option value="admin">Admin</option>
          <option value="headmaster">Kepala Sekolah</option>
        </select>
        <select 
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm"
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
        >
          <option value="">Semua Pegawai</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <input 
          type="date" 
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
        />
        <input 
          type="date" 
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
        />
      </div>

      <div id="recap-table" className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none">
        {/* Professional Header for Print */}
        <div className="hidden print:block p-8 border-b-2 border-slate-900 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl">S</div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Si-Abon</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-semibold">Sistem Absensi Online</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">REKAPITULASI ABSENSI</h2>
              <p className="text-xs text-slate-500 font-medium">Dokumen Resmi Sistem Si-Abon</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-xs border-t border-slate-100 pt-6">
            <div className="space-y-2">
              <div className="flex justify-between border-b border-slate-50 pb-1">
                <span className="text-slate-400 font-medium">Nama Pegawai</span>
                <span className="font-bold text-slate-900">{selectedUser ? selectedUser.name : 'Semua Pegawai'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-1">
                <span className="text-slate-400 font-medium">Nama Kantor</span>
                <span className="font-bold text-slate-900">{selectedUser?.office_name || user.office_name || '-'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-slate-50 pb-1">
                <span className="text-slate-400 font-medium">Rentang Tanggal</span>
                <span className="font-bold text-slate-900">{startDate || 'Awal'} s/d {endDate || 'Akhir'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-1">
                <span className="text-slate-400 font-medium">Tanggal Cetak</span>
                <span className="font-bold text-slate-900">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left print:text-[9pt]">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 print:bg-slate-100 print:text-slate-900">
              <tr>
                <th className="px-6 py-4 print:px-3 print:py-3">Tanggal</th>
                <th className="px-6 py-4 print:px-3 print:py-3">Jam</th>
                <th className="px-6 py-4 print:px-3 print:py-3">Tipe</th>
                <th className="px-6 py-4 print:px-3 print:py-3">Lokasi / Kantor</th>
                <th className="px-6 py-4 print:px-3 print:py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-200">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50 print:hover:bg-transparent">
                  <td className="px-6 py-4 font-mono text-slate-600 print:px-3 print:py-3 print:text-slate-900">
                    {format(new Date(log.timestamp), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600 print:px-3 print:py-3 print:text-slate-900">
                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 print:px-3 print:py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold print:border print:bg-transparent ${
                      log.type === 'IN' ? 'bg-emerald-100 text-emerald-700 print:border-emerald-200 print:text-emerald-700' : 
                      log.type === 'OUT' ? 'bg-orange-100 text-orange-700 print:border-orange-200 print:text-orange-700' :
                      'bg-blue-100 text-blue-700 print:border-blue-200 print:text-blue-700'
                    }`}>
                      {log.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs print:px-3 print:py-3">
                    <div className="font-medium text-slate-700">{log.office_name || '-'}</div>
                    {log.notes && (
                      <div className="text-[10px] opacity-60 italic mt-1">
                        "{log.notes}"
                      </div>
                    )}
                    {!log.notes && (
                      <div className="text-[10px] opacity-60 print:hidden">
                        {log.lat.toFixed(5)}, {log.lng.toFixed(5)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 print:px-3 print:py-3">
                    {log.type === 'IN' ? (
                      log.is_late ? (
                        <span className="text-red-600 font-medium text-xs">Terlambat</span>
                      ) : (
                        <span className="text-emerald-600 font-medium text-xs">Tepat Waktu</span>
                      )
                    ) : (
                      log.is_late ? (
                        <span className="text-orange-600 font-medium text-xs">Mendahului</span>
                      ) : (
                        <span className="text-emerald-600 font-medium text-xs">Tepat Waktu</span>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signature Section for Print */}
        <div className="hidden print:grid grid-cols-2 gap-12 mt-16 px-12 pb-12">
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-16">Pegawai yang bersangkutan,</p>
            <div className="border-b border-slate-900 w-48 mx-auto mb-1"></div>
            <p className="text-sm font-bold text-slate-900">{selectedUser ? selectedUser.name : user.name}</p>
            <p className="text-[10px] text-slate-500">NIP: {selectedUser?.nip || user.nip || '________________'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-16">Kepala Sekolah / Atasan Langsung,</p>
            <div className="border-b border-slate-900 w-48 mx-auto mb-1"></div>
            <p className="text-sm font-bold text-slate-900">__________________________</p>
            <p className="text-[10px] text-slate-500">NIP: __________________________</p>
          </div>
        </div>
      </div>
    </div>
  );
}
