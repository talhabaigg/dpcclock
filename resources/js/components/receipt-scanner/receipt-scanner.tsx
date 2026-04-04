import { Button } from '@/components/ui/button';
import { Camera, FlashlightOff, Flashlight, RotateCcw, Check, X, ImageOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type ScannerState = 'scanning' | 'reviewing';

interface ReceiptScannerProps {
    open: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
}

export default function ReceiptScanner({ open, onClose, onCapture }: ReceiptScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [state, setState] = useState<ScannerState>('scanning');
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
    const capturedCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Start camera
    useEffect(() => {
        if (!open) return;

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: false,
                });

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                }

                // Check torch support
                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities?.() as any;
                if (capabilities?.torch) {
                    setTorchSupported(true);
                }
            } catch (err: any) {
                if (err.name === 'NotAllowedError') {
                    setCameraError('Camera access denied. Please allow camera access in your browser settings.');
                } else if (err.name === 'NotFoundError') {
                    setCameraError('No camera found on this device.');
                } else {
                    setCameraError('Could not access camera. Please try again.');
                }
            }
        };

        startCamera();

        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        };
    }, [open]);

    // Toggle torch
    const toggleTorch = useCallback(async () => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track) return;
        const newTorch = !torchOn;
        try {
            await track.applyConstraints({ advanced: [{ torch: newTorch } as any] });
            setTorchOn(newTorch);
        } catch {
            // Torch toggle failed silently
        }
    }, [torchOn]);

    // Capture
    const handleCapture = useCallback(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);

        capturedCanvasRef.current = canvas;
        setCapturedPreviewUrl(canvas.toDataURL('image/jpeg', 0.92));
        setState('reviewing');
    }, []);

    // Submit captured image
    const handleUsePhoto = useCallback(() => {
        const canvas = capturedCanvasRef.current;
        if (!canvas) return;

        canvas.toBlob(
            (blob) => {
                if (!blob) return;
                const file = new File([blob], `receipt-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
                onCapture(file);
            },
            'image/jpeg',
            0.92,
        );
    }, [onCapture]);

    // Retake
    const handleRetake = useCallback(() => {
        capturedCanvasRef.current = null;
        if (capturedPreviewUrl) {
            URL.revokeObjectURL(capturedPreviewUrl);
            setCapturedPreviewUrl(null);
        }
        setState('scanning');
    }, [capturedPreviewUrl]);

    // Handle close
    const handleClose = useCallback(() => {
        if (capturedPreviewUrl) {
            URL.revokeObjectURL(capturedPreviewUrl);
        }
        onClose();
    }, [capturedPreviewUrl, onClose]);

    if (!open) return null;

    // Camera error fallback
    if (cameraError) {
        return (
            <div className="fixed inset-0 z-[10002] flex flex-col items-center justify-center bg-black/95 p-6">
                <ImageOff className="mb-4 h-16 w-16 text-gray-400" />
                <p className="mb-6 max-w-sm text-center text-white">{cameraError}</p>
                <Button variant="secondary" onClick={handleClose}>
                    Close
                </Button>
            </div>
        );
    }

    // Review state
    if (state === 'reviewing' && capturedPreviewUrl) {
        return (
            <div className="fixed inset-0 z-[10002] flex flex-col bg-black">
                <div className="flex items-center justify-between p-4">
                    <span className="text-sm font-medium text-white">Review Scan</span>
                    <Button variant="ghost" size="icon" onClick={handleClose} className="text-white hover:bg-white/10">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
                    <img
                        src={capturedPreviewUrl}
                        alt="Scanned receipt"
                        className="max-h-full max-w-full rounded-lg object-contain"
                    />
                </div>

                <div className="flex items-center justify-center gap-4 p-6 pb-safe">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={handleRetake}
                        className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                    >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Retake
                    </Button>
                    <Button size="lg" onClick={handleUsePhoto} className="bg-green-600 hover:bg-green-700">
                        <Check className="mr-2 h-4 w-4" />
                        Use Photo
                    </Button>
                </div>
            </div>
        );
    }

    // Scanning state
    return (
        <div className="fixed inset-0 z-[10002] flex flex-col bg-black">
            {/* Top bar */}
            <div className="relative z-10 flex items-center justify-between p-4">
                <Button variant="ghost" size="icon" onClick={handleClose} className="text-white hover:bg-white/10">
                    <X className="h-5 w-5" />
                </Button>
                <span className="text-sm text-white/80">Align receipt and tap to capture</span>
                <div className="w-10" />
            </div>

            {/* Camera view */}
            <div className="relative flex-1 overflow-hidden">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                />
            </div>

            {/* Bottom controls */}
            <div className="relative z-10 flex items-center justify-center gap-8 p-6 pb-safe">
                {/* Torch toggle */}
                <div className="w-12">
                    {torchSupported && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleTorch}
                            className="text-white hover:bg-white/10"
                        >
                            {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
                        </Button>
                    )}
                </div>

                {/* Capture button */}
                <button
                    onClick={handleCapture}
                    className="group relative flex h-[72px] w-[72px] items-center justify-center rounded-full"
                    aria-label="Capture receipt"
                >
                    <span className="absolute inset-0 rounded-full border-4 border-white/60" />
                    <span className="h-[58px] w-[58px] rounded-full bg-white transition-transform group-active:scale-90">
                        <Camera className="m-auto mt-[17px] h-6 w-6 text-gray-700" />
                    </span>
                </button>

                {/* Spacer for symmetry */}
                <div className="w-12" />
            </div>
        </div>
    );
}
