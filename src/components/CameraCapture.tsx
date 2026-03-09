import React, { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw } from 'lucide-react';

// Avoid strict prop type checks
const WebcamAny = Webcam as any;

interface CameraCaptureProps {
  onCapture: (imageSrc: string) => void;
}

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
      onCapture(imageSrc);
    }
  }, [webcamRef, onCapture]);

  const retake = () => {
    setImgSrc(null);
  };

  const handleUserMediaError = useCallback((err: string | DOMException) => {
    console.error('Camera error:', err);
    setError('Kamera tidak dapat diakses. Pastikan Anda telah memberikan izin kamera dan tidak ada aplikasi lain yang sedang menggunakannya.');
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {error ? (
        <div className="w-full max-w-[300px] aspect-[3/4] bg-slate-100 rounded-2xl flex flex-col items-center justify-center p-6 text-center border border-slate-200">
          <Camera size={48} className="text-slate-300 mb-4" />
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium"
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <div className="relative w-full max-w-[300px] aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-lg">
          {imgSrc ? (
            <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
          ) : (
            <WebcamAny
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/webp"
              videoConstraints={{ 
                facingMode: 'user',
                width: { ideal: 720 },
                height: { ideal: 1280 },
                aspectRatio: 0.75
              }}
              onUserMediaError={handleUserMediaError}
              className="w-full h-full object-cover"
              mirrored={true}
              screenshotQuality={0.6}
              disablePictureInPicture={false}
            />
          )}
        </div>
      )}
      
      {!error && (
        <div className="flex gap-4">
        {imgSrc ? (
          <button 
            onClick={retake}
            className="flex items-center gap-2 px-6 py-3 bg-slate-200 text-slate-800 rounded-full font-medium hover:bg-slate-300 transition-colors"
          >
            <RefreshCw size={20} />
            Retake
          </button>
        ) : (
          <button 
            onClick={capture}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full font-medium hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Camera size={20} />
            Capture Photo
          </button>
        )}
        </div>
      )}
    </div>
  );
}
