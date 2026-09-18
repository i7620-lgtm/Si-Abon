import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { User, AttendanceLog, Office } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  Printer, 
  Calendar, 
  CalendarDays, 
  Users, 
  User as UserIcon, 
  Building2, 
  RotateCcw, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Briefcase,
  Layers,
  Sparkles
} from 'lucide-react';

type PeriodMode = 'month' | 'day' | 'year' | 'custom' | 'all';

const MONTH_OPTIONS = [
  { value: 0, label: 'Januari' },
  { value: 1, label: 'Februari' },
  { value: 2, label: 'Maret' },
  { value: 3, label: 'April' },
  { value: 4, label: 'Mei' },
  { value: 5, label: 'Juni' },
  { value: 6, label: 'Juli' },
  { value: 7, label: 'Agustus' },
  { value: 8, label: 'September' },
  { value: 9, label: 'Oktober' },
  { value: 10, label: 'November' },
  { value: 11, label: 'Desember' },
];

export default function RecapPanel({ user }: { user: User }) {
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const todayStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter Modes
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // User & Role Filter
  const [filterRole, setFilterRole] = useState('');
  const [filterUser, setFilterUser] = useState('');

  // Calculate actual startDate and endDate based on periodMode
  const { startDate, endDate } = useMemo(() => {
    if (periodMode === 'day') {
      return { startDate: selectedDay, endDate: selectedDay };
    }
    if (periodMode === 'month') {
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const mStr = String(selectedMonth + 1).padStart(2, '0');
      return {
        startDate: `${selectedYear}-${mStr}-01`,
        endDate: `${selectedYear}-${mStr}-${String(lastDay).padStart(2, '0')}`
      };
    }
    if (periodMode === 'year') {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`
      };
    }
    if (periodMode === 'custom') {
      return {
        startDate: customStartDate,
        endDate: customEndDate
      };
    }
    // 'all'
    return { startDate: '', endDate: '' };
  }, [periodMode, selectedDay, selectedMonth, selectedYear, customStartDate, customEndDate]);

  // Generate dynamic year options (current year - 3 to current year + 2)
  const yearOptions = useMemo(() => {
    const list = [];
    for (let y = currentYear - 3; y <= currentYear + 2; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  // Fetch Attendance & Leaves
  useEffect(() => {
    setLoading(true);
    let qsStart = startDate;
    let qsEnd = endDate;

    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number);
      // 1 day buffer to safely accommodate all timezones when querying Supabase UTC
      const prevDate = new Date(y, m - 1, d - 1, 0, 0, 0);
      qsStart = prevDate.toISOString();
    }
    if (endDate) {
      const [y, m, d] = endDate.split('-').map(Number);
      // 1 day buffer
      const nextDate = new Date(y, m - 1, d + 1, 23, 59, 59);
      qsEnd = nextDate.toISOString();
    }

    Promise.all([
      api.getAttendance({ start_date: qsStart, end_date: qsEnd, current_user: user }),
      api.getLeaves(undefined, user),
      api.getUsers(user),
      api.getOffices()
    ]).then(([fetchedLogs, fetchedLeaves, fetchedUsers, fetchedOffices]) => {
      setUsers(fetchedUsers);
      setOffices(fetchedOffices);

      let combinedLogs = [...fetchedLogs];

      // Add synthetic logs for approved leaves
      fetchedLeaves.filter(l => l.status === 'diterima').forEach(leave => {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dStr = format(d, 'yyyy-MM-dd');
          // Check date bounds if filters are applied
          if (startDate && dStr < startDate) continue;
          if (endDate && dStr > endDate) continue;

          // Do not add leave on Sundays (day 0)
          if (d.getDay() === 0) continue;

          const timestamp = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0, 0).toISOString();

          combinedLogs.push({
            id: `leave_${leave.id}_${d.getTime()}` as any,
            user_id: leave.user_id,
            name: leave.users?.name || '',
            role: leave.users?.role || '',
            department: '',
            type: 'IZIN',
            timestamp,
            lat: 0,
            lng: 0,
            photo_url: '',
            is_late: false,
            notes: `CUTI: ${leave.reason}`,
            office_name: leave.users?.office_id ? `Kantor ID: ${leave.users.office_id}` : ''
          });
        }
      });

      const logsByUserAndDate = new Map();
      combinedLogs.forEach(log => {
        const logDate = new Date(log.timestamp);
        // CRITICAL: Format to local yyyy-MM-dd so timezones (WITA UTC+8) match the actual calendar date!
        const dateStr = format(logDate, 'yyyy-MM-dd');

        // STRICT MONTH / PERIOD BOUNDARY:
        // Exclude any log before startDate or after endDate!
        if (startDate && dateStr < startDate) return;
        if (endDate && dateStr > endDate) return;

        const key = `${log.user_id}_${dateStr}`;
        if (!logsByUserAndDate.has(key)) {
          logsByUserAndDate.set(key, []);
        }
        logsByUserAndDate.get(key).push(log);
      });

      let processedLogs: any[] = [];
      const todayDateStr = format(new Date(), 'yyyy-MM-dd');

      logsByUserAndDate.forEach((dayLogs, key) => {
        const [userIdStr, dateStr] = key.split('_');
        const [y, m, d] = dateStr.split('-').map(Number);
        const dayDate = new Date(y, m - 1, d);
        const dayOfWeek = dayDate.getDay(); // 0 is Sunday, 6 is Saturday

        // Determine user's office schedule and holidays
        const userObj = fetchedUsers.find((u: any) => u.id === Number(userIdStr));
        const userOfficeId = userObj?.office_id || user.office_id;
        const userOffice = fetchedOffices.find((o: any) => o.id === userOfficeId) || fetchedOffices[0];

        const scheduleForDay = userOffice?.schedule ? userOffice.schedule[dayOfWeek] : undefined;
        const isSunday = dayOfWeek === 0;
        const isOfficeDayOff = scheduleForDay ? Boolean(scheduleForDay.is_off) : (isSunday || dayOfWeek === 6);
        const isHoliday = (userOffice?.holidays || []).some((h: any) => h.date === dateStr);
        const isNonWorkingDay = isSunday || isOfficeDayOff || isHoliday;
        
        const hasSakit = dayLogs.some((l: any) => l.type === 'SAKIT');
        const hasIzin = dayLogs.some((l: any) => l.type === 'IZIN');
        const hasTugas = dayLogs.some((l: any) => l.type === 'TUGAS' && !l.notes?.startsWith('PIKET_SCHEDULE:::'));

        if (hasSakit || hasIzin || hasTugas) {
          // If non-working day, don't generate synthetic attendance; only keep piket if any
          if (isNonWorkingDay) {
            dayLogs.filter((l: any) => l.notes?.startsWith('PIKET')).forEach((l: any) => processedLogs.push(l));
            return;
          }

          const specialLog = dayLogs.find((l: any) => l.type === 'SAKIT' || l.type === 'IZIN' || (l.type === 'TUGAS' && !l.notes?.startsWith('PIKET_SCHEDULE:::')));
          
          processedLogs.push({ ...specialLog, id: `${specialLog.id}_IN`, timestamp: `${dateStr}T08:00:00`, _period: 'IN' });
          processedLogs.push({ ...specialLog, id: `${specialLog.id}_OUT`, timestamp: `${dateStr}T17:00:00`, _period: 'OUT' });
          
          dayLogs.filter((l: any) => l.notes?.startsWith('PIKET')).forEach((l: any) => processedLogs.push(l));
          return;
        }

        let inLogs = dayLogs.filter((l: any) => l.type === 'IN' && !l.notes?.startsWith('PIKET'));
        let outLogs = dayLogs.filter((l: any) => l.type === 'OUT' && !l.notes?.startsWith('PIKET'));
        
        // Deduplicate Lupa Absen - Prefer regular log over correction
        if (inLogs.length > 1) {
          const regularIn = inLogs.find((l: any) => l.notes !== 'Koreksi Absensi (Lupa Absen)');
          if (regularIn) inLogs = [regularIn];
          else inLogs = [inLogs[0]];
        }
        if (outLogs.length > 1) {
          const regularOut = outLogs.find((l: any) => l.notes !== 'Koreksi Absensi (Lupa Absen)');
          if (regularOut) outLogs = [regularOut];
          else outLogs = [outLogs[0]];
        }

        // On non-working days (Sunday, office day off, holiday):
        if (isNonWorkingDay) {
          // Only show actual logs or piket if any, NEVER generate missing attendance!
          inLogs.forEach((l: any) => processedLogs.push({ ...l, _period: 'IN' }));
          outLogs.forEach((l: any) => processedLogs.push({ ...l, _period: 'OUT' }));
          dayLogs.filter((l: any) => l.notes?.startsWith('PIKET')).forEach((l: any) => processedLogs.push(l));
          return;
        }

        inLogs.forEach((l: any) => processedLogs.push({ ...l, _period: 'IN' }));
        outLogs.forEach((l: any) => processedLogs.push({ ...l, _period: 'OUT' }));

        // Only generate missing attendance on working days (NOT Sunday, NOT Day Off, NOT Holiday)
        if (!isNonWorkingDay && dateStr <= todayDateStr) {
          const baseLog = inLogs[0] || outLogs[0];
          if (baseLog) {
            if (inLogs.length === 0) {
              processedLogs.push({
                ...baseLog,
                id: `missing_in_${key}`,
                type: 'IN',
                timestamp: `${dateStr}T08:00:00`,
                notes: 'TIDAK ABSENSI MASUK',
                is_late: true,
                _period: 'IN'
              });
            }
            // Only add TIDAK ABSENSI PULANG if it's a past date and they have clocked in
            if (outLogs.length === 0 && dateStr < todayDateStr) {
              processedLogs.push({
                ...baseLog,
                id: `missing_out_${key}`,
                type: 'OUT',
                timestamp: `${dateStr}T17:00:00`,
                notes: 'TIDAK ABSENSI PULANG',
                is_late: true,
                _period: 'OUT'
              });
            }
          }
        }
        
        dayLogs.filter((l: any) => l.notes?.startsWith('PIKET')).forEach((l: any) => processedLogs.push(l));
      });

      processedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setLogs(processedLogs);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load recap logs:', err);
      setLoading(false);
    });
  }, [startDate, endDate, user]);

  // Filtered by role & user
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const roleMatch = filterRole ? log.role === filterRole : true;
      const userMatch = filterUser ? log.user_id === parseInt(filterUser) : true;
      if (!roleMatch || !userMatch) return false;

      // Filter out "jadwal piket" as requested
      if (log.type === 'TUGAS' && log.notes?.startsWith('PIKET_SCHEDULE:::')) {
        return false;
      }

      // Enforce strict local date boundary filtering
      const logDate = new Date(log.timestamp);
      const logDateStr = format(logDate, 'yyyy-MM-dd');
      if (startDate && logDateStr < startDate) return false;
      if (endDate && logDateStr > endDate) return false;

      // Ensure Sunday or non-working day missing attendance NEVER appears
      const dayOfWeek = logDate.getDay();
      if (dayOfWeek === 0 && (log.notes === 'TIDAK ABSENSI MASUK' || log.notes === 'TIDAK ABSENSI PULANG')) {
        return false;
      }

      return true;
    });
  }, [logs, filterRole, filterUser, startDate, endDate]);

  const selectedUser = useMemo(() => {
    return users.find(u => u.id === parseInt(filterUser));
  }, [users, filterUser]);

  // Calculate attendance statistics counts for filtered logs
  const countHadir = filteredLogs.filter(log => (log.type === 'IN' || log.type === 'OUT') && !log.notes?.startsWith('PIKET:') && log.type !== 'SAKIT' && log.type !== 'IZIN' && log.type !== 'TUGAS' && log.notes !== 'TIDAK ABSENSI MASUK' && log.notes !== 'TIDAK ABSENSI PULANG').length;
  const countSakit = new Set(filteredLogs.filter(log => log.type === 'SAKIT').map(log => format(new Date(log.timestamp), 'yyyy-MM-dd'))).size;
  const countCuti = new Set(filteredLogs.filter(log => log.type === 'IZIN' && log.notes?.startsWith('CUTI:')).map(log => format(new Date(log.timestamp), 'yyyy-MM-dd'))).size;
  const countIzin = new Set(filteredLogs.filter(log => log.type === 'IZIN' && !log.notes?.startsWith('CUTI:')).map(log => format(new Date(log.timestamp), 'yyyy-MM-dd'))).size;
  const countTugas = new Set(filteredLogs.filter(log => log.type === 'TUGAS').map(log => format(new Date(log.timestamp), 'yyyy-MM-dd'))).size;
  const countPiket = filteredLogs.filter(log => log.notes?.startsWith('PIKET:')).length;
  const countTerlambat = filteredLogs.filter(log => log.is_late || log.notes === 'TIDAK ABSENSI PULANG' || log.notes === 'TIDAK ABSENSI MASUK').length;

  // Filtered users for dropdown based on filterRole
  const availableUsers = useMemo(() => {
    if (!filterRole) return users;
    return users.filter(u => u.role === filterRole);
  }, [users, filterRole]);

  // Headmaster lookup for signature
  const headmaster = useMemo(() => {
    return users.find(u => u.role === 'headmaster');
  }, [users]);

  // Readable Period Label for UI and Document Header
  const periodLabel = useMemo(() => {
    if (periodMode === 'day') {
      if (!selectedDay) return 'Hari Ini';
      const [y, m, d] = selectedDay.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (periodMode === 'month') {
      const mName = MONTH_OPTIONS[selectedMonth]?.label || '';
      return `${mName} ${selectedYear}`;
    }
    if (periodMode === 'year') {
      return `Tahun ${selectedYear}`;
    }
    if (periodMode === 'custom') {
      if (!customStartDate && !customEndDate) return 'Semua Waktu';
      const s = customStartDate ? format(new Date(customStartDate + 'T00:00:00'), 'dd/MM/yyyy') : 'Awal';
      const e = customEndDate ? format(new Date(customEndDate + 'T00:00:00'), 'dd/MM/yyyy') : 'Akhir';
      return `${s} s/d ${e}`;
    }
    return 'Semua Periode';
  }, [periodMode, selectedDay, selectedMonth, selectedYear, customStartDate, customEndDate]);

  const officeName = useMemo(() => {
    return selectedUser?.office_name || user.office_name || (offices.length > 0 ? offices[0].name : 'SD Negeri 2 Padangsambian');
  }, [selectedUser, user, offices]);

  const handlePrint = () => {
    window.print();
  };

  const resetFilters = () => {
    setPeriodMode('month');
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    setSelectedDay(todayStr);
    setCustomStartDate('');
    setCustomEndDate('');
    setFilterRole('');
    setFilterUser('');
  };

  return (
    <div className="p-4 md:p-6 h-full overflow-y-auto print:p-0 print:overflow-visible print:bg-white bg-slate-50/50">
      {/* Top Bar (Screen Only) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-bold">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Rekap Laporan Absensi</h2>
              <p className="text-xs text-slate-500">Cetak dokumen resmi presensi harian, bulanan, tahunan, atau per pegawai</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-xs font-medium transition-colors shadow-sm"
            title="Reset Filter"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          <button 
            onClick={handlePrint} 
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold shadow-sm transition-all hover:shadow"
            id="btn-print-recap"
          >
            <Printer size={16} />
            <span>Print Laporan</span>
          </button>
        </div>
      </div>

      {/* Filter Control Box (Screen Only) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 mb-6 print:hidden space-y-4">
        {/* Row 1: Period Mode Segmented Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="text-emerald-600" size={18} />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Pilih Periode:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg">
            <button
              onClick={() => { setPeriodMode('day'); setSelectedDay(todayStr); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                periodMode === 'day' 
                  ? 'bg-white text-emerald-700 shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 Per Tanggal (Harian)
            </button>
            <button
              onClick={() => setPeriodMode('month')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                periodMode === 'month' 
                  ? 'bg-white text-emerald-700 shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📆 Bulanan
            </button>
            <button
              onClick={() => setPeriodMode('year')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                periodMode === 'year' 
                  ? 'bg-white text-emerald-700 shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗓️ Tahunan
            </button>
            <button
              onClick={() => setPeriodMode('custom')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                periodMode === 'custom' 
                  ? 'bg-white text-emerald-700 shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ↔️ Rentang Kustom
            </button>
            <button
              onClick={() => setPeriodMode('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                periodMode === 'all' 
                  ? 'bg-white text-emerald-700 shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌐 Semua
            </button>
          </div>
        </div>

        {/* Row 2: Dynamic Input based on Period Mode */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Date / Month / Year Picker based on mode */}
          <div className="md:col-span-6 flex flex-wrap items-center gap-2">
            {periodMode === 'day' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs text-slate-500 font-medium whitespace-nowrap">Pilih Tanggal:</label>
                <input 
                  type="date"
                  value={selectedDay}
                  onChange={e => setSelectedDay(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDay(todayStr)}
                  className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                >
                  Hari Ini
                </button>
              </div>
            )}

            {periodMode === 'month' && (
              <div className="flex flex-wrap items-center gap-2 w-full">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] text-slate-400 font-medium uppercase mb-0.5">Bulan</label>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  >
                    {MONTH_OPTIONS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="block text-[10px] text-slate-400 font-medium uppercase mb-0.5">Tahun</label>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  >
                    {yearOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear(currentYear);
                      setSelectedMonth(currentMonth);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors whitespace-nowrap"
                  >
                    Bulan Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentMonth === 0) {
                        setSelectedYear(currentYear - 1);
                        setSelectedMonth(11);
                      } else {
                        setSelectedYear(currentYear);
                        setSelectedMonth(currentMonth - 1);
                      }
                    }}
                    className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors whitespace-nowrap"
                  >
                    Bulan Lalu
                  </button>
                </div>
              </div>
            )}

            {periodMode === 'year' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 font-medium whitespace-nowrap">Pilih Tahun:</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedYear(currentYear)}
                  className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                >
                  Tahun Ini
                </button>
              </div>
            )}

            {periodMode === 'custom' && (
              <div className="flex flex-wrap items-center gap-2 w-full">
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-[10px] text-slate-400 font-medium uppercase mb-0.5">Dari Tanggal</label>
                  <input 
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  />
                </div>
                <span className="text-slate-400 mt-4 text-xs">s/d</span>
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-[10px] text-slate-400 font-medium uppercase mb-0.5">Sampai Tanggal</label>
                  <input 
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  />
                </div>
              </div>
            )}

            {periodMode === 'all' && (
              <div className="text-xs text-slate-500 italic flex items-center gap-1.5 bg-slate-100 px-3 py-2 rounded-lg">
                <Sparkles size={14} className="text-amber-500" />
                <span>Menampilkan seluruh riwayat absensi yang tersimpan di sistem.</span>
              </div>
            )}
          </div>

          {/* User & Role Filters */}
          <div className="md:col-span-6 flex flex-wrap items-center gap-2 justify-end">
            <div className="w-full sm:w-auto flex-1 min-w-[130px]">
              <label className="block text-[10px] text-slate-400 font-medium uppercase mb-0.5">Role / Jabatan</label>
              <select 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                value={filterRole}
                onChange={e => {
                  setFilterRole(e.target.value);
                  setFilterUser(''); // reset user selection if role changed
                }}
              >
                <option value="">Semua Role</option>
                <option value="employee">Pegawai Non-ASN / Guru</option>
                <option value="admin">Admin Sekolah</option>
                <option value="headmaster">Kepala Sekolah</option>
                <option value="dinas">Dinas Pendidikan</option>
              </select>
            </div>

            <div className="w-full sm:w-auto flex-1 min-w-[180px]">
              <label className="block text-[10px] text-slate-400 font-medium uppercase mb-0.5">Pilih Pegawai</label>
              <select 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
              >
                <option value="">Semua Pegawai ({availableUsers.length})</option>
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.nip ? `(${u.nip})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Selected Filter Badge Information */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Target Laporan:</span>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded border border-emerald-200/60">
              {periodLabel}
            </span>
            <span className="text-slate-300">•</span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-medium rounded">
              {selectedUser ? `Pegawai: ${selectedUser.name}` : `Semua Pegawai (${availableUsers.length} orang)`}
            </span>
          </div>

          <div className="text-slate-500">
            Total Data Ditemukan: <span className="font-bold text-slate-800">{filteredLogs.length}</span> log
          </div>
        </div>
      </div>

      {/* REKAPITULASI ABSENSI SHEET (Printable Document & Screen Preview) */}
      <div 
        id="recap-table" 
        className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0"
      >
        {/* KOP RESMI DOKUMEN REKAPITULASI (Always shown on print, styled professionally) */}
        <div className="p-6 md:p-8 border-b-2 border-slate-900 bg-white">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              {selectedUser?.photo_url ? (
                <img 
                  src={selectedUser.photo_url} 
                  alt={selectedUser.name} 
                  className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover border-2 border-slate-200 print:border-slate-400"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 md:w-16 md:h-16 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-sm print:border print:border-emerald-700">
                  S
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">Si-Abon</h1>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wider print:border print:border-emerald-300">
                    Official
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-semibold tracking-wide uppercase">Sistem Absensi Online</p>
                <p className="text-[11px] text-slate-500">{officeName}</p>
              </div>
            </div>

            <div className="text-right">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                REKAPITULASI ABSENSI
              </h2>
              <p className="text-xs text-slate-500 font-medium">Dokumen Resmi Sistem Si-Abon</p>
              <div className="mt-2 inline-block px-3 py-1 bg-slate-100 border border-slate-200 rounded-md text-[11px] font-bold text-slate-800 print:bg-white print:border-slate-400">
                Periode: {periodLabel}
              </div>
            </div>
          </div>
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-x-8 md:gap-x-12 gap-y-2 text-xs border-t border-slate-200 pt-4 print:border-slate-300">
            <div className="space-y-1.5">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 font-medium">Nama Pegawai</span>
                <span className="font-bold text-slate-900 text-right">
                  {selectedUser ? selectedUser.name : `Semua Pegawai (${availableUsers.length} Orang)`}
                </span>
              </div>
              {selectedUser?.nip && (
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500 font-medium">NIP</span>
                  <span className="font-mono font-bold text-slate-900 text-right">{selectedUser.nip}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 font-medium">Unit Kerja / Sekolah</span>
                <span className="font-bold text-slate-900 text-right">{officeName}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 font-medium">Rentang Waktu</span>
                <span className="font-bold text-slate-900 text-right">{periodLabel}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 font-medium">Tanggal Cetak</span>
                <span className="font-bold text-slate-900 text-right">
                  {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 font-medium">Total Catatan</span>
                <span className="font-bold text-slate-900 text-right">{filteredLogs.length} Baris Log</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ringkasan Kehadiran (Attendance Summary Card) */}
        <div id="recap-stats-summary" className="p-4 md:p-6 bg-slate-50/60 border-b border-slate-200 print:bg-white print:p-4 print:border-slate-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-800 uppercase tracking-wider print:text-xs">
              Ringkasan Rekapitulasi Kehadiran
            </h3>
            <span className="text-[11px] text-slate-500 print:hidden">
              Statistik absensi yang terfilter
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 md:gap-3 print:grid-cols-7 print:gap-1.5">
            <div id="stat-hadir" className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200/80 flex flex-col justify-between print:bg-white print:border-slate-300 print:p-2">
              <span className="text-[11px] font-semibold text-emerald-800 print:text-slate-700">Hadir</span>
              <span className="text-lg md:text-xl font-black text-emerald-700 mt-1 print:text-slate-900">
                {countHadir} <span className="text-[10px] font-normal text-emerald-600 print:text-slate-500">log</span>
              </span>
            </div>

            <div id="stat-sakit" className="bg-rose-50/70 p-2.5 rounded-lg border border-rose-200/80 flex flex-col justify-between print:bg-white print:border-slate-300 print:p-2">
              <span className="text-[11px] font-semibold text-rose-800 print:text-slate-700">Sakit</span>
              <span className="text-lg md:text-xl font-black text-rose-700 mt-1 print:text-slate-900">
                {countSakit} <span className="text-[10px] font-normal text-rose-600 print:text-slate-500">hari</span>
              </span>
            </div>

            <div id="stat-izin" className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200/80 flex flex-col justify-between print:bg-white print:border-slate-300 print:p-2">
              <span className="text-[11px] font-semibold text-amber-800 print:text-slate-700">Izin</span>
              <span className="text-lg md:text-xl font-black text-amber-700 mt-1 print:text-slate-900">
                {countIzin} <span className="text-[10px] font-normal text-amber-600 print:text-slate-500">hari</span>
              </span>
            </div>

            <div id="stat-cuti" className="bg-teal-50/70 p-2.5 rounded-lg border border-teal-200/80 flex flex-col justify-between print:bg-white print:border-slate-300 print:p-2">
              <span className="text-[11px] font-semibold text-teal-800 print:text-slate-700">Cuti</span>
              <span className="text-lg md:text-xl font-black text-teal-700 mt-1 print:text-slate-900">
                {countCuti} <span className="text-[10px] font-normal text-teal-600 print:text-slate-500">hari</span>
              </span>
            </div>

            <div id="stat-tugas" className="bg-sky-50/70 p-2.5 rounded-lg border border-sky-200/80 flex flex-col justify-between print:bg-white print:border-slate-300 print:p-2">
              <span className="text-[11px] font-semibold text-sky-800 print:text-slate-700">Tugas</span>
              <span className="text-lg md:text-xl font-black text-sky-700 mt-1 print:text-slate-900">
                {countTugas} <span className="text-[10px] font-normal text-sky-600 print:text-slate-500">log</span>
              </span>
            </div>

            <div id="stat-piket" className="bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-200/80 flex flex-col justify-between print:bg-white print:border-slate-300 print:p-2">
              <span className="text-[11px] font-semibold text-indigo-800 print:text-slate-700">Piket</span>
              <span className="text-lg md:text-xl font-black text-indigo-700 mt-1 print:text-slate-900">
                {countPiket} <span className="text-[10px] font-normal text-indigo-600 print:text-slate-500">log</span>
              </span>
            </div>

            <div id="stat-terlambat" className="bg-red-50/70 p-2.5 rounded-lg border border-red-200/80 flex flex-col justify-between print:bg-white print:border-slate-300 print:p-2">
              <span className="text-[11px] font-semibold text-red-800 print:text-slate-700">Terlambat/TL</span>
              <span className="text-lg md:text-xl font-black text-red-700 mt-1 print:text-slate-900">
                {countTerlambat} <span className="text-[10px] font-normal text-red-600 print:text-slate-500">log</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tabel Data Absensi */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium">Memuat data absensi...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <CalendarDays size={40} className="stroke-1 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Tidak ada data absensi yang ditemukan</p>
              <p className="text-xs text-slate-400">Silakan ubah filter tanggal, bulan, tahun, atau pegawai di atas.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left print:text-[8.5pt] print:leading-tight border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center print:px-2 print:py-2">No</th>
                  <th className="px-4 py-3.5 print:px-2 print:py-2 whitespace-nowrap">Tanggal</th>
                  <th className="px-4 py-3.5 print:px-2 print:py-2 whitespace-nowrap">Jam</th>
                  {/* CRITICAL: Always show Pegawai Name column if printing for all users */}
                  {!filterUser && (
                    <th className="px-4 py-3.5 print:px-2 print:py-2">Nama Pegawai</th>
                  )}
                  <th className="px-4 py-3.5 print:px-2 print:py-2">Tipe Absensi</th>
                  <th className="px-4 py-3.5 print:px-2 print:py-2">Lokasi / Kantor</th>
                  <th className="px-4 py-3.5 print:px-2 print:py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                {filteredLogs.map((log, index) => {
                  const logUser = users.find(u => u.id === log.user_id);
                  const displayName = log.name || logUser?.name || 'Pegawai';
                  const displayNip = logUser?.nip;

                  return (
                    <tr 
                      key={`${log.id}-${index}`} 
                      className="hover:bg-slate-50/60 print:hover:bg-transparent break-inside-avoid"
                    >
                      {/* Nomor Urut */}
                      <td className="px-4 py-3 text-center text-xs text-slate-400 font-mono print:px-2 print:py-2 print:text-slate-800">
                        {index + 1}
                      </td>

                      {/* Tanggal */}
                      <td className="px-4 py-3 font-mono text-slate-700 print:px-2 print:py-2 print:text-slate-900 whitespace-nowrap">
                        <div className="font-semibold">{format(new Date(log.timestamp), 'dd/MM/yyyy')}</div>
                        <div className="text-[10px] text-slate-400 print:hidden">
                          {format(new Date(log.timestamp), 'EEEE', { locale: id })}
                        </div>
                      </td>

                      {/* Jam */}
                      <td className="px-4 py-3 font-mono text-slate-700 print:px-2 print:py-2 print:text-slate-900 whitespace-nowrap">
                        {log.type === 'IZIN' && log.notes?.startsWith('CUTI:') ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          format(new Date(log.timestamp), 'HH:mm:ss')
                        )}
                      </td>

                      {/* Nama Pegawai (jika Semua Pegawai dipilih) */}
                      {!filterUser && (
                        <td className="px-4 py-3 print:px-2 print:py-2">
                          <div className="font-bold text-slate-900 leading-tight">
                            {displayName}
                          </div>
                          {displayNip && (
                            <div className="text-[10px] text-slate-400 print:text-slate-600 font-mono">
                              NIP: {displayNip}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Tipe Badge */}
                      <td className="px-4 py-3 print:px-2 print:py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border print:border-slate-400 ${
                          log.notes === 'TIDAK ABSENSI MASUK' || log.notes === 'TIDAK ABSENSI PULANG' 
                            ? 'bg-red-50 text-red-700 border-red-200 print:text-red-700' :
                          log.type === 'IZIN' && log.notes?.startsWith('CUTI:') 
                            ? 'bg-teal-50 text-teal-700 border-teal-200 print:text-teal-700' :
                          log.notes?.startsWith('PIKET:') 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 print:text-indigo-700' :
                          log.type === 'SAKIT' 
                            ? 'bg-rose-50 text-rose-700 border-rose-200 print:text-rose-700' :
                          log.type === 'IZIN' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200 print:text-amber-700' :
                          log.type === 'TUGAS' 
                            ? 'bg-sky-50 text-sky-700 border-sky-200 print:text-sky-700' :
                          log.type === 'IN' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 print:text-emerald-700' : 
                          log.type === 'OUT' 
                            ? 'bg-orange-50 text-orange-700 border-orange-200 print:text-orange-700' : 
                            'bg-slate-50 text-slate-700 border-slate-200 print:text-slate-700'
                        }`}>
                          {log.notes === 'TIDAK ABSENSI MASUK' ? 'TIDAK ABSENSI MASUK' :
                           log.notes === 'TIDAK ABSENSI PULANG' ? 'TIDAK ABSENSI PULANG' :
                           log.type === 'IZIN' && log.notes?.startsWith('CUTI:') ? `CUTI (${(log as any)._period === 'IN' ? 'MASUK' : 'PULANG'})` :
                           log.notes?.startsWith('PIKET:') ? `PIKET - ${log.type === 'IN' ? 'MASUK' : 'PULANG'}` :
                           log.type === 'SAKIT' ? `SAKIT (${(log as any)._period === 'IN' ? 'MASUK' : 'PULANG'})` :
                           log.type === 'IZIN' ? `IZIN (${(log as any)._period === 'IN' ? 'MASUK' : 'PULANG'})` :
                           log.type === 'TUGAS' ? `PERINTAH TUGAS (${(log as any)._period === 'IN' ? 'MASUK' : 'PULANG'})` :
                           log.type === 'IN' ? 'HADIR (MASUK)' :
                           log.type === 'OUT' ? 'HADIR (PULANG)' :
                           log.type}
                        </span>
                      </td>

                      {/* Lokasi / Kantor */}
                      <td className="px-4 py-3 text-xs print:px-2 print:py-2">
                        <div className="font-semibold text-slate-800 print:text-slate-900">
                          {log.notes?.startsWith('PIKET_SCHEDULE:::') ? 'Lokasi Khusus Piket' : (log.office_name || officeName)}
                        </div>
                        {log.notes && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5 print:text-slate-600">
                            "{log.notes.startsWith('PIKET_SCHEDULE:::') 
                               ? JSON.parse(log.notes.replace('PIKET_SCHEDULE:::', '')).notes || 'Tugas Piket'
                               : log.notes.replace(/^PIKET:\s*/, '')}"
                          </div>
                        )}
                        {!log.notes && log.lat !== 0 && log.lng !== 0 && (
                          <div className="text-[10px] text-slate-400 print:hidden font-mono">
                            {log.lat.toFixed(5)}, {log.lng.toFixed(5)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 print:px-2 print:py-2">
                        {log.notes === 'TIDAK ABSENSI MASUK' || log.notes === 'TIDAK ABSENSI PULANG' ? (
                          <span className="text-red-600 font-bold text-xs">Terlambat</span>
                        ) : log.type === 'IZIN' && log.notes?.startsWith('CUTI:') ? (
                          <span className="text-teal-700 font-semibold text-xs">Cuti Disetujui</span>
                        ) : log.type === 'SAKIT' ? (
                          <span className="text-rose-700 font-semibold text-xs">Sakit</span>
                        ) : log.type === 'IZIN' ? (
                          <span className="text-amber-700 font-semibold text-xs">Izin</span>
                        ) : log.type === 'TUGAS' ? (
                          <span className="text-sky-700 font-semibold text-xs">Perintah Tugas</span>
                        ) : log.notes === 'Koreksi Absensi (Lupa Absen)' ? (
                          <span className="text-emerald-700 font-semibold text-xs">Tepat Waktu</span>
                        ) : log.notes?.startsWith('PIKET:') ? (
                          log.type === 'IN' ? (
                            log.is_late ? (
                              <span className="text-red-600 font-semibold text-xs">Terlambat (Piket)</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold text-xs">Tepat Waktu (Piket)</span>
                            )
                          ) : (
                            log.is_late ? (
                              <span className="text-orange-600 font-semibold text-xs">Mendahului (Piket)</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold text-xs">Tepat Waktu (Piket)</span>
                            )
                          )
                        ) : log.type === 'IN' ? (
                          log.is_late ? (
                            <span className="text-red-600 font-semibold text-xs">Terlambat</span>
                          ) : (
                            <span className="text-emerald-700 font-semibold text-xs">Tepat Waktu</span>
                          )
                        ) : log.type === 'OUT' ? (
                          log.is_late ? (
                            <span className="text-orange-600 font-semibold text-xs">Mendahului</span>
                          ) : (
                            <span className="text-emerald-700 font-semibold text-xs">Tepat Waktu</span>
                          )
                        ) : (
                          <span className="text-slate-600 font-semibold text-xs">Tepat Waktu</span>
                        )}

                        {/* Special clean note preview */}
                        {log.notes && !log.notes.startsWith('CUTI:') && !log.notes.startsWith('PIKET_SCHEDULE:::') && !log.notes.startsWith('PIKET:') && log.notes !== 'Koreksi Absensi (Lupa Absen)' && log.notes !== 'TIDAK ABSENSI MASUK' && log.notes !== 'TIDAK ABSENSI PULANG' && (
                          <div className="text-[10px] text-slate-400 mt-0.5 italic max-w-xs truncate" title={log.notes}>
                            "{log.notes}"
                          </div>
                        )}
                        {log.notes?.startsWith('CUTI:') && (
                          <div className="text-[10px] text-slate-400 mt-0.5 italic max-w-xs truncate" title={log.notes}>
                            "{log.notes.replace('CUTI: ', '')}"
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* TANDA TANGAN RESMI KEDINASAN / SEKOLAH (Print Footer) */}
        <div className="hidden print:grid grid-cols-2 gap-12 mt-12 px-8 pb-10 break-inside-avoid text-center">
          {/* Pihak 1: Pegawai atau Petugas Rekap */}
          <div>
            <p className="text-xs text-slate-600 mb-16">
              {selectedUser ? 'Pegawai yang bersangkutan,' : 'Dibuat & Diverifikasi oleh,'}
            </p>
            <div className="border-b border-slate-900 w-52 mx-auto mb-1"></div>
            <p className="text-sm font-bold text-slate-900">
              {selectedUser ? selectedUser.name : user.name}
            </p>
            <p className="text-[10px] text-slate-600 font-mono">
              NIP: {selectedUser?.nip || user.nip || '____________________'}
            </p>
          </div>

          {/* Pihak 2: Atasan Langsung / Kepala Sekolah */}
          <div>
            <p className="text-xs text-slate-600 mb-16">
              Mengetahui,<br />
              Kepala Sekolah / Atasan Langsung
            </p>
            <div className="border-b border-slate-900 w-52 mx-auto mb-1"></div>
            <p className="text-sm font-bold text-slate-900">
              {headmaster ? headmaster.name : '__________________________'}
            </p>
            <p className="text-[10px] text-slate-600 font-mono">
              NIP: {headmaster?.nip || '__________________________'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
