interface PannellumViewerConfig {
    type?: 'equirectangular' | 'cubemap' | 'multires';
    panorama?: string;
    autoLoad?: boolean;
    autoRotate?: number;
    showControls?: boolean;
    showFullscreenCtrl?: boolean;
    showZoomCtrl?: boolean;
    mouseZoom?: boolean;
    hfov?: number;
    minHfov?: number;
    maxHfov?: number;
    pitch?: number;
    yaw?: number;
    compass?: boolean;
    preview?: string;
    strings?: {
        loadButtonLabel?: string;
        loadingLabel?: string;
    };
}

interface PannellumViewer {
    destroy(): void;
    getYaw(): number;
    getPitch(): number;
    getHfov(): number;
    setYaw(yaw: number, animated?: number): this;
    setPitch(pitch: number, animated?: number): this;
    setHfov(hfov: number, animated?: number): this;
    toggleFullscreen(): void;
    isLoaded(): boolean;
    on(event: string, callback: (...args: unknown[]) => void): this;
    off(event: string, callback?: (...args: unknown[]) => void): this;
    resize(): void;
}

interface Pannellum {
    viewer(container: string | HTMLElement, config: PannellumViewerConfig): PannellumViewer;
}

interface Window {
    pannellum: Pannellum;
}
