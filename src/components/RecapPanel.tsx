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
  const isEmployee = user.role === 'employee';
  const isAdminOrHeadmaster = ['admin', 'headmaster', 'dinas', 'super_admin'].includes(user.role);

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const todayStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(false);

  // Scope: 'school' (1 sekolah / semua pegawai) or 'single' (per pegawai)
  const [reportScope, setReportScope] = useState<'school' | 'single'>(isEmployee ? 'single' : 'school');

  // Filter Modes
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // User & Role Filter
  const [filterRole, setFilterRole] = useState('');
  const [filterUser, setFilterUser] = useState<string>(isEmployee ? String(user.id) : '');

  // Table Print & View Format: 'daily' (compact 1 row per day) or 'detailed' (per log entry)
  const [viewFormat, setViewFormat] = useState<'daily' | 'detailed'>('daily');

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
      api.getAttendance({ 
        start_date: qsStart, 
        end_date: qsEnd, 
        current_user: user,
        ...(isEmployee ? { user_id: user.id } : {})
      }),
      api.getLeaves(isEmployee ? user.id : undefined, user),
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
      // Regular employee can ONLY ever see and print their own logs
      if (isEmployee && log.user_id !== user.id) return false;

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
  }, [logs, isEmployee, user.id, filterRole, filterUser, startDate, endDate]);

  const selectedUser = useMemo(() => {
    if (isEmployee) return user;
    if (!filterUser) return null;
    return users.find(u => u.id === parseInt(filterUser)) || null;
  }, [isEmployee, user, users, filterUser]);

  // NIP / NIPPPK murni milik pegawai yang dipilih, dilarang keras fallback ke NIP admin/super admin
  const selectedEmployeeNip = useMemo(() => {
    const target = selectedUser || (isEmployee ? user : null);
    if (!target) return '';
    if (target.nip && typeof target.nip === 'string' && target.nip.trim() !== '') {
      return target.nip.trim();
    }
    const logWithNip = logs.find(l => l.user_id === target.id && ((l as any).user_nip || (l as any).users?.nip));
    if (logWithNip) {
      const found = (logWithNip as any).user_nip || (logWithNip as any).users?.nip;
      if (found && typeof found === 'string' && found.trim() !== '') {
        return found.trim();
      }
    }
    return '';
  }, [selectedUser, isEmployee, user, logs]);

  // Filtered users for dropdown based on filterRole
  const availableUsers = useMemo(() => {
    if (isEmployee) return [user];
    if (!filterRole) return users;
    return users.filter(u => u.role === filterRole);
  }, [isEmployee, user, users, filterRole]);

  // Headmaster lookup for signature
  const headmaster = useMemo(() => {
    // 1. Cek dari pengaturan kantor yang dipilih / kantor user
    const targetOfficeId = selectedUser?.office_id || user.office_id;
    const targetOfficeName = selectedUser?.office_name || user.office_name;
    const office = offices.find(o => o.id === targetOfficeId) || 
                   offices.find(o => o.name === targetOfficeName) || 
                   (offices.length > 0 ? offices[0] : null);

    if (office && office.headmaster_name) {
      return {
        name: office.headmaster_name,
        nip: office.headmaster_nip || '',
        nip_type: office.headmaster_nip_type || 'NIP'
      };
    }

    // 2. Fallback ke user dengan role headmaster di database jika ada
    const userHeadmaster = users.find(u => u.role === 'headmaster');
    if (userHeadmaster) {
      return {
        name: userHeadmaster.name,
        nip: userHeadmaster.nip || '',
        nip_type: userHeadmaster.nip_type || 'NIP'
      };
    }

    return null;
  }, [users, offices, selectedUser, user]);

  const selectedEmployeeNipType = useMemo(() => {
    if (selectedUser) {
      if (selectedUser.nip_type) return selectedUser.nip_type;
      const clean = (selectedUser.nip || '').replace(/\s+/g, '');
      if (clean.length === 21) return 'NIPPPK';
      return 'NIP';
    }
    if (user.nip_type) return user.nip_type;
    const cleanUserNip = (user.nip || '').replace(/\s+/g, '');
    if (cleanUserNip.length === 21) return 'NIPPPK';
    return 'NIP';
  }, [selectedUser, user]);

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

  // Group logs by user and date for Daily Recap Format (1 baris per hari per pegawai)
  const dailyGroupedLogs = useMemo(() => {
    const map = new Map<string, {
      userId: number;
      userName: string;
      userNip?: string;
      userNipType?: 'NIP' | 'NIPPPK';
      dateStr: string;
      dayName: string;
      dayOfWeek: number;
      isWeekendOrDayOff: boolean;
      isHoliday: boolean;
      holidayName: string;
      inLog?: AttendanceLog;
      outLog?: AttendanceLog;
      specialLog?: AttendanceLog;
      piketLogs: AttendanceLog[];
      notes: string[];
      officeName: string;
    }>();

    // 1. Generate all dates within the period so every day in the month is present
    const dateList: string[] = [];
    if (startDate && endDate) {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const [ey, em, ed] = endDate.split('-').map(Number);
      const curr = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);
      let count = 0;
      while (curr <= end && count < 366) {
        dateList.push(format(curr, 'yyyy-MM-dd'));
        curr.setDate(curr.getDate() + 1);
        count++;
      }
    }

    // 2. Target users to populate
    const targetUsers = selectedUser 
      ? [selectedUser] 
      : (availableUsers.length > 0 ? availableUsers : (users.length > 0 ? users : [user]));

    // 3. Pre-populate all calendar days for each target user
    targetUsers.forEach(u => {
      const userOfficeId = u.office_id || user.office_id;
      const userOffice = offices.find(o => o.id === userOfficeId) || offices[0];
      const userNip = u.nip;
      const userNipType = u.nip_type || (userNip && userNip.replace(/\s+/g, '').length === 21 ? 'NIPPPK' : 'NIP');

      dateList.forEach(dateStr => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dayDate = new Date(y, m - 1, d);
        const dayOfWeek = dayDate.getDay(); // 0: Sunday, 6: Saturday
        const dayName = format(dayDate, 'EEEE', { locale: id });

        const scheduleForDay = userOffice?.schedule ? userOffice.schedule[dayOfWeek] : undefined;
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;
        const isOfficeDayOff = scheduleForDay ? Boolean(scheduleForDay.is_off) : (isSunday || isSaturday);
        const calHoliday = (userOffice?.holidays || []).find((h: any) => h.date === dateStr);
        const isHoliday = Boolean(calHoliday);
        const holidayName = calHoliday?.name || '';
        const isWeekendOrDayOff = isOfficeDayOff || isSunday || isSaturday;

        const key = `${u.id}_${dateStr}`;
        map.set(key, {
          userId: u.id,
          userName: u.name,
          userNip,
          userNipType,
          dateStr,
          dayName,
          dayOfWeek,
          isWeekendOrDayOff,
          isHoliday,
          holidayName,
          inLog: undefined,
          outLog: undefined,
          specialLog: undefined,
          piketLogs: [],
          notes: [],
          officeName: u.office_name || officeName
        });
      });
    });

    // 4. Overlay attendance logs onto the populated days
    filteredLogs.forEach(log => {
      const logDate = new Date(log.timestamp);
      const dateStr = format(logDate, 'yyyy-MM-dd');
      const key = `${log.user_id}_${dateStr}`;

      if (!map.has(key)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dayDate = new Date(y, m - 1, d);
        const dayOfWeek = dayDate.getDay();
        const dayName = format(dayDate, 'EEEE', { locale: id });
        const logUser = users.find(u => u.id === log.user_id) || user;
        const userNip = logUser?.nip;
        const userNipType = logUser?.nip_type || (userNip && userNip.replace(/\s+/g, '').length === 21 ? 'NIPPPK' : 'NIP');

        map.set(key, {
          userId: log.user_id,
          userName: log.name || logUser.name || 'Pegawai',
          userNip,
          userNipType,
          dateStr,
          dayName,
          dayOfWeek,
          isWeekendOrDayOff: dayOfWeek === 0 || dayOfWeek === 6,
          isHoliday: false,
          holidayName: '',
          piketLogs: [],
          notes: [],
          officeName: log.office_name || officeName
        });
      }

      const item = map.get(key)!;

      if (log.office_name) {
        item.officeName = log.office_name;
      }

      // Track piket logs
      if (log.notes?.startsWith('PIKET:')) {
        item.piketLogs.push(log);
      }

      // Track attendance period (IN / OUT / SPECIAL)
      if (log.type === 'SAKIT' || log.type === 'IZIN' || (log.type === 'TUGAS' && !log.notes?.startsWith('PIKET'))) {
        item.specialLog = log;
      } else if (log.type === 'IN' || (log as any)._period === 'IN') {
        item.inLog = log;
      } else if (log.type === 'OUT' || (log as any)._period === 'OUT') {
        item.outLog = log;
      }

      // Filter out internal notes from overriding location
      if (log.notes && !item.notes.includes(log.notes)) {
        const isLupaAbsen = log.notes === 'Koreksi Absensi (Lupa Absen)' || log.notes.toLowerCase().includes('lupa absen') || log.notes.toLowerCase().includes('koreksi absensi');
        const isPiketNote = log.notes.startsWith('PIKET:') || log.notes.startsWith('PIKET_SCHEDULE:::');
        const isMissedAttendance = log.notes === 'TIDAK ABSENSI MASUK' || log.notes === 'TIDAK ABSENSI PULANG';

        if (!isLupaAbsen && !isPiketNote && !isMissedAttendance) {
          item.notes.push(log.notes);
        }
      }
    });

    const list = Array.from(map.values());
    // Sort chronologically ascending by date (1st to 30th/31st of the month), then by user name
    list.sort((a, b) => {
      const dateCompare = a.dateStr.localeCompare(b.dateStr);
      if (dateCompare !== 0) return dateCompare;
      return a.userName.localeCompare(b.userName);
    });
    return list;
  }, [filteredLogs, startDate, endDate, selectedUser, availableUsers, users, user, offices, officeName]);

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
    if (isEmployee) {
      setFilterUser(String(user.id));
      setReportScope('single');
    } else {
      setFilterUser('');
      setReportScope('school');
    }
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
              <h2 className="text-xl font-bold text-slate-800">
                {isEmployee ? 'Cetak Rekap Absensi Pribadi' : 'Rekap Laporan Absensi Sekolah'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEmployee 
                  ? 'Cetak dokumen resmi presensi kehadiran mandiri harian, bulanan, atau tahunan'
                  : 'Cetak dokumen resmi presensi 1 sekolah (seluruh pegawai) atau per pegawai'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Format Selector Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setViewFormat('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                viewFormat === 'daily'
                  ? 'bg-white text-emerald-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Format Ringkas Harian: 1 Baris per Hari (Masuk & Pulang Terpadu) - Sangat hemat kertas, muat 1 lembar!"
            >
              <span>📋 Format Ringkas Harian</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold hidden md:inline">
                Muat 1 Lembar
              </span>
            </button>
            <button
              onClick={() => setViewFormat('detailed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                viewFormat === 'detailed'
                  ? 'bg-white text-emerald-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Format Rinci: Menampilkan setiap log masuk dan pulang terpisah"
            >
              <span>📑 Format Rinci (Per Log)</span>
            </button>
          </div>

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
            <span>
              {isEmployee 
                ? 'Cetak Rekap Absensi Saya' 
                : (!filterUser ? 'Cetak Rekap 1 Sekolah' : 'Cetak Rekap Pegawai')}
            </span>
          </button>
        </div>
      </div>

      {/* Filter Control Box (Screen Only) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 mb-6 print:hidden space-y-4">
        {/* Scope selector for Admin / Kepala Sekolah */}
        {isAdminOrHeadmaster && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/80 border border-emerald-200/80 p-3 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-bold shadow-sm">
                <Building2 size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">Mode Cetak Rekapitulasi</p>
                <p className="text-[11px] text-emerald-700">Pilih cetak rekap 1 sekolah penuh (seluruh pegawai) atau rekap per pegawai</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setReportScope('school');
                  setFilterUser('');
                  setFilterRole('');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !filterUser
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <Users size={14} />
                <span>🏫 Rekap 1 Sekolah (Semua)</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${!filterUser ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {availableUsers.length} Pegawai
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReportScope('single');
                  if (!filterUser && availableUsers.length > 0) {
                    setFilterUser(String(availableUsers[0].id));
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterUser
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <UserIcon size={14} />
                <span>👤 Rekap Per Pegawai</span>
              </button>
            </div>
          </div>
        )}

        {/* Regular employee banner */}
        {isEmployee && (
          <div className="flex items-center gap-3 bg-emerald-50/80 border border-emerald-200/80 p-3 rounded-xl text-xs text-emerald-900">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
              <UserIcon size={16} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-emerald-950">Rekap Presensi Mandiri: {user.name}</p>
              <p className="text-[11px] text-emerald-700">
                {selectedEmployeeNipType}: {user.nip || '-'} • {officeName}
              </p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[10px] border border-emerald-200">
              Absensi Pribadi
            </span>
          </div>
        )}

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
          {isAdminOrHeadmaster && (
            <div className="md:col-span-6 flex flex-wrap items-center gap-2 justify-end">
              {!filterUser ? (
                /* When Rekap 1 Sekolah is selected */
                <div className="w-full flex items-center justify-between sm:justify-end gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5">
                    <Users size={14} className="text-emerald-600" />
                    <span>Target: <strong>Seluruh Pegawai Sekolah ({availableUsers.length} orang)</strong></span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setReportScope('single');
                      if (availableUsers.length > 0) setFilterUser(String(availableUsers[0].id));
                    }}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold hover:underline"
                  >
                    Pilih per pegawai
                  </button>
                </div>
              ) : (
                /* When Rekap Per Pegawai is selected */
                <>
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
                      onChange={e => {
                        setFilterUser(e.target.value);
                        if (!e.target.value) setReportScope('school');
                      }}
                    >
                      <option value="">-- Rekap 1 Sekolah (Semua Pegawai) --</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} {u.nip ? `(${u.nip_type || 'NIP'}: ${u.nip})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
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
              {isEmployee 
                ? `Pegawai: ${user.name}` 
                : (selectedUser ? `Pegawai: ${selectedUser.name}` : `Seluruh Pegawai Sekolah (${availableUsers.length} orang)`)}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-slate-500 hidden sm:inline">
              Format: <strong className="text-slate-700">{viewFormat === 'daily' ? 'Ringkas Harian' : 'Rinci Per Log'}</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <div className="text-slate-500">
              Total Data:{' '}
              <span className="font-bold text-slate-800">
                {viewFormat === 'daily' ? `${dailyGroupedLogs.length} Hari (${filteredLogs.length} Log)` : `${filteredLogs.length} Log`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* REKAPITULASI ABSENSI SHEET (Printable Document & Screen Preview) */}
      <div 
        id="recap-table" 
        className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0 print:overflow-visible print:break-inside-avoid print:page-break-inside-avoid"
      >
        {/* KOP RESMI DOKUMEN REKAPITULASI (Always shown on print, styled professionally) */}
        <div className="p-4 md:p-6 border-b-2 border-slate-900 bg-white print:p-2 print:border-b-2 print:border-slate-900">
          <div className="flex justify-between items-center mb-4 print:mb-1">
            <div className="flex items-center gap-3 print:gap-2">
              {selectedUser?.photo_url ? (
                <img 
                  src={selectedUser.photo_url} 
                  alt={selectedUser.name} 
                  className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover border-2 border-slate-200 print:w-8 print:h-8 print:rounded-md print:border-slate-400"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm print:w-7 print:h-7 print:text-sm print:rounded-md print:border print:border-emerald-700">
                  S
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight print:text-sm print:leading-tight">Si-Abon</h1>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wider print:text-[6.5pt] print:px-1 print:py-0 print:border print:border-emerald-300">
                    Official
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-semibold tracking-wide uppercase print:text-[6.8pt] print:leading-none">Sistem Absensi Online</p>
              </div>
            </div>

            <div className="text-right">
              <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight print:text-xs print:leading-tight">
                {!selectedUser ? 'REKAPITULASI ABSENSI SEKOLAH' : 'REKAPITULASI ABSENSI'}
              </h2>
              <p className="text-xs text-slate-500 font-medium print:text-[6.8pt] print:leading-none">
                {!selectedUser 
                  ? 'Laporan Kehadiran Seluruh Pegawai Satuan Pendidikan' 
                  : (isEmployee ? 'Dokumen Resmi Kehadiran Mandiri Si-Abon' : 'Dokumen Resmi Presensi Pegawai')}
              </p>
            </div>
          </div>
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-x-6 md:gap-x-12 gap-y-1 text-xs border-t border-slate-200 pt-3 print:pt-1 print:gap-y-0.2 print:gap-x-4 print:border-slate-300 print:text-[7pt] print:leading-tight">
            <div className="space-y-1 print:space-y-0">
              <div className="flex justify-between border-b border-slate-100 pb-0.5 print:pb-0.2">
                <span className="text-slate-500 font-medium">
                  {selectedUser ? 'Nama Pegawai' : 'Cakupan Rekap'}
                </span>
                <span className="font-bold text-slate-900 text-right">
                  {selectedUser ? selectedUser.name : `Seluruh Pegawai (${availableUsers.length} Orang)`}
                </span>
              </div>
              {selectedUser && (
                <div className="flex justify-between border-b border-slate-100 pb-0.5 print:pb-0.2">
                  <span className="text-slate-500 font-medium">{selectedEmployeeNipType}</span>
                  <span className="font-mono font-bold text-slate-900 text-right">{selectedEmployeeNip || '-'}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-100 pb-0.5 print:pb-0.2">
                <span className="text-slate-500 font-medium">Unit Kerja / Sekolah</span>
                <span className="font-bold text-slate-900 text-right">{officeName}</span>
              </div>
            </div>

            <div className="space-y-1 print:space-y-0">
              <div className="flex justify-between border-b border-slate-100 pb-0.5 print:pb-0.2">
                <span className="text-slate-500 font-medium">Rentang Waktu</span>
                <span className="font-bold text-slate-900 text-right">{periodLabel}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-0.5 print:pb-0.2">
                <span className="text-slate-500 font-medium">Tanggal Cetak</span>
                <span className="font-bold text-slate-900 text-right">
                  {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-0.5 print:pb-0.2">
                <span className="text-slate-500 font-medium">Total Catatan</span>
                <span className="font-bold text-slate-900 text-right">
                  {viewFormat === 'daily' ? `${dailyGroupedLogs.length} Hari (${filteredLogs.length} Log)` : `${filteredLogs.length} Baris Log`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabel Data Absensi */}
        <div className="overflow-x-auto print:overflow-visible">
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
          ) : viewFormat === 'daily' ? (
            /* FORMAT RINGKAS HARIAN (1 Baris per Hari / Terpadu) */
            <table className="w-full text-sm text-left print:text-[6.8pt] print:leading-tight border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                <tr>
                  <th className="px-2 py-2 w-8 text-center print:px-1 print:py-0.5 print:w-5">No</th>
                  <th className="px-3 py-2 print:px-1 print:py-0.5 whitespace-nowrap">Tanggal & Hari</th>
                  {!filterUser && (
                    <th className="px-3 py-2 print:px-1 print:py-0.5">Nama Pegawai</th>
                  )}
                  <th className="px-3 py-2 print:px-1 print:py-0.5">Absen Masuk</th>
                  <th className="px-3 py-2 print:px-1 print:py-0.5">Absen Pulang</th>
                  <th className="px-3 py-2 print:px-1 print:py-0.5">Keterangan / Lokasi</th>
                  <th className="px-3 py-2 print:px-1 print:py-0.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                {dailyGroupedLogs.map((item, index) => {
                  const [y, m, d] = item.dateStr.split('-');
                  const formattedDate = `${d}/${m}/${y}`;
                  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
                  const isPastOrToday = item.dateStr <= todayDateStr;
                  const isFuture = item.dateStr > todayDateStr;

                  const isCuti = item.specialLog?.notes?.startsWith('CUTI:') || (item.specialLog?.type === 'IZIN' && item.specialLog?.notes?.startsWith('CUTI:'));
                  const isSakit = item.specialLog?.type === 'SAKIT';
                  const isIzin = item.specialLog?.type === 'IZIN' && !isCuti;
                  const isTugas = item.specialLog?.type === 'TUGAS';

                  const hasValidIn = item.inLog && item.inLog.notes !== 'TIDAK ABSENSI MASUK';
                  const hasValidOut = item.outLog && item.outLog.notes !== 'TIDAK ABSENSI PULANG';
                  const hasPiket = item.piketLogs.length > 0;
                  const hasAttendance = hasValidIn || hasValidOut || hasPiket || Boolean(item.specialLog);

                  // Off-day check (Saturday, Sunday, scheduled Day Off or Holiday without actual attendance)
                  const isOffDay = (item.isWeekendOrDayOff || item.isHoliday) && !hasAttendance;

                  return (
                    <tr 
                      key={`${item.userId}-${item.dateStr}`} 
                      className={`hover:bg-slate-50/60 print:hover:bg-transparent break-inside-avoid ${
                        isOffDay ? 'bg-slate-50/50 print:bg-slate-50/20' : ''
                      }`}
                    >
                      {/* Nomor Urut */}
                      <td className="px-2 py-1.5 text-center text-xs text-slate-400 font-mono print:px-1 print:py-0.5 print:text-[6.8pt] print:text-slate-800">
                        {index + 1}
                      </td>

                      {/* Tanggal & Hari */}
                      <td className="px-3 py-1.5 font-mono text-slate-700 print:px-1 print:py-0.5 print:text-[6.8pt] print:text-slate-900 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{formattedDate}</span>
                        <span className="text-[10px] text-slate-500 print:text-[6.5pt] ml-1">({item.dayName})</span>
                      </td>

                      {/* Nama Pegawai (jika Semua Pegawai dipilih) */}
                      {!filterUser && (
                        <td className="px-3 py-1.5 print:px-1 print:py-0.5">
                          <div className="font-bold text-slate-900 leading-tight print:text-[6.8pt]">{item.userName}</div>
                          {item.userNip && (
                            <div className="text-[10px] text-slate-400 print:text-slate-600 font-mono print:text-[6pt]">
                              {item.userNipType || 'NIP'}: {item.userNip}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Absen Masuk */}
                      <td className="px-3 py-1.5 print:px-1 print:py-0.5">
                        {isOffDay ? (
                          <span className="text-slate-400 font-semibold print:text-slate-500 print:text-[6.5pt]">-</span>
                        ) : item.specialLog ? (
                          <span className="text-teal-700 font-semibold text-xs print:text-[6.5pt]">
                            {isCuti ? 'CUTI' : isSakit ? 'SAKIT' : isIzin ? 'IZIN' : 'TUGAS'}
                          </span>
                        ) : item.inLog ? (
                          item.inLog.notes === 'TIDAK ABSENSI MASUK' ? (
                            <span className="text-slate-400 font-semibold print:text-slate-500 print:text-[6.5pt]">-</span>
                          ) : (
                            <div className="font-mono font-semibold text-slate-900 print:text-[6.5pt] print:leading-tight">
                              <div>{format(new Date(item.inLog.timestamp), 'HH:mm:ss')}</div>
                              <div className="text-[10px] print:text-[5.5pt] print:leading-none font-sans font-medium mt-0.5 print:mt-0">
                                {item.inLog.is_late ? (
                                  <span className="text-red-600 print:text-red-700 font-semibold">
                                    {item.inLog.notes?.startsWith('PIKET:') ? 'Terlambat (Piket)' : 'Terlambat'}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 print:text-emerald-800 font-semibold">
                                    {item.inLog.notes?.startsWith('PIKET:') ? 'Tepat Waktu (Piket)' : 'Tepat Waktu'}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-400 italic text-xs print:text-[6.5pt]">-</span>
                        )}
                      </td>

                      {/* Absen Pulang */}
                      <td className="px-3 py-1.5 print:px-1 print:py-0.5">
                        {isOffDay ? (
                          <span className="text-slate-400 font-semibold print:text-slate-500 print:text-[6.5pt]">-</span>
                        ) : item.specialLog ? (
                          <span className="text-teal-700 font-semibold text-xs print:text-[6.5pt]">
                            {isCuti ? 'CUTI' : isSakit ? 'SAKIT' : isIzin ? 'IZIN' : 'TUGAS'}
                          </span>
                        ) : item.outLog ? (
                          item.outLog.notes === 'TIDAK ABSENSI PULANG' ? (
                            <span className="text-slate-400 font-semibold print:text-slate-500 print:text-[6.5pt]">-</span>
                          ) : (
                            <div className="font-mono font-semibold text-slate-900 print:text-[6.5pt] print:leading-tight">
                              <div>{format(new Date(item.outLog.timestamp), 'HH:mm:ss')}</div>
                              <div className="text-[10px] print:text-[5.5pt] print:leading-none font-sans font-medium mt-0.5 print:mt-0">
                                {item.outLog.is_late ? (
                                  <span className="text-orange-600 print:text-orange-700 font-semibold">
                                    {item.outLog.notes?.startsWith('PIKET:') ? 'Mendahului (Piket)' : 'Mendahului'}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 print:text-emerald-800 font-semibold">
                                    {item.outLog.notes?.startsWith('PIKET:') ? 'Tepat Waktu (Piket)' : 'Tepat Waktu'}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-400 italic text-xs print:text-[6.5pt]">-</span>
                        )}
                      </td>

                      {/* Keterangan / Lokasi */}
                      <td className="px-3 py-1.5 print:px-1 print:py-0.5 text-xs print:text-[6.8pt]">
                        {isOffDay ? (
                          <span className="font-medium text-slate-600 print:text-slate-700 print:text-[6.8pt]">
                            {item.isHoliday ? (item.holidayName || 'Libur Nasional') : 'Libur Jadwal Kerja'}
                          </span>
                        ) : isCuti ? (
                          <div className="font-semibold text-teal-800 print:text-slate-900 print:text-[6.8pt]">
                            {(() => {
                              const raw = item.specialLog?.notes || item.notes.find(n => n.toUpperCase().startsWith('CUTI:')) || '';
                              if (raw.toUpperCase().startsWith('CUTI:')) {
                                const reason = raw.replace(/^CUTI:\s*/i, '').trim();
                                return reason ? `Cuti: ${reason}` : 'Cuti';
                              }
                              return raw ? `Cuti: ${raw}` : 'Cuti';
                            })()}
                          </div>
                        ) : isSakit ? (
                          <span className="font-medium text-rose-800 print:text-slate-900 print:text-[6.8pt]">
                            {item.specialLog?.notes || 'Sakit'}
                          </span>
                        ) : isIzin ? (
                          <span className="font-medium text-amber-800 print:text-slate-900 print:text-[6.8pt]">
                            {item.specialLog?.notes || 'Izin'}
                          </span>
                        ) : isTugas ? (
                          <span className="font-medium text-sky-800 print:text-slate-900 print:text-[6.8pt]">
                            Perintah Tugas
                          </span>
                        ) : !hasAttendance && isPastOrToday ? (
                          <span className="font-medium text-red-600 print:text-red-700 print:text-[6.8pt]">
                            Tidak Hadir
                          </span>
                        ) : !hasAttendance && isFuture ? (
                          <span className="text-slate-400 font-mono print:text-[6.8pt]">-</span>
                        ) : (
                          <>
                            <div className="font-semibold text-slate-800 print:text-slate-900 print:text-[6.8pt]">
                              {item.officeName || officeName}
                            </div>
                            {item.piketLogs.length > 0 && (
                              <div className="mt-0.5 print:hidden">
                                <span className="inline-block px-1.5 py-0 bg-indigo-50 text-indigo-700 rounded text-[9px] font-semibold border border-indigo-200">
                                  Piket
                                </span>
                              </div>
                            )}
                            {item.notes.length > 0 && (
                              <div className="space-y-0.5 mt-0.5 print:hidden">
                                {item.notes.map((note, nIdx) => (
                                  <div key={nIdx} className="text-slate-500 italic text-[10px]">
                                    "{note}"
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Status Kehadiran */}
                      <td className="px-3 py-1.5 print:px-1 print:py-0.5 text-center whitespace-nowrap">
                        {isOffDay ? (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-semibold print:text-[6.5pt] print:bg-transparent print:border print:border-slate-300">
                            Libur
                          </span>
                        ) : isCuti ? (
                          <span className="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-bold border border-teal-200 print:text-[6.5pt] print:border-slate-400">
                            Cuti
                          </span>
                        ) : isSakit ? (
                          <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-xs font-bold border border-rose-200 print:text-[6.5pt] print:border-slate-400">
                            Sakit
                          </span>
                        ) : isIzin ? (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-bold border border-amber-200 print:text-[6.5pt] print:border-slate-400">
                            Izin
                          </span>
                        ) : isTugas ? (
                          <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded text-xs font-bold border border-sky-200 print:text-[6.5pt] print:border-slate-400">
                            Tugas
                          </span>
                        ) : hasValidIn && hasValidOut ? (
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-bold border border-emerald-200 print:text-[6.5pt] print:border-slate-400">
                            {item.piketLogs.length > 0 ? 'Piket Lengkap' : 'Hadir Lengkap'}
                          </span>
                        ) : hasValidIn ? (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-bold border border-amber-200 print:text-[6.5pt] print:border-slate-400">
                            {item.piketLogs.length > 0 ? 'Piket Masuk' : 'Hadir Masuk'}
                          </span>
                        ) : hasValidOut ? (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-bold border border-amber-200 print:text-[6.5pt] print:border-slate-400">
                            {item.piketLogs.length > 0 ? 'Piket Pulang' : 'Hadir Pulang'}
                          </span>
                        ) : !hasAttendance && isPastOrToday ? (
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-xs font-bold border border-red-200 print:text-[6.5pt] print:border-slate-400">
                            Tidak Hadir
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-slate-50 text-slate-700 rounded text-xs font-bold border border-slate-200 print:text-[6.5pt] print:border-slate-400">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* FORMAT RINCI (Setiap Log 1 Baris - Compact Print) */
            <table className="w-full text-sm text-left print:text-[8pt] print:leading-tight border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                <tr>
                  <th className="px-3 py-2 w-10 text-center print:px-1.5 print:py-1">No</th>
                  <th className="px-3 py-2 print:px-1.5 print:py-1 whitespace-nowrap">Tanggal</th>
                  <th className="px-3 py-2 print:px-1.5 print:py-1 whitespace-nowrap">Jam</th>
                  {/* CRITICAL: Always show Pegawai Name column if printing for all users */}
                  {!filterUser && (
                    <th className="px-3 py-2 print:px-1.5 print:py-1">Nama Pegawai</th>
                  )}
                  <th className="px-3 py-2 print:px-1.5 print:py-1">Tipe Absensi</th>
                  <th className="px-3 py-2 print:px-1.5 print:py-1">Lokasi / Kantor</th>
                  <th className="px-3 py-2 print:px-1.5 print:py-1">Status</th>
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
                      <td className="px-3 py-1.5 text-center text-xs text-slate-400 font-mono print:px-1.5 print:py-1 print:text-slate-800">
                        {index + 1}
                      </td>

                      {/* Tanggal */}
                      <td className="px-3 py-1.5 font-mono text-slate-700 print:px-1.5 print:py-1 print:text-slate-900 whitespace-nowrap">
                        <div className="font-semibold">{format(new Date(log.timestamp), 'dd/MM/yyyy')}</div>
                        <div className="text-[10px] text-slate-400 print:hidden">
                          {format(new Date(log.timestamp), 'EEEE', { locale: id })}
                        </div>
                      </td>

                      {/* Jam */}
                      <td className="px-3 py-1.5 font-mono text-slate-700 print:px-1.5 print:py-1 print:text-slate-900 whitespace-nowrap">
                        {(log.type === 'IZIN' && log.notes?.startsWith('CUTI:')) || log.notes === 'TIDAK ABSENSI MASUK' || log.notes === 'TIDAK ABSENSI PULANG' ? (
                          <span className="text-slate-400 font-semibold">-</span>
                        ) : (
                          <div>
                            <div className="font-semibold">{format(new Date(log.timestamp), 'HH:mm:ss')}</div>
                            <div className="text-[10px] print:text-[6.5pt] font-sans font-medium mt-0.5 print:mt-0">
                              {log.notes === 'Koreksi Absensi (Lupa Absen)' ? (
                                <span className="text-emerald-700 print:text-emerald-800 font-semibold">Tepat Waktu</span>
                              ) : log.type === 'IN' ? (
                                log.is_late ? (
                                  <span className="text-red-600 print:text-red-700 font-semibold">
                                    {log.notes?.startsWith('PIKET:') ? 'Terlambat (Piket)' : 'Terlambat'}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 print:text-emerald-800 font-semibold">
                                    {log.notes?.startsWith('PIKET:') ? 'Tepat Waktu (Piket)' : 'Tepat Waktu'}
                                  </span>
                                )
                              ) : log.type === 'OUT' ? (
                                log.is_late ? (
                                  <span className="text-orange-600 print:text-orange-700 font-semibold">
                                    {log.notes?.startsWith('PIKET:') ? 'Mendahului (Piket)' : 'Mendahului'}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 print:text-emerald-800 font-semibold">
                                    {log.notes?.startsWith('PIKET:') ? 'Tepat Waktu (Piket)' : 'Tepat Waktu'}
                                  </span>
                                )
                              ) : null}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Nama Pegawai (jika Semua Pegawai dipilih) */}
                      {!filterUser && (
                        <td className="px-3 py-1.5 print:px-1.5 print:py-1">
                          <div className="font-bold text-slate-900 leading-tight">
                            {displayName}
                          </div>
                          {displayNip && (
                            <div className="text-[10px] text-slate-400 print:text-slate-600 font-mono">
                              {(logUser?.nip_type || (displayNip.replace(/\s+/g, '').length === 21 ? 'NIPPPK' : 'NIP'))}: {displayNip}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Tipe Badge */}
                      <td className="px-3 py-1.5 print:px-1.5 print:py-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border print:border-slate-400 ${
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
                      <td className="px-3 py-1.5 text-xs print:px-1.5 print:py-1">
                        {log.notes?.toUpperCase().startsWith('CUTI:') ? (
                          <div className="font-semibold text-teal-800 print:text-slate-900">
                            {log.notes.replace(/^CUTI:\s*/i, 'Cuti: ')}
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold text-slate-800 print:text-slate-900">
                              {log.notes?.startsWith('PIKET_SCHEDULE:::') ? 'Lokasi Khusus Piket' : (log.office_name || officeName)}
                            </div>
                            {log.notes?.startsWith('PIKET:') && (
                              <div className="mt-0.5">
                                <span className="inline-block px-1.5 py-0 bg-indigo-50 text-indigo-700 rounded text-[9px] font-semibold border border-indigo-200 print:border-slate-300">
                                  Piket
                                </span>
                              </div>
                            )}
                            {log.notes && 
                             !log.notes.startsWith('PIKET:') && 
                             !log.notes.startsWith('PIKET_SCHEDULE:::') && 
                             log.notes !== 'Koreksi Absensi (Lupa Absen)' && 
                             !log.notes.toLowerCase().includes('lupa absen') && 
                             !log.notes.toLowerCase().includes('koreksi absensi') && 
                             log.notes !== 'TIDAK ABSENSI MASUK' && 
                             log.notes !== 'TIDAK ABSENSI PULANG' && (
                              <div className="text-[10px] text-slate-500 italic mt-0.5 print:text-slate-600">
                                "{log.notes}"
                              </div>
                            )}
                          </>
                        )}
                        {!log.notes && log.lat !== 0 && log.lng !== 0 && (
                          <div className="text-[10px] text-slate-400 print:hidden font-mono">
                            {log.lat.toFixed(5)}, {log.lng.toFixed(5)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-1.5 print:px-1.5 print:py-1">
                        {log.notes === 'TIDAK ABSENSI MASUK' || log.notes === 'TIDAK ABSENSI PULANG' ? (
                          <span className="text-red-600 font-bold text-xs print:text-[8pt]">Tidak Hadir</span>
                        ) : log.type === 'IZIN' && log.notes?.startsWith('CUTI:') ? (
                          <span className="text-teal-700 font-semibold text-xs print:text-[8pt]">Cuti Disetujui</span>
                        ) : log.type === 'SAKIT' ? (
                          <span className="text-rose-700 font-semibold text-xs print:text-[8pt]">Sakit</span>
                        ) : log.type === 'IZIN' ? (
                          <span className="text-amber-700 font-semibold text-xs print:text-[8pt]">Izin</span>
                        ) : log.type === 'TUGAS' ? (
                          <span className="text-sky-700 font-semibold text-xs print:text-[8pt]">Perintah Tugas</span>
                        ) : log.notes === 'Koreksi Absensi (Lupa Absen)' ? (
                          <span className="text-emerald-700 font-semibold text-xs print:text-[8pt]">Tepat Waktu</span>
                        ) : log.notes?.startsWith('PIKET:') ? (
                          log.type === 'IN' ? (
                            log.is_late ? (
                              <span className="text-red-600 font-semibold text-xs print:text-[8pt]">Terlambat (Piket)</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold text-xs print:text-[8pt]">Tepat Waktu (Piket)</span>
                            )
                          ) : (
                            log.is_late ? (
                              <span className="text-orange-600 font-semibold text-xs print:text-[8pt]">Mendahului (Piket)</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold text-xs print:text-[8pt]">Tepat Waktu (Piket)</span>
                            )
                          )
                        ) : log.type === 'IN' ? (
                          log.is_late ? (
                            <span className="text-red-600 font-semibold text-xs print:text-[8pt]">Terlambat</span>
                          ) : (
                            <span className="text-emerald-700 font-semibold text-xs print:text-[8pt]">Tepat Waktu</span>
                          )
                        ) : log.type === 'OUT' ? (
                          log.is_late ? (
                            <span className="text-orange-600 font-semibold text-xs print:text-[8pt]">Mendahului</span>
                          ) : (
                            <span className="text-emerald-700 font-semibold text-xs print:text-[8pt]">Tepat Waktu</span>
                          )
                        ) : (
                          <span className="text-slate-600 font-semibold text-xs print:text-[8pt]">Tepat Waktu</span>
                        )}

                        {/* Special clean note preview */}
                        {log.notes && !log.notes.startsWith('CUTI:') && !log.notes.startsWith('PIKET_SCHEDULE:::') && !log.notes.startsWith('PIKET:') && log.notes !== 'Koreksi Absensi (Lupa Absen)' && log.notes !== 'TIDAK ABSENSI MASUK' && log.notes !== 'TIDAK ABSENSI PULANG' && (
                          <div className="text-[10px] text-slate-400 mt-0.5 italic max-w-xs truncate print:text-[7.5pt]" title={log.notes}>
                            "{log.notes}"
                          </div>
                        )}
                        {log.notes?.startsWith('CUTI:') && (
                          <div className="text-[10px] text-slate-400 mt-0.5 italic max-w-xs truncate print:text-[7.5pt]" title={log.notes}>
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
        <div className="hidden print:grid grid-cols-2 gap-4 mt-2 print:mt-1 px-6 pb-0 break-inside-avoid text-center">
          {/* Pihak 1 (Kiri): Atasan Langsung / Kepala Sekolah */}
          <div className="flex flex-col items-center">
            <div className="h-7 print:h-5 flex flex-col justify-end items-center">
              <p className="text-[7.5pt] print:text-[6.8pt] text-slate-700 leading-tight">Mengetahui,</p>
              <p className="text-[7.5pt] print:text-[6.8pt] text-slate-700 font-medium leading-tight">Kepala Sekolah / Atasan Langsung</p>
            </div>
            <div className="h-8 print:h-5"></div>
            <div className="w-full flex flex-col items-center">
              <div className="border-b border-slate-900 w-40 mb-0.5"></div>
              <p className="text-[8pt] print:text-[7.5pt] font-bold text-slate-900 leading-tight">
                {headmaster ? headmaster.name : '__________________________'}
              </p>
              <p className="text-[7pt] print:text-[6.5pt] text-slate-600 font-mono leading-tight mt-0.5">
                {headmaster?.nip_type || 'NIP'}: {headmaster?.nip || '__________________________'}
              </p>
            </div>
          </div>

          {/* Pihak 2 (Kanan): Pegawai yang bersangkutan */}
          <div className="flex flex-col items-center">
            <div className="h-7 print:h-5 flex flex-col justify-end items-center">
              <p className="text-[7.5pt] print:text-[6.8pt] text-slate-700 font-medium leading-tight">
                {selectedUser ? 'Pegawai yang bersangkutan,' : 'Dibuat & Diverifikasi oleh,'}
              </p>
            </div>
            <div className="h-8 print:h-5"></div>
            <div className="w-full flex flex-col items-center">
              <div className="border-b border-slate-900 w-40 mb-0.5"></div>
              <p className="text-[8pt] print:text-[7.5pt] font-bold text-slate-900 leading-tight">
                {selectedUser ? selectedUser.name : user.name}
              </p>
              <p className="text-[7pt] print:text-[6.5pt] text-slate-600 font-mono leading-tight mt-0.5">
                {selectedUser ? (
                  <>{selectedEmployeeNipType}: {selectedEmployeeNip || '____________________'}</>
                ) : (
                  <>{user.nip_type || 'NIP'}: {user.nip || '____________________'}</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
