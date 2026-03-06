import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, AttendanceLog } from '../types';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Printer, Download } from 'lucide-react';

export default function RecapPanel({ user }: { user: User }) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [filterRole, setFilterRole] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    api.getAttendance({ start_date: startDate, end_date: endDate }).then(setLogs);
  }, [startDate, endDate]);

  const filteredLogs = logs.filter(log => filterRole ? log.role === filterRole : true);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const input = document.getElementById('recap-table');
    if (input) {
      html2canvas(input).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('recap-absensi.pdf');
      });
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto print:p-0 print:overflow-visible">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:hidden">
        <select 
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
        >
          <option value="">Semua Role</option>
          <option value="employee">Pegawai</option>
          <option value="admin">Admin</option>
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

      <div id="recap-table" className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm print:border-none print:shadow-none">
        <div className="p-6 border-b border-slate-100 hidden print:block">
          <h1 className="text-2xl font-bold text-center mb-2">Laporan Absensi Pegawai</h1>
          <p className="text-center text-slate-500">Dicetak pada: {new Date().toLocaleString()}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Pegawai</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Jam</th>
                <th className="px-6 py-4">Tipe</th>
                <th className="px-6 py-4">Lokasi / Kantor</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-medium text-slate-900">{log.name}</td>
                  <td className="px-6 py-4 capitalize text-slate-500">{log.role}</td>
                  <td className="px-6 py-4 font-mono text-slate-600">
                    {format(new Date(log.timestamp), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600">
                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      log.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 
                      log.type === 'OUT' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {log.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    <div className="font-medium text-slate-700">{log.office_name || '-'}</div>
                    <div className="text-[10px] opacity-60">
                      {log.notes ? (
                        <span className="italic">"{log.notes}"</span>
                      ) : (
                        `${log.lat.toFixed(5)}, ${log.lng.toFixed(5)}`
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {log.type === 'IN' ? (
                      log.is_late ? (
                        <span className="text-red-600 font-medium text-xs">Terlambat</span>
                      ) : (
                        <span className="text-emerald-600 font-medium text-xs">Tepat Waktu</span>
                      )
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
