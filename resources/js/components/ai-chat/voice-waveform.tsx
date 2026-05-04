import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface VoiceWaveformProps {
    stream: MediaStream | null;
    className?: string;
}

export function VoiceWaveform({ stream, className }: VoiceWaveformProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !stream) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);

        const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioCtx();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.85;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const BAR_COUNT = 28;
        const BAR_WIDTH = 2.5;
        const BAR_GAP = 3;
        const MIN_BAR_HEIGHT = 2;

        // Smoothed heights — fast attack, slow decay (the "Apple glide")
        const ATTACK = 0.35;
        const DECAY = 0.08;
        const smoothedHeights = new Float32Array(BAR_COUNT);

        let cachedColor = getComputedStyle(canvas).color;
        let colorTick = 0;

        let rafId = 0;
        const draw = () => {
            rafId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            const cssWidth = canvas.width / dpr;
            const cssHeight = canvas.height / dpr;
            ctx.clearRect(0, 0, cssWidth, cssHeight);

            const totalWidth = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP;
            const startX = (cssWidth - totalWidth) / 2;
            const centerY = cssHeight / 2;

            // Voice energy concentrates in the lower bins
            const usableBins = Math.floor(bufferLength * 0.5);

            // Refresh resolved color occasionally (theme switch, etc.)
            if (colorTick++ % 60 === 0) {
                cachedColor = getComputedStyle(canvas).color;
            }
            ctx.fillStyle = cachedColor;

            for (let i = 0; i < BAR_COUNT; i++) {
                const binIndex = Math.floor((i / BAR_COUNT) * usableBins);
                const target = (dataArray[binIndex] / 255) * cssHeight * 0.95;

                // Lerp toward target — different rate up vs down for inertia
                const current = smoothedHeights[i];
                const factor = target > current ? ATTACK : DECAY;
                smoothedHeights[i] = current + (target - current) * factor;

                const barHeight = Math.max(MIN_BAR_HEIGHT, smoothedHeights[i]);
                const x = startX + i * (BAR_WIDTH + BAR_GAP);
                const y = centerY - barHeight / 2;

                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(x, y, BAR_WIDTH, barHeight, BAR_WIDTH / 2);
                } else {
                    ctx.rect(x, y, BAR_WIDTH, barHeight);
                }
                ctx.fill();
            }
        };
        draw();

        return () => {
            cancelAnimationFrame(rafId);
            observer.disconnect();
            try {
                source.disconnect();
            } catch {
                // ignore
            }
            audioContext.close().catch(() => {});
        };
    }, [stream]);

    return <canvas ref={canvasRef} className={cn('h-6 min-w-0 flex-1', className)} />;
}
