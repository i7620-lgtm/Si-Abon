import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, Office } from '../types';
import LeafletMap from './Map';
import { Plus, Trash2, Edit2, Save, X, UserPlus } from 'lucide-react';

export default function SettingsPanel() {
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
    if (confirm('Apakah Anda yakin ingin menghapus kantor ini?')) {
      try {
        await api.deleteOffice(id);
        loadData();
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  const handleAssignUser = async (userId: number, officeId: number) => {
    try {
      await api.assignUserToOffice(userId, officeId);
      loadData();
    } catch (e) {
      alert('Gagal menetapkan kantor');
    }
  };

  const handleUpdateRole = async (userId: number, role: string) => {
    try {
      await api.updateUser(userId, { role: role as any });
      loadData();
    } catch (e) {
      alert('Gagal mengubah role');
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Jam Masuk (Mulai)</label>
                <input 
                  type="time" 
                  value={editingOffice.start_in_time}
                  onChange={e => setEditingOffice({...editingOffice, start_in_time: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Jam Masuk (Akhir)</label>
                <input 
                  type="time" 
                  value={editingOffice.end_in_time}
                  onChange={e => setEditingOffice({...editingOffice, end_in_time: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Jam Pulang (Mulai)</label>
                <input 
                  type="time" 
                  value={editingOffice.start_out_time}
                  onChange={e => setEditingOffice({...editingOffice, start_out_time: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Jam Pulang (Akhir)</label>
                <input 
                  type="time" 
                  value={editingOffice.end_out_time}
                  onChange={e => setEditingOffice({...editingOffice, end_out_time: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
        {offices.map(office => (
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
                <p className="font-mono text-emerald-900">{office.start_in_time} - {office.end_in_time}</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <p className="text-xs text-orange-600 font-medium mb-1">Jam Pulang</p>
                <p className="font-mono text-orange-900">{office.start_out_time} - {office.end_out_time}</p>
              </div>
            </div>
          </div>
        ))}
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
              <th className="px-6 py-4">Kantor Saat Ini</th>
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
                  {u.office_name ? (
                    <span className="px-2 py-1 bg-slate-100 rounded text-slate-700 text-xs font-medium">
                      {u.office_name}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic text-xs">Belum ditempatkan</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <select 
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                    value={u.office_id || ''}
                    onChange={(e) => handleAssignUser(u.id, parseInt(e.target.value))}
                  >
                    <option value="">Pilih Kantor...</option>
                    {offices.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
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
