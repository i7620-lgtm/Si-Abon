import React, { useEffect, useState } from 'react';
import { api } from './services/api';
import { User, Office } from './types';
import { MapPin, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import Sidebar from './components/Sidebar';
import AttendancePanel from './components/AttendancePanel';
import HistoryPanel from './components/HistoryPanel';
import RecapPanel from './components/RecapPanel';
import SettingsPanel from './components/SettingsPanel';
import DashboardPanel from './components/DashboardPanel';
import CorrectionPanel from './components/CorrectionPanel';
import LeavePanel from './components/LeavePanel';
import { supabase } from './lib/supabase';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showRegister, setShowRegister] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  
  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regOffice, setRegOffice] = useState<number | null>(null);
  const [isNewOffice, setIsNewOffice] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        syncUser(session.user.email);
      }
    });

    loadUsers();
    api.getOffices().then(setOffices);
  }, []);

  const loadUsers = async () => {
    const data = await api.getUsers();
    setUsers(data);
    if (user) {
      const updatedUser = data.find(u => u.id === user.id);
      if (updatedUser) setUser(updatedUser);
    }
  };

  const syncUser = async (email: string) => {
    try {
      const userData = await api.loginSync(email);
      setUser(userData);
      setActiveTab('dashboard');
    } catch (e) {
      console.error('User sync failed', e);
      // If sync fails but auth is valid, maybe prompt to complete profile?
      // For now, just logout
      await supabase.auth.signOut();
      setUser(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;
      if (data.user?.email) {
        await syncUser(data.user.email);
      }
    } catch (e: any) {
      alert('Login gagal: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://ewvokiymjxwrjxcmtskz.supabase.co/auth/v1/callback'
        }
      });
      if (error) throw error;
    } catch (e: any) {
      alert('Google Login gagal: ' + e.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      alert('Password tidak cocok');
      return;
    }
    
    setLoading(true);
    try {
      // 1. Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
      });

      if (error) throw error;
      if (!data.user) throw new Error('No user data returned');

      // 2. Register in local DB
      const newUser = await api.register({
        name: regName,
        email: regEmail,
        supabase_id: data.user.id,
        office_id: isNewOffice ? undefined : (regOffice || undefined),
        new_office_name: isNewOffice ? newOfficeName : undefined
      });

      setUser(newUser);
      setActiveTab('dashboard');
      setShowRegister(false);
      loadUsers();
    } catch (e: any) {
      alert('Gagal mendaftar: ' + e.message);
    } finally {
      setLoading(false);
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input 
                  type="email" 
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="email@contoh.com"
                />
              </div>
              
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none pr-10"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="******"
                />
                <button 
                  type="button"
                  className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password</label>
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none pr-10"
                  value={regConfirmPassword}
                  onChange={e => setRegConfirmPassword(e.target.value)}
                  placeholder="******"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kantor</label>
                <div className="flex items-center gap-2 mb-2">
                  <input 
                    type="checkbox" 
                    id="newOffice" 
                    checked={isNewOffice} 
                    onChange={e => setIsNewOffice(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="newOffice" className="text-sm text-slate-600">Buat Kantor Baru</label>
                </div>

                {isNewOffice ? (
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newOfficeName}
                    onChange={e => setNewOfficeName(e.target.value)}
                    placeholder="Nama Kantor Baru"
                  />
                ) : (
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
                )}
                <p className="text-xs text-slate-400 mt-1">
                  {isNewOffice 
                    ? "*Anda akan otomatis menjadi Admin kantor baru ini."
                    : "*Jika Anda pendaftar pertama di kantor ini, Anda akan otomatis menjadi Admin."}
                </p>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {loading ? 'Memproses...' : 'Daftar Sekarang'}
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
            <p className="text-slate-500 mt-2">Masuk untuk melanjutkan</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input 
                type="email" 
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="email@contoh.com"
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type={showPassword ? "text" : "password"}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none pr-10"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="******"
              />
              <button 
                type="button"
                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">Atau masuk dengan</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full py-3 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          
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
        onLogout={async () => {
          await supabase.auth.signOut();
          setUser(null);
        }} 
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
        {activeTab === 'settings' && (user.role === 'admin' || user.role === 'super_admin') && <SettingsPanel onUserUpdate={loadUsers} />}
        {activeTab === 'recap' && ['admin', 'headmaster', 'dinas', 'super_admin'].includes(user.role) && <RecapPanel user={user} />}
      </main>
    </div>
  );
}
