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
  const [locationError, setLocationError] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [tugasNotes, setTugasNotes] = useState('');

  useEffect(() => {
    // Fetch all offices and filter for user
    api.getOffices().then(allOffices => {
      const mainOffice = allOffices.find(o => o.id === user.office_id);
      const assignedTugas = allOffices.filter(o => user.assigned_offices?.includes(o.id));
      
      const userOffices = [];
      if (mainOffice) userOffices.push(mainOffice);
      userOffices.push(...assignedTugas);
      
      setOffices(userOffices);
      if (userOffices.length > 0) setSelectedOffice(userOffices[0]);
    });

    // Fetch today's logs to prevent duplicates
    const today = new Date().toISOString().split('T')[0];
    api.getAttendance({ user_id: user.id, start_date: today, end_date: today }).then(setTodayLogs);
  }, [user.id, user.office_id, user.assigned_offices]);

  useEffect(() => {
    if (navigator.geolocation && selectedOffice) {
      setLocationError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });
          
          // Calculate distance to selected office
          const dist = calculateDistance(lat, lng, selectedOffice.lat, selectedOffice.lng);
          setDistance(Math.round(dist));
        },
        (error) => {
          console.error(error);
          if (error.code === error.PERMISSION_DENIED) {
            setLocationError("Akses lokasi ditolak. Silakan izinkan akses lokasi di pengaturan browser/perangkat Anda.");
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            setLocationError("Informasi lokasi tidak tersedia. Pastikan GPS perangkat Anda aktif.");
          } else if (error.code === error.TIMEOUT) {
            setLocationError("Waktu permintaan lokasi habis. Silakan coba lagi.");
          } else {
            setLocationError("Terjadi kesalahan saat mengambil lokasi.");
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else if (!navigator.geolocation) {
      setLocationError("Browser atau perangkat Anda tidak mendukung fitur lokasi (GPS).");
    }
  }, [selectedOffice]);

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
        notes: selectedOffice?.is_tugas_luar ? `TUGAS LUAR: ${selectedOffice.name}${tugasNotes ? ` - ${tugasNotes}` : ''}` : undefined
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

  const isWithinRange = distance !== null && selectedOffice && distance <= selectedOffice.radius_meters;
  const canAbsen = isWithinRange;

  if (offices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-slate-500">Anda belum ditempatkan di lokasi manapun. Hubungi admin.</p>
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
          Ambil Foto Selfie {selectedOffice?.is_tugas_luar && <span className="text-blue-600">(Tugas Luar)</span>}
        </h2>
        
        {selectedOffice?.is_tugas_luar && (
          <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
            <label className="block text-xs font-bold text-blue-600 uppercase mb-2">Keterangan Tugas Luar ({selectedOffice.name})</label>
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

      {locationError && (
        <div className="bg-orange-50 text-orange-700 p-4 rounded-xl text-sm mb-4 border border-orange-200">
          <p className="font-bold mb-1">⚠️ Masalah Lokasi</p>
          {locationError}
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Lokasi Absensi</h2>
          <div className="flex flex-wrap gap-2 mt-3">
            {offices.map(o => (
              <button
                key={o.id}
                onClick={() => setSelectedOffice(o)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  selectedOffice?.id === o.id 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {o.is_tugas_luar ? '📍 ' : '🏢 '}
                {o.name}
                {o.is_tugas_luar && <span className="ml-1 opacity-70">(Tugas Luar)</span>}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          {locationError ? (
            <span className="text-orange-500">Gagal mendapatkan lokasi</span>
          ) : distance !== null && selectedOffice ? (
            `Jarak ke ${selectedOffice.name}: ${distance} meter` 
          ) : (
            'Mencari lokasi...'
          )}
        </p>
        
        <div className="h-64 w-full rounded-xl overflow-hidden relative">
          {location && selectedOffice ? (
            <LeafletMap 
              center={[location.lat, location.lng]} 
              radius={selectedOffice.radius_meters}
              markers={[{ lat: location.lat, lng: location.lng }]}
              interactive={false}
            />
          ) : (
            <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
              {locationError ? (
                <>
                  <MapPin size={32} className="text-orange-300 mb-2" />
                  <span className="text-sm text-orange-500">Peta tidak dapat ditampilkan tanpa lokasi</span>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 border-4 border-slate-300 border-t-emerald-500 rounded-full animate-spin mb-2"></div>
                  <span>Memuat Peta...</span>
                </>
              )}
            </div>
          )}
          
          {/* Status Badge */}
          <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium shadow-sm z-[400] ${
            isWithinRange ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            {isWithinRange ? 'Di dalam Area' : 'Di luar Area'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {(() => {
          const now = new Date();
          const dayOfWeek = now.getDay();
          const hours = now.getHours().toString().padStart(2, '0');
          const minutes = now.getMinutes().toString().padStart(2, '0');
          const currentTime = `${hours}:${minutes}`;
          
          let currentType: 'IN' | 'OUT' = 'IN';

          // Get effective schedule for today
          let startIn = '00:00';
          let endIn = '00:00';
          let startOut = '00:00';
          let endOut = '00:00';
          let isOff = false;

          if (selectedOffice) {
             startIn = selectedOffice.start_in_time;
             endIn = selectedOffice.end_in_time;
             startOut = selectedOffice.start_out_time;
             endOut = selectedOffice.end_out_time;

             if (selectedOffice.schedule && selectedOffice.schedule[dayOfWeek]) {
                const daySchedule = selectedOffice.schedule[dayOfWeek];
                isOff = daySchedule.is_off || false;
                if (!isOff) {
                   startIn = daySchedule.start_in || startIn;
                   endIn = daySchedule.end_in || endIn;
                   startOut = daySchedule.start_out || startOut;
                   endOut = daySchedule.end_out || endOut;
                }
             }

             const endInParts = endIn.split(':').map(Number);
             const startOutParts = startOut.split(':').map(Number);
             
             const endInMinutes = endInParts[0] * 60 + endInParts[1];
             const startOutMinutes = startOutParts[0] * 60 + startOutParts[1];
             const currentMinutes = parseInt(hours) * 60 + parseInt(minutes);
             
             // Calculate midpoint: end_in + (start_out - end_in) / 2
             const midPoint = endInMinutes + ((startOutMinutes - endInMinutes) / 2);
             
             if (currentMinutes >= midPoint) {
                currentType = 'OUT';
             } else {
                currentType = 'IN';
             }
          } else {
             // Fallback if no office selected
             currentType = currentTime > '12:00' ? 'OUT' : 'IN';
          }

          const hasDoneIn = todayLogs.some(l => l.type === 'IN');
          const hasDoneOut = todayLogs.some(l => l.type === 'OUT');
          const alreadyDone = (currentType === 'IN' && hasDoneIn) || (currentType === 'OUT' && hasDoneOut);

          let statusMessage = null;
          let statusColor = '';

          if (isOff) {
            statusMessage = "Hari ini diatur sebagai hari libur untuk kantor ini. Anda tidak perlu melakukan absensi.";
            statusColor = "text-blue-600 bg-blue-50 border-blue-100";
          } else if (alreadyDone) {
            statusMessage = `Anda sudah melakukan Absen ${currentType === 'IN' ? 'Masuk' : 'Pulang'} hari ini.`;
            statusColor = "text-emerald-600 bg-emerald-50 border-emerald-100";
          } else if (currentType === 'IN' && selectedOffice) {
            if (currentTime > endIn) {
              statusMessage = "Anda terlambat! Absensi akan tetap dicatat dengan status TERLAMBAT.";
              statusColor = "text-red-600 bg-red-50 border-red-100";
            }
          } else if (currentType === 'OUT' && selectedOffice) {
             if (currentTime < startOut) {
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
              
              {isOff || alreadyDone ? (
                <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                    <Clock size={32} />
                  </div>
                  <p className="text-slate-500 font-medium">{isOff ? 'Hari Libur' : 'Sesi Absensi Selesai'}</p>
                  <p className="text-xs text-slate-400 mt-1">{isOff ? 'Selamat beristirahat!' : 'Sampai jumpa di sesi berikutnya!'}</p>
                </div>
              ) : (
                <button
                  disabled={!canAbsen || !selectedOffice}
                  onClick={() => { setType(currentType); setStep('photo'); }}
                  className={`w-full flex flex-col items-center justify-center p-8 text-white rounded-3xl shadow-xl transition-all ${
                    currentType === 'OUT' 
                      ? 'bg-orange-500 shadow-orange-500/30 hover:bg-orange-600' 
                      : 'bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                    {currentType === 'OUT' ? <LogOut size={40} /> : <Clock size={40} />}
                  </div>
                  <span className="text-2xl font-bold">{currentType === 'OUT' ? 'Absen Pulang' : 'Absen Masuk'}</span>
                  {selectedOffice && (
                    <span className="text-sm opacity-90 mt-2 font-medium bg-black/10 px-3 py-1 rounded-full">
                      {currentType === 'OUT' ? `${startOut} - ${endOut}` : `${startIn} - ${endIn}`}
                    </span>
                  )}
                </button>
              )}
            </div>
          );
        })()}
      </div>
      
      {!canAbsen && location && (
        <p className="text-center text-xs text-red-500 bg-red-50 p-3 rounded-lg">
          Anda berada di luar jangkauan {selectedOffice?.name || 'kantor'}. Silakan mendekat ke lokasi yang dipilih atau hubungi admin jika Anda sedang bertugas di lokasi lain.
        </p>
      )}
    </div>
  );
}
