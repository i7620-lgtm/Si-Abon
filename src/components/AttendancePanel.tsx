import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User, Office } from '../types';
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

  useEffect(() => {
    // Fetch user's office details
    api.getOffices().then(offices => {
      const userOffice = offices.find(o => o.id === user.office_id);
      if (userOffice) setOffice(userOffice);
    });
  }, [user.office_id]);

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
        photo_url: imageSrc
      });
      setStep('success');
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal mengirim absensi');
      setStep('location'); // Go back to show error
    } finally {
      setLoading(false);
    }
  };

  const isWithinRange = distance !== null && office && distance <= office.radius_meters;

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
        <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Ambil Foto Selfie</h2>
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
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Lokasi Anda</h2>
        <p className="text-sm text-slate-500 mb-4">
          Kantor: <span className="font-medium text-slate-700">{office.name}</span>
          <br />
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
            isWithinRange ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            {isWithinRange ? 'Di dalam Area' : 'Di luar Area'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {(() => {
          const now = new Date();
          const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
          const isOutTime = currentTime >= office.start_out_time;
          
          return (
            <button
              disabled={!isWithinRange}
              onClick={() => { setType(isOutTime ? 'OUT' : 'IN'); setStep('photo'); }}
              className={`flex flex-col items-center justify-center p-8 text-white rounded-3xl shadow-xl transition-all ${
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
          );
        })()}
      </div>
      
      {!isWithinRange && location && (
        <p className="text-center text-xs text-red-500 bg-red-50 p-3 rounded-lg">
          Anda berada di luar jangkauan kantor. Silakan mendekat ke lokasi kantor untuk melakukan absensi.
        </p>
      )}
    </div>
  );
}
