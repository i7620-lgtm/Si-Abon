import React, { useState, useEffect } from 'react';
import { LogOut, MapPin, Clock, History, Settings as SettingsIcon, FileText, User as UserIcon, X, Camera, LayoutDashboard, CalendarDays, ClipboardPen, FileSpreadsheet } from 'lucide-react';
import { User, Office } from '../types';
import { api } from '../services/api';
import CameraCapture from './CameraCapture';

interface SidebarProps {
  user: User;
  offices: Office[];
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onUserUpdate: () => void;
}

export default function Sidebar({ user, offices, onLogout, activeTab, setActiveTab, onUserUpdate }: SidebarProps) {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editNip, setEditNip] = useState(user.nip || '');
  const [editPhoto, setEditPhoto] = useState(user.photo_url || '');
  const [showCamera, setShowCamera] = useState(false);
  const [attendanceIcon, setAttendanceIcon] = useState<'IN' | 'OUT'>('IN');

  useEffect(() => {
    const calculateIcon = () => {
      const mainOffice = offices.find(o => o.id === user.office_id);
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      
      if (mainOffice) {
         const endInParts = mainOffice.end_in_time.split(':').map(Number);
         const startOutParts = mainOffice.start_out_time.split(':').map(Number);
         
         const endInMinutes = endInParts[0] * 60 + endInParts[1];
         const startOutMinutes = startOutParts[0] * 60 + startOutParts[1];
         const currentMinutes = now.getHours() * 60 + now.getMinutes();
         
         // Calculate midpoint: end_in + (start_out - end_in) / 2
         const midPoint = endInMinutes + ((startOutMinutes - endInMinutes) / 2);
         
         if (currentMinutes >= midPoint) {
            setAttendanceIcon('OUT');
         } else {
            setAttendanceIcon('IN');
         }
      } else {
         setAttendanceIcon(currentTime > '12:00' ? 'OUT' : 'IN');
      }
    };

    calculateIcon();
    const interval = setInterval(calculateIcon, 60000);
    return () => clearInterval(interval);
  }, [user.office_id, offices]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['employee', 'admin', 'headmaster', 'dinas'] },
    { id: 'attendance', label: attendanceIcon === 'OUT' ? 'Absen Pulang' : 'Absen Masuk', icon: attendanceIcon === 'OUT' ? LogOut : Clock, roles: ['employee', 'admin', 'headmaster', 'dinas'] },
    { id: 'correction', label: 'Lupa Absen', icon: ClipboardPen, roles: ['employee', 'admin', 'headmaster', 'dinas'] },
    { id: 'leave', label: 'Cuti', icon: CalendarDays, roles: ['employee', 'admin', 'headmaster', 'dinas'] },
    { id: 'history', label: 'Riwayat', icon: History, roles: ['employee'] },
    { id: 'recap', label: 'Rekap Laporan', icon: FileSpreadsheet, roles: ['admin', 'headmaster', 'dinas'] },
    { id: 'settings', label: 'Pengaturan Kantor', icon: SettingsIcon, roles: ['admin'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));

  const handleSaveProfile = async () => {
    try {
      await api.updateUser(user.id, {
        name: editName,
        nip: editNip,
        photo_url: editPhoto
      });
      onUserUpdate();
      setShowProfileModal(false);
    } catch (e) {
      alert('Gagal menyimpan profil');
    }
  };

  const handleCapture = (imageSrc: string) => {
    setEditPhoto(imageSrc);
    setShowCamera(false);
  };

  return (
    <>
      <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-100 flex flex-col h-auto md:h-full flex-shrink-0 print:hidden">
        <div className="p-4 md:p-6 border-b border-slate-50 flex justify-between items-center md:block">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                <MapPin size={18} />
              </div>
              <span className="hidden sm:inline">Si-Abon</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:hidden">
             <div className="flex flex-col items-end mr-2">
                <span className="text-xs font-bold text-slate-800">{user.name}</span>
                <span className="text-[10px] text-slate-500 capitalize">
                  {user.role === 'employee' ? 'Pegawai' : user.role === 'headmaster' ? 'Kepala Sekolah' : user.role}
                </span>
             </div>
             <button 
              onClick={() => setShowProfileModal(true)}
              className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg"
            >
              <UserIcon size={20} />
            </button>
            <button 
              onClick={onLogout}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
            >
              <LogOut size={20} />
            </button>
          </div>
          
          <p className="text-xs text-slate-400 mt-1 ml-10 hidden md:block">Sistem Absensi Online</p>
        </div>
        
        <nav className="flex-1 p-2 md:p-4 flex md:flex-col overflow-x-auto md:overflow-visible gap-2 md:gap-0 scrollbar-hide">
          {filteredItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === item.id 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <item.icon size={18} />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="hidden md:block p-4 border-t border-slate-50">
          <div className="flex items-center gap-3 px-4 py-3 mb-2 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors" onClick={() => setShowProfileModal(true)}>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs overflow-hidden">
              {user.photo_url ? (
                <img src={user.photo_url} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate capitalize">
                {user.role === 'employee' ? 'Pegawai' : user.role === 'headmaster' ? 'Kepala Sekolah' : user.role}
              </p>
              {user.office_name && (
                <p className="text-[10px] text-emerald-600 truncate">{user.office_name}</p>
              )}
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Keluar
          </button>
        </div>
      </div>

      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Edit Profil</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-center mb-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-slate-100 overflow-hidden border-2 border-slate-200">
                    {editPhoto ? (
                      <img src={editPhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <UserIcon size={40} />
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setShowCamera(true)}
                    className="absolute bottom-0 right-0 p-2 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-colors"
                  >
                    <Camera size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">NIP / NIPPPK</label>
                <input 
                  type="text" 
                  value={editNip}
                  onChange={e => setEditNip(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Opsional"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveProfile}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col">
          <div className="p-4 flex justify-between items-center text-white">
            <h3 className="font-bold">Ambil Foto Profil</h3>
            <button onClick={() => setShowCamera(false)}>
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center bg-black">
            <CameraCapture onCapture={handleCapture} />
          </div>
        </div>
      )}
    </>
  );
}
