import { Button } from '@/components/ui/button';
import { Camera, FlashlightOff, Flashlight, Loader2, RotateCcw, Check, X, ImageOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Point } from './perspective-transform';
import { perspectiveTransform } from './perspective-transform';
import { useDocumentDetection } from './use-document-detection';
import { useOpenCv } from './use-opencv';

type ScannerState = 'scanning' | 'reviewing';

interface ReceiptScannerProps {
    open: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
}

export default function ReceiptScanner({ open, onClose, onCapture }: ReceiptScannerProps) {
    const { cv, loading: cvLoading, error: cvError } = useOpenCv();
    const videoRef = useRef<HTMLVideoElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [state, setState] = useState<ScannerState>('scanning');
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [capturedCanvas, setCapturedCanvas] = useState<HTMLCanvasElement | null>(null);
    const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

    const { corners, confidence } = useDocumentDetection(videoRef, cv, open && state === 'scanning');

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

    // Track video dimensions
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleResize = () => {
            if (video.videoWidth && video.videoHeight) {
                setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
            }
        };

        video.addEventListener('loadedmetadata', handleResize);
        video.addEventListener('resize', handleResize);
        return () => {
            video.removeEventListener('loadedmetadata', handleResize);
            video.removeEventListener('resize', handleResize);
        };
    }, []);

    // Draw overlay
    useEffect(() => {
        if (state !== 'scanning') return;

        const canvas = overlayCanvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        let animFrame: number;
        const draw = () => {
            // Match canvas to video element's display size
            const rect = video.getBoundingClientRect();
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }

            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (corners && videoDimensions.width > 0) {
                // Scale corners from video coordinates to display coordinates
                const scaleX = rect.width / videoDimensions.width;
                const scaleY = rect.height / videoDimensions.height;

                const scaledCorners = corners.map((p) => ({
                    x: p.x * scaleX,
                    y: p.y * scaleY,
                }));

                ctx.beginPath();
                ctx.moveTo(scaledCorners[0].x, scaledCorners[0].y);
                for (let i = 1; i < scaledCorners.length; i++) {
                    ctx.lineTo(scaledCorners[i].x, scaledCorners[i].y);
                }
                ctx.closePath();

                // Fill with semi-transparent overlay outside the document
                ctx.fillStyle = confidence === 'high'
                    ? 'rgba(34, 197, 94, 0.08)'
                    : 'rgba(250, 204, 21, 0.08)';
                ctx.fill();

                ctx.strokeStyle = confidence === 'high' ? '#22c55e' : '#facc15';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Draw corner dots
                for (const point of scaledCorners) {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
                    ctx.fillStyle = confidence === 'high' ? '#22c55e' : '#facc15';
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            animFrame = requestAnimationFrame(draw);
        };

        animFrame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animFrame);
    }, [state, corners, confidence, videoDimensions]);

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

        // Draw raw frame to a canvas
        const rawCanvas = document.createElement('canvas');
        rawCanvas.width = video.videoWidth;
        rawCanvas.height = video.videoHeight;
        const ctx = rawCanvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);

        let resultCanvas: HTMLCanvasElement;

        if (corners && cv) {
            // Apply perspective transform
            resultCanvas = perspectiveTransform(cv, rawCanvas, corners);
        } else {
            // No detection — use raw frame
            resultCanvas = rawCanvas;
        }

        setCapturedCanvas(resultCanvas);
        setCapturedPreviewUrl(resultCanvas.toDataURL('image/jpeg', 0.92));
        setState('reviewing');
    }, [corners, cv]);

    // Submit captured image
    const handleUsePhoto = useCallback(() => {
        if (!capturedCanvas) return;

        capturedCanvas.toBlob(
            (blob) => {
                if (!blob) return;
                const file = new File([blob], `receipt-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
                onCapture(file);
            },
            'image/jpeg',
            0.92,
        );
    }, [capturedCanvas, onCapture]);

    // Retake
    const handleRetake = useCallback(() => {
        setCapturedCanvas(null);
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
                <span className="text-sm text-white/80">
                    {cvLoading
                        ? 'Loading scanner...'
                        : cvError
                          ? 'Scanner ready (no border detection)'
                          : confidence === 'high'
                            ? 'Receipt detected — tap to capture'
                            : 'Align receipt within frame'}
                </span>
                <div className="w-10" /> {/* Spacer for centering */}
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
                <canvas
                    ref={overlayCanvasRef}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                />

                {/* OpenCV loading spinner overlay */}
                {cvLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Preparing border detection...
                        </div>
                    </div>
                )}
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
                    {/* Outer ring */}
                    <span
                        className={`absolute inset-0 rounded-full border-4 transition-colors ${
                            confidence === 'high' ? 'border-green-500' : 'border-white/60'
                        }`}
                    />
                    {/* Inner button */}
                    <span
                        className={`h-[58px] w-[58px] rounded-full transition-colors group-active:scale-90 ${
                            confidence === 'high' ? 'bg-green-500' : 'bg-white'
                        }`}
                    >
                        <Camera className={`m-auto mt-[17px] h-6 w-6 ${
                            confidence === 'high' ? 'text-white' : 'text-gray-700'
                        }`} />
                    </span>
                </button>

                {/* Spacer for symmetry */}
                <div className="w-12" />
            </div>
        </div>
    );
}
