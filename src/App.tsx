import React, { useEffect, useState } from 'react';
import { api } from './services/api';
import { User, Office } from './types';
import { MapPin, LogIn, UserPlus } from 'lucide-react';
import Sidebar from './components/Sidebar';
import AttendancePanel from './components/AttendancePanel';
import HistoryPanel from './components/HistoryPanel';
import RecapPanel from './components/RecapPanel';
import SettingsPanel from './components/SettingsPanel';
import DashboardPanel from './components/DashboardPanel';
import CorrectionPanel from './components/CorrectionPanel';
import LeavePanel from './components/LeavePanel';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showRegister, setShowRegister] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [regName, setRegName] = useState('');
  const [regOffice, setRegOffice] = useState<number | null>(null);

  useEffect(() => {
    loadUsers();
    api.getOffices().then(setOffices);
  }, []);

  const loadUsers = async () => {
    const data = await api.getUsers();
    setUsers(data);
  };

  const handleLogin = (u: User) => {
    setUser(u);
    setActiveTab('dashboard');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regOffice) return;
    try {
      const newUser = await api.register({ name: regName, office_id: regOffice });
      setUser(newUser);
      setActiveTab('dashboard');
      setShowRegister(false);
      loadUsers();
    } catch (e) {
      alert('Gagal mendaftar');
    }
  };

  if (!user) {
    if (showRegister) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
                <UserPlus size={32} />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Daftar Pegawai Baru</h1>
              <p className="text-slate-500 mt-2">Silakan lengkapi data diri Anda</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Kantor</label>
                <select 
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={regOffice || ''}
                  onChange={e => setRegOffice(parseInt(e.target.value))}
                >
                  <option value="">-- Pilih Kantor --</option>
                  {offices.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  *Jika Anda pendaftar pertama di kantor ini, Anda akan otomatis menjadi Admin.
                </p>
              </div>
              <button 
                type="submit" 
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
              >
                Daftar Sekarang
              </button>
              <button 
                type="button" 
                onClick={() => setShowRegister(false)}
                className="w-full py-3 text-slate-500 font-medium hover:text-slate-800"
              >
                Kembali ke Login
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <LogIn size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Login Si-Abon</h1>
            <p className="text-slate-500 mt-2">Pilih akun untuk masuk</p>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => handleLogin(u)}
                className="w-full p-4 flex items-center gap-4 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-xl transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shadow-sm group-hover:text-emerald-600 overflow-hidden">
                  {u.photo_url ? (
                    <img src={u.photo_url} alt={u.name} className="w-full h-full object-cover" />
                  ) : (
                    u.name.charAt(0)
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-800 group-hover:text-emerald-800">{u.name}</p>
                  <p className="text-xs text-slate-500 capitalize group-hover:text-emerald-600">
                    {u.role === 'employee' ? 'Pegawai' : u.role === 'headmaster' ? 'Kepala Sekolah' : u.role} • {u.office_name || 'No Office'}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <button 
              onClick={() => setShowRegister(true)}
              className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl font-medium hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              Daftar Pegawai Baru
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar 
        user={user} 
        onLogout={() => setUser(null)} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onUserUpdate={loadUsers}
      />
      
      <main className="flex-1 h-full overflow-hidden relative">
        {activeTab === 'dashboard' && <DashboardPanel user={user} setActiveTab={setActiveTab} />}
        {activeTab === 'attendance' && <AttendancePanel user={user} />}
        {activeTab === 'correction' && <CorrectionPanel user={user} />}
        {activeTab === 'leave' && <LeavePanel user={user} />}
        {activeTab === 'history' && <HistoryPanel user={user} />}
        {activeTab === 'settings' && user.role === 'admin' && <SettingsPanel />}
        {activeTab === 'recap' && ['admin', 'headmaster', 'dinas'].includes(user.role) && <RecapPanel user={user} />}
      </main>
    </div>
  );
}
