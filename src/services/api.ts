import { supabase } from '../lib/supabase';
import { User, Office, AttendanceLog, LeaveRequest, AttendanceCorrection } from '../types';

export const api = {
  getOffices: async (): Promise<Office[]> => {
    const { data, error } = await supabase.from('offices').select('*');
    if (error) throw error;
    return (data || []).map(o => {
      const parts = o.name.split(':::');
      const name = parts[0];
      let schedule = undefined;
      let is_tugas_luar = false;
      if (parts[1]) {
        try {
          const meta = JSON.parse(parts[1]);
          schedule = meta.schedule;
          is_tugas_luar = meta.is_tugas_luar;
        } catch (e) {}
      }
      return { ...o, name, schedule, is_tugas_luar };
    });
  },

  createOffice: async (office: Omit<Office, 'id'>): Promise<void> => {
    const { schedule, is_tugas_luar, name, ...rest } = office as any;
    const meta = JSON.stringify({ schedule, is_tugas_luar });
    const dbName = `${name}:::${meta}`;
    const { error } = await supabase.from('offices').insert([{ ...rest, name: dbName }]);
    if (error) throw error;
  },

  updateOffice: async (id: number, office: Omit<Office, 'id'>): Promise<void> => {
    const { schedule, is_tugas_luar, name, ...rest } = office as any;
    const meta = JSON.stringify({ schedule, is_tugas_luar });
    const dbName = `${name}:::${meta}`;
    const { error } = await supabase.from('offices').update({ ...rest, name: dbName }).eq('id', id);
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
    
    return (data || []).map((u: any) => {
      let assigned_offices = [];
      let department = u.department || '';
      if (department.includes(':::')) {
        const parts = department.split(':::');
        department = parts[0];
        try {
          assigned_offices = JSON.parse(parts[1]);
        } catch (e) {}
      }
      return { 
        ...u, 
        department, 
        assigned_offices, 
        office_name: u.offices?.name?.split(':::')[0] 
      };
    });
  },

  assignUserToOffice: async (userId: number, officeId: number): Promise<void> => {
    const { error } = await supabase.from('users').update({ office_id: officeId }).eq('id', userId);
    if (error) throw error;
  },

  register: async (data: { name: string, office_id?: number, email: string, supabase_id: string, new_office_name?: string }): Promise<User> => {
    let finalOfficeId = data.office_id;

    // Handle new office creation
    if (data.new_office_name) {
      const meta = JSON.stringify({ schedule: undefined, is_tugas_luar: false });
      const dbName = `${data.new_office_name}:::${meta}`;
      const { data: newOffice, error: officeError } = await supabase.from('offices').insert([{
        name: dbName,
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
      office_name: newUser.offices?.name?.split(':::')[0]
    };
  },

  loginSync: async (email: string): Promise<User> => {
    const { data, error } = await supabase
      .from('users')
      .select('*, offices(name)')
      .eq('email', email)
      .single();

    if (error || !data) throw new Error('User not found');
    
    let assigned_offices = [];
    let department = data.department || '';
    if (department.includes(':::')) {
      const parts = department.split(':::');
      department = parts[0];
      try {
        assigned_offices = JSON.parse(parts[1]);
      } catch (e) {}
    }

    return {
      ...data,
      department,
      assigned_offices,
      office_name: data.offices?.name?.split(':::')[0]
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
    const updateData: any = { ...data };
    if (data.assigned_offices !== undefined || data.department !== undefined) {
      // Need current data to preserve one if other is missing
      const { data: current } = await supabase.from('users').select('department').eq('id', id).single();
      let currentDept = '';
      let currentAssigned = [];
      if (current?.department?.includes(':::')) {
        const parts = current.department.split(':::');
        currentDept = parts[0];
        try { currentAssigned = JSON.parse(parts[1]); } catch (e) {}
      } else {
        currentDept = current?.department || '';
      }

      const dept = data.department !== undefined ? data.department : currentDept;
      const assigned = data.assigned_offices !== undefined ? data.assigned_offices : currentAssigned;
      
      updateData.department = `${dept}:::${JSON.stringify(assigned)}`;
      delete updateData.assigned_offices;
    }
    const { error } = await supabase.from('users').update(updateData).eq('id', id);
    if (error) throw error;
  },

  deleteUser: async (id: number): Promise<void> => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
  },

  submitAttendance: async (data: {
    user_id: number;
    type: 'IN' | 'OUT';
    lat: number;
    lng: number;
    photo_url: string;
    notes?: string;
  }): Promise<void> => {
    // Fetch user office settings for validation
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*, offices(*)')
      .eq('id', data.user_id)
      .single();
      
    if (userError || !user || !user.offices) throw new Error('User or office not found');

    const rawOffice = user.offices;
    const parts = rawOffice.name.split(':::');
    const name = parts[0];
    let schedule = undefined;
    if (parts[1]) {
      try {
        const meta = JSON.parse(parts[1]);
        schedule = meta.schedule;
      } catch (e) {}
    }

    const office = { ...rawOffice, name, schedule };
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
    
    // Use daily schedule if available, otherwise fallback to default office times
    let startIn = office.start_in_time;
    let endIn = office.end_in_time;
    let startOut = office.start_out_time;
    let endOut = office.end_out_time;
    let isOff = false;

    if (office.schedule && office.schedule[dayOfWeek]) {
      const daySchedule = office.schedule[dayOfWeek];
      startIn = daySchedule.start_in || startIn;
      endIn = daySchedule.end_in || endIn;
      startOut = daySchedule.start_out || startOut;
      endOut = daySchedule.end_out || endOut;
      isOff = daySchedule.is_off || false;
    }

    if (isOff) {
      throw new Error('Hari ini adalah hari libur untuk kantor Anda.');
    }

    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const currentTimeShort = `${hours}:${minutes}`;

    let is_late = false;

    // Calculate dynamic cutoff (midpoint) between IN and OUT windows
    const endInParts = endIn.split(':').map(Number);
    const startOutParts = startOut.split(':').map(Number);
    const endInMinutes = endInParts[0] * 60 + endInParts[1];
    const startOutMinutes = startOutParts[0] * 60 + startOutParts[1];
    const midPointMinutes = endInMinutes + ((startOutMinutes - endInMinutes) / 2);
    
    const midPointHours = Math.floor(midPointMinutes / 60).toString().padStart(2, '0');
    const midPointMins = Math.floor(midPointMinutes % 60).toString().padStart(2, '0');
    const cutoffTime = `${midPointHours}:${midPointMins}`;

    if (data.type === 'IN') {
       if (currentTimeShort < startIn) {
         throw new Error(`Absen Masuk belum dimulai (Mulai: ${startIn})`);
       }
       // Allow IN until the cutoff time
       if (currentTimeShort > cutoffTime) {
         throw new Error(`Batas akhir Absen Masuk adalah pukul ${cutoffTime}`);
       }
       if (currentTimeShort > endIn) {
         is_late = true;
       }
    } else if (data.type === 'OUT') {
       // Allow OUT starting from the cutoff time
       if (currentTimeShort <= cutoffTime) {
         throw new Error(`Absen Pulang baru bisa dilakukan setelah pukul ${cutoffTime}`);
       }
       if (currentTimeShort > endOut) {
         throw new Error(`Batas akhir Absen Pulang adalah pukul ${endOut}`);
       }
       if (currentTimeShort < startOut) {
         is_late = true; // Early departure
       }
    }

    // Prevent duplicate attendance for the same type on the same day
    if (data.type === 'IN' || data.type === 'OUT') {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing, error: checkError } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', data.user_id)
        .eq('type', data.type)
        .gte('timestamp', `${today}T00:00:00`)
        .lte('timestamp', `${today}T23:59:59`)
        .maybeSingle();
      
      if (checkError) throw checkError;
      if (existing) {
        throw new Error(`Anda sudah melakukan Absen ${data.type === 'IN' ? 'Masuk' : 'Pulang'} hari ini.`);
      }
    }

    const { error } = await supabase.from('attendance').insert([{
      user_id: data.user_id,
      type: data.type,
      lat: data.lat,
      lng: data.lng,
      photo_url: data.photo_url,
      is_late: is_late,
      notes: data.notes
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
      .select('*, users(*, offices(name))')
      .order('timestamp', { ascending: false });

    if (filters.user_id) query = query.eq('user_id', filters.user_id);
    if (filters.start_date && filters.start_date !== '') query = query.gte('timestamp', `${filters.start_date}T00:00:00`);
    if (filters.end_date && filters.end_date !== '') query = query.lte('timestamp', `${filters.end_date}T23:59:59`);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((a: any) => ({
      ...a,
      name: a.users?.name,
      role: a.users?.role,
      department: a.users?.department,
      office_name: a.users?.offices?.name?.split(':::')[0]
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
         // Fetch user office to get the correct schedule
         const { data: user } = await supabase.from('users').select('*, offices(*)').eq('id', correction.user_id).single();
         
         let time = correction.type === 'IN' ? '08:00:00' : '17:00:00'; // Default fallback
         
         if (user && user.offices) {
            const rawOffice = user.offices;
            const parts = rawOffice.name.split(':::');
            let schedule = undefined;
            if (parts[1]) {
              try {
                const meta = JSON.parse(parts[1]);
                schedule = meta.schedule;
              } catch (e) {}
            }
            
            const office = { ...rawOffice, schedule };
            const dateObj = new Date(correction.date);
            const dayOfWeek = dateObj.getDay();
            
            let startIn = office.start_in_time;
            let startOut = office.start_out_time;
            
            if (office.schedule && office.schedule[dayOfWeek]) {
               const daySchedule = office.schedule[dayOfWeek];
               if (!daySchedule.is_off) {
                 startIn = daySchedule.start_in || startIn;
                 startOut = daySchedule.start_out || startOut;
               }
            }
            
            time = correction.type === 'IN' ? `${startIn}:00` : `${startOut}:00`;
         }

         const timestamp = `${correction.date}T${time}`;
         
         await supabase.from('attendance').insert([{
           user_id: correction.user_id,
           type: correction.type,
           timestamp,
           lat: 0,
           lng: 0,
           photo_url: '',
           is_late: false,
           notes: 'Koreksi Absensi (Lupa Absen)'
         }]);
       }
    }
  }
};
