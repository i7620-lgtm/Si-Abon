import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, Office } from '../types';
import LeafletMap from './Map';
import { Plus, Trash2, Edit2, Save, X, UserPlus } from 'lucide-react';

export default function SettingsPanel({ onUserUpdate }: { onUserUpdate?: () => void }) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [editingOffice, setEditingOffice] = useState<Partial<Office> | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [specialAttendance, setSpecialAttendance] = useState({
    user_id: 0,
    type: 'SAKIT',
    date: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [officesData, usersData] = await Promise.all([
      api.getOffices(),
      api.getUsers()
    ]);
    setOffices(officesData);
    setUsers(usersData);
  };

  const handleSaveOffice = async () => {
    if (!editingOffice || !editingOffice.name) return;

    try {
      if (editingOffice.id) {
        await api.updateOffice(editingOffice.id, editingOffice as Office);
      } else {
        await api.createOffice(editingOffice as Office);
      }
      setEditingOffice(null);
      setIsCreating(false);
      loadData();
    } catch (e) {
      alert('Gagal menyimpan kantor');
    }
  };

  const handleDeleteOffice = async (id: number) => {
    // Check if any users are assigned to this office locally first
    const assignedUsers = users.filter(u => u.office_id === id);
    if (assignedUsers.length > 0) {
      alert(`Tidak dapat menghapus kantor ini karena masih ada ${assignedUsers.length} pegawai yang terdaftar di kantor ini. Pindahkan pegawai tersebut terlebih dahulu.`);
      return;
    }

    if (confirm('Apakah Anda yakin ingin menghapus kantor ini?')) {
      try {
        await api.deleteOffice(id);
        loadData();
      } catch (e: any) {
        console.error('Delete office error:', e);
        alert('Gagal menghapus kantor. Pastikan Anda sudah menjalankan SQL Policy untuk DELETE di Supabase.');
      }
    }
  };

  const handleAssignUser = async (userId: number, officeId: number) => {
    try {
      await api.assignUserToOffice(userId, officeId);
      loadData();
      if (onUserUpdate) onUserUpdate();
    } catch (e) {
      alert('Gagal menetapkan kantor');
    }
  };

  const handleUpdateRole = async (userId: number, role: string) => {
    try {
      await api.updateUser(userId, { role: role as any });
      loadData();
      if (onUserUpdate) onUserUpdate();
    } catch (e) {
      alert('Gagal mengubah role');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (confirm('Apakah Anda yakin ingin menghapus pegawai ini?')) {
      try {
        await api.deleteUser(userId);
        loadData();
        if (onUserUpdate) onUserUpdate();
      } catch (e) {
        alert('Gagal menghapus pegawai');
      }
    }
  };

  const handleSubmitSpecial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialAttendance.user_id || !specialAttendance.date) return;
    try {
      await api.submitSpecialAttendance(specialAttendance);
      alert('Absensi berhasil dicatat');
      setSpecialAttendance({ user_id: 0, type: 'SAKIT', date: '', notes: '' });
    } catch (e) {
      alert('Gagal mencatat absensi');
    }
  };

  const startEdit = (office: Office) => {
    setEditingOffice(office);
    setIsCreating(false);
  };

  const startCreate = () => {
    setEditingOffice({
      name: '',
      lat: -6.2088,
      lng: 106.8456,
      radius_meters: 100,
      start_in_time: '06:30',
      end_in_time: '08:00',
      start_out_time: '16:00',
      end_out_time: '18:00'
    });
    setIsCreating(true);
  };

  if (editingOffice) {
    return (
      <div className="p-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800">
            {isCreating ? 'Tambah Kantor Baru' : 'Edit Kantor'}
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setEditingOffice(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Batal
            </button>
            <button 
              onClick={handleSaveOffice}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Simpan
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6">
          <div className="h-64 relative">
            <LeafletMap 
              center={[editingOffice.lat || -6.2, editingOffice.lng || 106.8]} 
              radius={editingOffice.radius_meters}
              interactive={true}
              onLocationSelect={(lat, lng) => setEditingOffice({ ...editingOffice, lat, lng })}
            />
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg text-xs font-medium shadow-sm z-[400]">
              Klik peta untuk menentukan lokasi
            </div>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Nama Kantor</label>
              <input 
                type="text" 
                value={editingOffice.name}
                onChange={e => setEditingOffice({...editingOffice, name: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Contoh: Kantor Cabang Jakarta"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Radius (Meter)</label>
              <input 
                type="number" 
                value={editingOffice.radius_meters}
                onChange={e => setEditingOffice({...editingOffice, radius_meters: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <input 
                type="checkbox" 
                id="is_tugas_luar"
                checked={editingOffice.is_tugas_luar || false}
                onChange={e => setEditingOffice({...editingOffice, is_tugas_luar: e.target.checked})}
                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <label htmlFor="is_tugas_luar" className="block text-sm font-bold text-emerald-800 cursor-pointer">Lokasi Tugas Luar</label>
                <p className="text-[10px] text-emerald-600">Aktifkan jika lokasi ini adalah lokasi kegiatan luar kantor (bukan kantor utama).</p>
              </div>
            </div>

            <div className="col-span-2 mt-4">
              <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">Pengaturan Jam Kerja Harian (Opsional)</h3>
              <p className="text-xs text-slate-500 mb-4">Jika diisi, pengaturan harian ini akan menimpa pengaturan jam kerja umum di atas.</p>
              
              <div className="space-y-3">
                {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((dayName, dayIdx) => {
                  const schedule = (editingOffice.schedule || {})[dayIdx] || {
                    start_in: editingOffice.start_in_time || '07:30',
                    end_in: editingOffice.end_in_time || '08:30',
                    start_out: editingOffice.start_out_time || '16:00',
                    end_out: editingOffice.end_out_time || '17:00',
                    is_off: false
                  };

                  const updateDay = (field: string, value: any) => {
                    const newSchedule = { ...(editingOffice.schedule || {}) };
                    newSchedule[dayIdx] = { ...schedule, [field]: value };
                    setEditingOffice({ ...editingOffice, schedule: newSchedule });
                  };

                  return (
                    <div key={dayIdx} className="grid grid-cols-1 lg:grid-cols-6 gap-3 items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-bold text-slate-700 text-sm lg:col-span-1">{dayName}</div>
                      
                      <div className="flex items-center gap-2 lg:col-span-1">
                        <input 
                          type="checkbox" 
                          id={`off-${dayIdx}`}
                          checked={schedule.is_off}
                          onChange={e => updateDay('is_off', e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <label htmlFor={`off-${dayIdx}`} className="text-xs text-slate-600">Libur</label>
                      </div>

                      {!schedule.is_off && (
                        <>
                          <div className="lg:col-span-2 grid grid-cols-2 gap-2">
                            <input 
                              type="time" 
                              value={schedule.start_in}
                              onChange={e => updateDay('start_in', e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                            />
                            <input 
                              type="time" 
                              value={schedule.end_in}
                              onChange={e => updateDay('end_in', e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                            />
                          </div>
                          <div className="lg:col-span-2 grid grid-cols-2 gap-2">
                            <input 
                              type="time" 
                              value={schedule.start_out}
                              onChange={e => updateDay('start_out', e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                            />
                            <input 
                              type="time" 
                              value={schedule.end_out}
                              onChange={e => updateDay('end_out', e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                            />
                          </div>
                        </>
                      )}
                      {schedule.is_off && <div className="lg:col-span-4 text-xs text-slate-400 italic">Kantor libur / tidak ada absensi</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">Daftar Kantor</h2>
        <button 
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          <Plus size={16} /> Tambah Kantor
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {offices.map(office => {
          const now = new Date();
          const dayOfWeek = now.getDay();
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

          return (
            <div key={office.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-800">{office.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {office.lat.toFixed(4)}, {office.lng.toFixed(4)} • Radius {office.radius_meters}m
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(office)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDeleteOffice(office.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <p className="text-xs text-emerald-600 font-medium mb-1">Jam Masuk</p>
                  {isOff ? (
                    <p className="font-bold text-red-600">Libur</p>
                  ) : (
                    <p className="font-mono text-emerald-900">{startIn} - {endIn}</p>
                  )}
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <p className="text-xs text-orange-600 font-medium mb-1">Jam Pulang</p>
                  {isOff ? (
                    <p className="font-bold text-red-600">Libur</p>
                  ) : (
                    <p className="font-mono text-orange-900">{startOut} - {endOut}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="text-xl font-bold text-slate-800 mb-6">Penempatan & Manajemen Pegawai</h2>
      
      {/* Special Attendance Form */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <h3 className="font-bold text-slate-800 mb-4">Input Absensi Khusus (Sakit / Izin / Tugas)</h3>
        <form onSubmit={handleSubmitSpecial} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Pegawai</label>
            <select 
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={specialAttendance.user_id || ''}
              onChange={e => setSpecialAttendance({...specialAttendance, user_id: parseInt(e.target.value)})}
            >
              <option value="">Pilih Pegawai...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tanggal</label>
            <input 
              type="date" 
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={specialAttendance.date}
              onChange={e => setSpecialAttendance({...specialAttendance, date: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Jenis</label>
            <select 
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={specialAttendance.type}
              onChange={e => setSpecialAttendance({...specialAttendance, type: e.target.value})}
            >
              <option value="SAKIT">Sakit</option>
              <option value="IZIN">Izin</option>
              <option value="TUGAS">Perintah Tugas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Keterangan / No. Surat</label>
            <input 
              type="text" 
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="Keterangan..."
              value={specialAttendance.notes}
              onChange={e => setSpecialAttendance({...specialAttendance, notes: e.target.value})}
            />
          </div>
          <div className="lg:col-span-4 flex justify-end">
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
              Simpan Absensi
            </button>
          </div>
        </form>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Nama Pegawai</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Kantor Utama</th>
              <th className="px-6 py-4">Lokasi Tugas Luar</th>
              <th className="px-6 py-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                <td className="px-6 py-4">
                  <select 
                    className="px-2 py-1 bg-white border border-slate-200 rounded text-xs capitalize"
                    value={u.role}
                    onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                  >
                    <option value="employee">Pegawai</option>
                    <option value="admin">Admin</option>
                    <option value="headmaster">Kepala Sekolah</option>
                    <option value="dinas">Dinas</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <select 
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                    value={u.office_id || ''}
                    onChange={(e) => handleAssignUser(u.id, parseInt(e.target.value))}
                  >
                    <option value="">Pilih Kantor...</option>
                    {offices.filter(o => !o.is_tugas_luar).map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {offices.filter(o => o.is_tugas_luar).map(o => {
                      const isAssigned = u.assigned_offices?.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          onClick={() => {
                            const current = u.assigned_offices || [];
                            const next = isAssigned 
                              ? current.filter(id => id !== o.id)
                              : [...current, o.id];
                            api.updateUser(u.id, { assigned_offices: next }).then(() => {
                              loadData();
                              if (onUserUpdate) onUserUpdate();
                            });
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                            isAssigned 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {o.name}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {users.map(u => (
          <div key={u.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-slate-800">{u.name}</h3>
                <div className="mt-1">
                  <select 
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs capitalize"
                    value={u.role}
                    onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                  >
                    <option value="employee">Pegawai</option>
                    <option value="admin">Admin</option>
                    <option value="headmaster">Kepala Sekolah</option>
                    <option value="dinas">Dinas</option>
                  </select>
                </div>
              </div>
              {u.office_name ? (
                <span className="px-2 py-1 bg-slate-100 rounded text-slate-700 text-[10px] font-bold uppercase">
                  {u.office_name}
                </span>
              ) : (
                <span className="px-2 py-1 bg-slate-50 rounded text-slate-400 text-[10px] italic">
                  Belum ditempatkan
                </span>
              )}
            </div>
            
            <div className="mt-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Pindahkan Kantor
              </label>
              <select 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={u.office_id || ''}
                onChange={(e) => handleAssignUser(u.id, parseInt(e.target.value))}
              >
                <option value="">Pilih Kantor...</option>
                {offices.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
