import { User, Office, AttendanceLog } from '../types';

export const api = {
  getOffices: async (): Promise<Office[]> => {
    const res = await fetch('/api/offices');
    return res.json();
  },

  createOffice: async (office: Omit<Office, 'id'>): Promise<void> => {
    await fetch('/api/offices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(office),
    });
  },

  updateOffice: async (id: number, office: Omit<Office, 'id'>): Promise<void> => {
    await fetch(`/api/offices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(office),
    });
  },

  deleteOffice: async (id: number): Promise<void> => {
    const res = await fetch(`/api/offices/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete');
    }
  },

  getUsers: async (): Promise<User[]> => {
    const res = await fetch('/api/users');
    return res.json();
  },

  assignUserToOffice: async (userId: number, officeId: number): Promise<void> => {
    await fetch(`/api/users/${userId}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ office_id: officeId }),
    });
  },

  register: async (data: { name: string, office_id?: number, email: string, supabase_id: string, new_office_name?: string }): Promise<User> => {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  loginSync: async (email: string): Promise<User> => {
    const res = await fetch('/api/login-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('User not found');
    return res.json();
  },

  submitSpecialAttendance: async (data: { user_id: number, type: string, date: string, notes: string }): Promise<void> => {
    await fetch('/api/attendance/special', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateUser: async (id: number, data: Partial<User>): Promise<void> => {
    await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  submitAttendance: async (data: {
    user_id: number;
    type: 'IN' | 'OUT';
    lat: number;
    lng: number;
    photo_url: string;
  }): Promise<void> => {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Submission failed');
    }
  },

  getAttendance: async (filters: {
    user_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<AttendanceLog[]> => {
    const params = new URLSearchParams();
    if (filters.user_id) params.append('user_id', filters.user_id.toString());
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    
    const res = await fetch(`/api/attendance?${params.toString()}`);
    return res.json();
  },

  getLeaves: async (userId?: number): Promise<any[]> => {
    const url = userId ? `/api/leaves?user_id=${userId}` : '/api/leaves';
    const res = await fetch(url);
    return res.json();
  },

  requestLeave: async (data: any): Promise<void> => {
    await fetch('/api/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateLeaveStatus: async (id: number, status: string, adminReason: string): Promise<void> => {
    await fetch(`/api/leaves/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_reason: adminReason }),
    });
  },

  markLeaveRead: async (id: number): Promise<void> => {
    await fetch(`/api/leaves/${id}/read`, {
      method: 'PUT',
    });
  },

  getCorrections: async (userId?: number): Promise<any[]> => {
    const url = userId ? `/api/corrections?user_id=${userId}` : '/api/corrections';
    const res = await fetch(url);
    return res.json();
  },

  requestCorrection: async (data: any): Promise<void> => {
    await fetch('/api/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  verifyCorrection: async (id: number, status: string, verifiedBy: number): Promise<void> => {
    await fetch(`/api/corrections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, verified_by: verifiedBy }),
    });
  },
};
