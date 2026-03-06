import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, Office, AttendanceLog } from '../types';
import LeafletMap from './Map';
import CameraCapture from './CameraCapture';
import { LogOut, Clock } from 'lucide-react';

export default function AttendancePanel({ user }: { user: User }) {
  const [step, setStep] = useState<'location' | 'photo' | 'success'>('location');
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [office, setOffice] = useState<Office | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [isTugasLuar, setIsTugasLuar] = useState(false);
  const [tugasNotes, setTugasNotes] = useState('');

  useEffect(() => {
    // Fetch user's office details
    api.getOffices().then(offices => {
      const userOffice = offices.find(o => o.id === user.office_id);
      if (userOffice) setOffice(userOffice);
    });

    // Fetch today's logs to prevent duplicates
    const today = new Date().toISOString().split('T')[0];
    api.getAttendance({ user_id: user.id, start_date: today, end_date: today }).then(setTodayLogs);
  }, [user.id, user.office_id]);

  useEffect(() => {
    if (navigator.geolocation && office) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });
          
          // Calculate distance
          const dist = calculateDistance(lat, lng, office.lat, office.lng);
          setDistance(Math.round(dist));
        },
        (error) => console.error(error),
        { enableHighAccuracy: true }
      );
    }
  }, [office]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const handlePhotoCapture = async (imageSrc: string) => {
    if (!location) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.submitAttendance({
        user_id: user.id,
        type,
        lat: location.lat,
        lng: location.lng,
        photo_url: imageSrc,
        notes: isTugasLuar ? `TUGAS LUAR: ${tugasNotes}` : undefined
      });
      setStep('success');
      // Refresh logs
      const today = new Date().toISOString().split('T')[0];
      api.getAttendance({ user_id: user.id, start_date: today, end_date: today }).then(setTodayLogs);
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal mengirim absensi');
      setStep('location'); // Go back to show error
    } finally {
      setLoading(false);
    }
  };

  const isWithinRange = distance !== null && office && distance <= office.radius_meters;
  const canAbsen = isWithinRange || isTugasLuar;

  if (!office) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-slate-500">Anda belum ditempatkan di kantor manapun. Hubungi admin.</p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6">
          <Clock size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Absensi Berhasil!</h2>
        <p className="text-slate-500 mb-8">Terima kasih, data absensi Anda telah tersimpan.</p>
        <button 
          onClick={() => setStep('location')}
          className="px-6 py-2 bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  if (step === 'photo') {
    return (
      <div className="flex flex-col h-full p-6">
        <button onClick={() => setStep('location')} className="self-start text-sm text-slate-500 mb-4 hover:text-slate-800">
          &larr; Kembali
        </button>
        <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
          Ambil Foto Selfie {isTugasLuar && <span className="text-blue-600">(Tugas Luar)</span>}
        </h2>
        
        {isTugasLuar && (
          <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
            <label className="block text-xs font-bold text-blue-600 uppercase mb-2">Keterangan Tugas Luar</label>
            <textarea 
              className="w-full p-3 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Contoh: Rapat Koordinasi di Dinas Pendidikan..."
              value={tugasNotes}
              onChange={e => setTugasNotes(e.target.value)}
              rows={2}
            />
          </div>
        )}

        <div className="flex-1 flex items-center justify-center">
          <CameraCapture onCapture={handlePhotoCapture} />
        </div>
        {loading && <p className="text-center text-slate-500 mt-4">Mengirim data...</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-y-auto">
      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-4">
          {errorMsg}
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Lokasi Anda</h2>
            <p className="text-sm text-slate-500">
              Kantor: <span className="font-medium text-slate-700">{office.name}</span>
            </p>
          </div>
          <button 
            onClick={() => setIsTugasLuar(!isTugasLuar)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isTugasLuar 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isTugasLuar ? '✓ Mode Tugas Luar' : '+ Lokasi Tugas Luar'}
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          {distance !== null 
            ? `Jarak ke kantor: ${distance} meter` 
            : 'Mencari lokasi...'}
        </p>
        
        <div className="h-64 w-full rounded-xl overflow-hidden relative">
          {location ? (
            <LeafletMap 
              center={[location.lat, location.lng]} 
              radius={office.radius_meters}
              markers={[{ lat: location.lat, lng: location.lng }]}
              interactive={false}
            />
          ) : (
            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
              Memuat Peta...
            </div>
          )}
          
          {/* Status Badge */}
          <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium shadow-sm z-[400] ${
            isWithinRange ? 'bg-emerald-100 text-emerald-700' : isTugasLuar ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
          }`}>
            {isWithinRange ? 'Di dalam Area' : isTugasLuar ? 'Mode Tugas Luar' : 'Di luar Area'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {(() => {
          const now = new Date();
          const hours = now.getHours().toString().padStart(2, '0');
          const minutes = now.getMinutes().toString().padStart(2, '0');
          const currentTime = `${hours}:${minutes}`;
          
          const isOutTime = currentTime > '12:00';
          const currentType = isOutTime ? 'OUT' : 'IN';
          
          const hasDoneIn = todayLogs.some(l => l.type === 'IN');
          const hasDoneOut = todayLogs.some(l => l.type === 'OUT');
          const alreadyDone = (currentType === 'IN' && hasDoneIn) || (currentType === 'OUT' && hasDoneOut);

          let statusMessage = null;
          let statusColor = '';

          if (alreadyDone) {
            statusMessage = `Anda sudah melakukan Absen ${currentType === 'IN' ? 'Masuk' : 'Pulang'} hari ini.`;
            statusColor = "text-emerald-600 bg-emerald-50 border-emerald-100";
          } else if (currentType === 'IN') {
            if (currentTime > office.end_in_time) {
              statusMessage = "Anda terlambat! Absensi akan tetap dicatat dengan status TERLAMBAT.";
              statusColor = "text-red-600 bg-red-50 border-red-100";
            }
          } else {
            if (currentTime < office.start_out_time) {
              statusMessage = "Anda absen mendahului waktu! Absensi akan tetap dicatat dengan status MENDAHULUI.";
              statusColor = "text-orange-600 bg-orange-50 border-orange-100";
            }
          }
          
          return (
            <div className="space-y-4">
              {statusMessage && (
                <div className={`p-4 rounded-xl border text-sm font-medium ${alreadyDone ? '' : 'animate-pulse'} ${statusColor}`}>
                  {alreadyDone ? '✓' : '⚠️'} {statusMessage}
                </div>
              )}
              
              {alreadyDone ? (
                <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                    <Clock size={32} />
                  </div>
                  <p className="text-slate-500 font-medium">Sesi Absensi Selesai</p>
                  <p className="text-xs text-slate-400 mt-1">Sampai jumpa di sesi berikutnya!</p>
                </div>
              ) : (
                <button
                  disabled={!canAbsen}
                  onClick={() => { setType(currentType); setStep('photo'); }}
                  className={`w-full flex flex-col items-center justify-center p-8 text-white rounded-3xl shadow-xl transition-all ${
                    isOutTime 
                      ? 'bg-orange-500 shadow-orange-500/30 hover:bg-orange-600' 
                      : 'bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                    {isOutTime ? <LogOut size={40} /> : <Clock size={40} />}
                  </div>
                  <span className="text-2xl font-bold">{isOutTime ? 'Absen Pulang' : 'Absen Masuk'}</span>
                  <span className="text-sm opacity-90 mt-2 font-medium bg-black/10 px-3 py-1 rounded-full">
                    {isOutTime ? `${office.start_out_time} - ${office.end_out_time}` : `${office.start_in_time} - ${office.end_in_time}`}
                  </span>
                </button>
              )}
            </div>
          );
        })()}
      </div>
      
      {!canAbsen && location && (
        <p className="text-center text-xs text-red-500 bg-red-50 p-3 rounded-lg">
          Anda berada di luar jangkauan kantor. Silakan mendekat ke lokasi kantor atau gunakan mode <b>Tugas Luar</b> jika sedang bertugas di lapangan.
        </p>
      )}
    </div>
  );
}
