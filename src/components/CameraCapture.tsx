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

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative w-full max-w-sm aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-lg">
        {imgSrc ? (
          <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
        ) : (
          <WebcamAny
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/webp"
            videoConstraints={{ facingMode: 'user' }}
            className="w-full h-full object-cover"
            mirrored={true}
            screenshotQuality={0.6}
            disablePictureInPicture={false}
          />
        )}
      </div>
      
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
    </div>
  );
}
