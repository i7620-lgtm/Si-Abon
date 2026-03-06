export interface User {
  id: number;
  name: string;
  role: 'employee' | 'admin' | 'headmaster' | 'dinas' | 'super_admin';
  department: string;
  office_id?: number;
  office_name?: string;
  nip?: string;
  photo_url?: string;
  leave_quota?: number;
  email?: string;
  supabase_id?: string;
  assigned_offices?: number[]; // IDs of Tugas Luar offices
}

export interface LeaveRequest {
  id: number;
  user_id: number;
  name?: string;
  role?: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'diterima' | 'ditolak';
  admin_reason?: string;
  is_read: boolean;
  created_at: string;
}

export interface AttendanceCorrection {
  id: number;
  user_id: number;
  name?: string;
  role?: string;
  date: string;
  type: 'IN' | 'OUT';
  reason: string;
  status: 'pending' | 'verified' | 'rejected';
  verified_by?: number;
  created_at: string;
}

export interface OfficeSchedule {
  start_in: string;
  end_in: string;
  start_out: string;
  end_out: string;
  is_off?: boolean;
}

export interface Office {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_meters: number;
  start_in_time: string;
  end_in_time: string;
  start_out_time: string;
  end_out_time: string;
  schedule?: Record<number, OfficeSchedule>;
  is_tugas_luar?: boolean;
}

export interface AttendanceLog {
  id: number;
  user_id: number;
  name: string;
  role: string;
  department: string;
  type: 'IN' | 'OUT' | 'SAKIT' | 'IZIN' | 'TUGAS';
  timestamp: string;
  lat: number;
  lng: number;
  photo_url: string;
  is_late: boolean;
  notes?: string;
  office_name?: string;
}
