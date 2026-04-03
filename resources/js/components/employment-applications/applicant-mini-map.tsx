import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

interface Props {
    latitude: number;
    longitude: number;
    name: string;
    suburb: string;
}

export default function ApplicantMiniMap({ latitude, longitude, name, suburb }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: [latitude, longitude],
            zoom: 13,
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false,
        });

        L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2', {
            maxZoom: 20,
            subdomains: '0123',
        }).addTo(map);

        const icon = L.divIcon({
            className: '',
            iconAnchor: [18, 50],
            html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                <svg width="36" height="50" viewBox="0 0 27 43" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.5 0C6.04 0 0 6.04 0 13.5 0 23.63 13.5 43 13.5 43S27 23.63 27 13.5C27 6.04 20.96 0 13.5 0z" fill="#3b82f6"/>
                    <circle cx="13.5" cy="13.5" r="5.5" fill="#1e40af"/>
                </svg>
            </div>`,
        });

        L.marker([latitude, longitude], { icon }).addTo(map)
            .bindPopup(`<div style="font-family:system-ui,sans-serif">
                <b style="font-size:13px">${name.replace(/</g, '&lt;')}</b><br>
                <span style="font-size:11px;color:#888">${suburb.replace(/</g, '&lt;')}</span>
            </div>`);

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
     
    }, []);

    return (
        <div
            ref={containerRef}
            className="h-[180px] w-full overflow-hidden rounded-lg border"
            style={{ cursor: 'default' }}
        />
    );
}
