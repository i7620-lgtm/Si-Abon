import { supabase } from '../lib/supabase';
import { User, Office, AttendanceLog, LeaveRequest, CorrectionRequest } from '../types';

export const api = {
  getOffices: async (): Promise<Office[]> => {
    const { data, error } = await supabase.from('offices').select('*');
    if (error) throw error;
    return data || [];
  },

  createOffice: async (office: Omit<Office, 'id'>): Promise<void> => {
    const { error } = await supabase.from('offices').insert([office]);
    if (error) throw error;
  },

  updateOffice: async (id: number, office: Omit<Office, 'id'>): Promise<void> => {
    const { error } = await supabase.from('offices').update(office).eq('id', id);
    if (error) throw error;
  },

  deleteOffice: async (id: number): Promise<void> => {
    const { error } = await supabase.from('offices').delete().eq('id', id);
    if (error) throw error;
  },

  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*, offices(name)')
      .order('name');
    
    if (error) throw error;
    
    // Map office name
    return (data || []).map((u: any) => ({
      ...u,
      office_name: u.offices?.name
    }));
  },

  assignUserToOffice: async (userId: number, officeId: number): Promise<void> => {
    const { error } = await supabase.from('users').update({ office_id: officeId }).eq('id', userId);
    if (error) throw error;
  },

  register: async (data: { name: string, office_id?: number, email: string, supabase_id: string, new_office_name?: string }): Promise<User> => {
    let finalOfficeId = data.office_id;

    // Handle new office creation
    if (data.new_office_name) {
      const { data: newOffice, error: officeError } = await supabase.from('offices').insert([{
        name: data.new_office_name,
        lat: -6.2088,
        lng: 106.8456,
        radius_meters: 100,
        start_in_time: '06:30',
        end_in_time: '08:00',
        start_out_time: '16:00',
        end_out_time: '18:00'
      }]).select().single();
      
      if (officeError) {
        console.error('Office creation error:', officeError);
        throw new Error(`Gagal membuat kantor: ${officeError.message}`);
      }
      finalOfficeId = newOffice.id;
    }

    // Determine role
    let role = 'employee';
    if (data.new_office_name) {
      role = 'admin';
    } else if (finalOfficeId) {
       const { count, error } = await supabase
         .from('users')
         .select('*', { count: 'exact', head: true })
         .eq('office_id', finalOfficeId);
       
       if (!error && count === 0) role = 'admin';
    }
    
    const { data: newUser, error: userError } = await supabase.from('users').insert([{
      name: data.name,
      role,
      office_id: finalOfficeId,
      email: data.email,
      supabase_id: data.supabase_id
    }]).select('*, offices(name)').single();

    if (userError) {
      console.error('User registration error:', userError);
      throw new Error(`Gagal mendaftarkan user: ${userError.message}`);
    }

    return {
      ...newUser,
      office_name: newUser.offices?.name
    };
  },

  loginSync: async (email: string): Promise<User> => {
    const { data, error } = await supabase
      .from('users')
      .select('*, offices(name)')
      .eq('email', email)
      .single();

    if (error || !data) throw new Error('User not found');
    
    return {
      ...data,
      office_name: data.offices?.name
    };
  },

  submitSpecialAttendance: async (data: { user_id: number, type: string, date: string, notes: string }): Promise<void> => {
    const timestamp = `${data.date}T08:00:00`; // Default morning time
    const { error } = await supabase.from('attendance').insert([{
      user_id: data.user_id,
      type: data.type,
      timestamp,
      lat: 0,
      lng: 0,
      photo_url: '',
      is_late: false,
      notes: data.notes
    }]);
    if (error) throw error;
  },

  updateUser: async (id: number, data: Partial<User>): Promise<void> => {
    const { error } = await supabase.from('users').update(data).eq('id', id);
    if (error) throw error;
  },

  submitAttendance: async (data: {
    user_id: number;
    type: 'IN' | 'OUT';
    lat: number;
    lng: number;
    photo_url: string;
  }): Promise<void> => {
    // Fetch user office settings for validation
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*, offices(*)')
      .eq('id', data.user_id)
      .single();
      
    if (userError || !user || !user.offices) throw new Error('User or office not found');

    const office = user.offices;
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    if (data.type === 'IN') {
       if (currentTime < office.start_in_time || currentTime > office.end_in_time) {
         throw new Error(`Absen Masuk hanya bisa dilakukan antara ${office.start_in_time} - ${office.end_in_time}`);
       }
    } else if (data.type === 'OUT') {
       if (currentTime < office.start_out_time || currentTime > office.end_out_time) {
         throw new Error(`Absen Pulang hanya bisa dilakukan antara ${office.start_out_time} - ${office.end_out_time}`);
       }
    }

    const { error } = await supabase.from('attendance').insert([{
      user_id: data.user_id,
      type: data.type,
      lat: data.lat,
      lng: data.lng,
      photo_url: data.photo_url,
      is_late: false // Simplified logic
    }]);

    if (error) throw error;
  },

  getAttendance: async (filters: {
    user_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<AttendanceLog[]> => {
    let query = supabase
      .from('attendance')
      .select('*, users(name, role, department)')
      .order('timestamp', { ascending: false });

    if (filters.user_id) query = query.eq('user_id', filters.user_id);
    if (filters.start_date) query = query.gte('timestamp', filters.start_date);
    if (filters.end_date) query = query.lte('timestamp', filters.end_date);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((a: any) => ({
      ...a,
      name: a.users?.name,
      role: a.users?.role,
      department: a.users?.department
    }));
  },

  getLeaves: async (userId?: number): Promise<any[]> => {
    let query = supabase
      .from('leave_requests')
      .select('*, users(name, role)')
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((l: any) => ({
      ...l,
      name: l.users?.name,
      role: l.users?.role
    }));
  },

  requestLeave: async (data: any): Promise<void> => {
    const { error } = await supabase.from('leave_requests').insert([data]);
    if (error) throw error;
  },

  updateLeaveStatus: async (id: number, status: string, adminReason: string): Promise<void> => {
    const { error } = await supabase.from('leave_requests').update({
      status,
      admin_reason: adminReason,
      is_read: false
    }).eq('id', id);
    if (error) throw error;

    // If approved, decrement quota (logic simplified, ideally handled by DB trigger or edge function)
    if (status === 'diterima') {
      // Fetch leave details first
      const { data: leave } = await supabase.from('leave_requests').select('*').eq('id', id).single();
      if (leave) {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        // Decrement user quota
        const { data: user } = await supabase.from('users').select('leave_quota').eq('id', leave.user_id).single();
        if (user) {
           await supabase.from('users').update({ leave_quota: (user.leave_quota || 12) - diffDays }).eq('id', leave.user_id);
        }
      }
    }
  },

  markLeaveRead: async (id: number): Promise<void> => {
    const { error } = await supabase.from('leave_requests').update({ is_read: true }).eq('id', id);
    if (error) throw error;
  },

  getCorrections: async (userId?: number): Promise<any[]> => {
    let query = supabase
      .from('attendance_corrections')
      .select('*, users!user_id(name, role)')
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((c: any) => ({
      ...c,
      name: c.users?.name,
      role: c.users?.role
    }));
  },

  requestCorrection: async (data: any): Promise<void> => {
    const { error } = await supabase.from('attendance_corrections').insert([data]);
    if (error) throw error;
  },

  verifyCorrection: async (id: number, status: string, verifiedBy: number): Promise<void> => {
    const { error } = await supabase.from('attendance_corrections').update({
      status,
      verified_by: verifiedBy
    }).eq('id', id);
    if (error) throw error;

    if (status === 'verified') {
       const { data: correction } = await supabase.from('attendance_corrections').select('*').eq('id', id).single();
       if (correction) {
         const time = correction.type === 'IN' ? '08:00:00' : '17:00:00';
         const timestamp = `${correction.date}T${time}`;
         
         await supabase.from('attendance').insert([{
           user_id: correction.user_id,
           type: correction.type,
           timestamp,
           lat: 0,
           lng: 0,
           photo_url: '',
           is_late: false
         }]);
       }
    }
  }
};
