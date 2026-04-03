import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { MapPin, Navigation, Plane, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from '@inertiajs/react';
import { haversineDistance, formatDistance } from '@/lib/haversine';

// ── Types ──────────────────────────────────────────────────────────────────────

interface EmploymentApplication {
    id: number;
    first_name: string;
    surname: string;
    email: string;
    phone: string;
    occupation: string;
    occupation_other: string | null;
    suburb: string;
    latitude: number | null;
    longitude: number | null;
    status: string;
    created_at: string;
    duplicate_count: number;
}

interface DrivingInfo {
    distance: number;
    duration: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    new: '#94a3b8',
    reviewing: '#a855f7',
    phone_interview: '#3b82f6',
    reference_check: '#f97316',
    face_to_face: '#eab308',
    approved: '#22c55e',
    contract_sent: '#14b8a6',
    contract_signed: '#10b981',
    onboarded: '#16a34a',
    declined: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
    new: 'New',
    reviewing: 'Reviewing',
    phone_interview: 'Phone Interview',
    reference_check: 'Reference Check',
    face_to_face: 'Face to Face',
    approved: 'Approved',
    contract_sent: 'Contract Sent',
    contract_signed: 'Contract Signed',
    onboarded: 'Onboarded',
    declined: 'Declined',
};

// ── Marker icons ───────────────────────────────────────────────────────────────

const iconCache = new Map<string, L.DivIcon>();
function getIcon(status: string, name: string, occupation: string): L.DivIcon {
    const key = `${status}:${name}:${occupation}`;
    if (iconCache.has(key)) return iconCache.get(key)!;
    const dot = STATUS_COLORS[status] ?? '#94a3b8';
    const nameLabel = esc(name.length > 20 ? name.slice(0, 20) + '...' : name);
    const occLabel = esc(occupation === 'other' ? 'Other' : occupation.charAt(0).toUpperCase() + occupation.slice(1));
    const icon = L.divIcon({
        className: '',
        iconAnchor: [0, 52],
        popupAnchor: [0, -56],
        html: `<div style="
            position:absolute;transform:translateX(-50%);white-space:nowrap;
            font-family:system-ui,-apple-system,sans-serif;
            color:#1a1a1a;background:#fff;
            padding:6px 12px 6px 10px;border-radius:10px;
            box-shadow:0 1px 4px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.08);
            border:1.5px solid #e5e5e5;
            cursor:pointer;transition:all 0.15s ease;
            display:flex;align-items:flex-start;gap:7px;
        " onmouseover="
            this.style.background='#1a1a1a';this.style.color='#fff';
            this.style.borderColor='#1a1a1a';this.style.transform='translateX(-50%) scale(1.06)';
            this.style.boxShadow='0 4px 16px rgba(0,0,0,0.2)';this.style.zIndex='9999';
            this.querySelector('.arrow').style.borderTopColor='#1a1a1a';
            this.querySelector('.occ').style.color='#aaa';
        " onmouseout="
            this.style.background='#fff';this.style.color='#1a1a1a';
            this.style.borderColor='#e5e5e5';this.style.transform='translateX(-50%) scale(1)';
            this.style.boxShadow='0 1px 4px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.08)';this.style.zIndex='';
            this.querySelector('.arrow').style.borderTopColor='#fff';
            this.querySelector('.occ').style.color='#888';
        "><span style="
            width:8px;height:8px;border-radius:50%;background:${dot};flex-shrink:0;margin-top:3px;
        "></span><span style="display:flex;flex-direction:column;gap:1px;line-height:1.2;">
            <span style="font-size:12px;font-weight:600;">${nameLabel}</span>
            <span class="occ" style="font-size:10px;font-weight:400;color:#888;transition:color 0.15s;">${occLabel}</span>
        </span><span class="arrow" style="
            position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);
            width:0;height:0;
            border-left:7px solid transparent;border-right:7px solid transparent;
            border-top:7px solid #fff;
            filter:drop-shadow(0 1px 1px rgba(0,0,0,0.08));
        "></span></div>`,
    });
    iconCache.set(key, icon);
    return icon;
}

const targetIcon = L.divIcon({
    className: '',
    iconAnchor: [18, 50],
    popupAnchor: [0, -50],
    html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
        <svg width="36" height="50" viewBox="0 0 27 43" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5 0C6.04 0 0 6.04 0 13.5 0 23.63 13.5 43 13.5 43S27 23.63 27 13.5C27 6.04 20.96 0 13.5 0z" fill="#E94335"/>
            <circle cx="13.5" cy="13.5" r="5.5" fill="#8B1A11"/>
        </svg>
    </div>`,
});

// ── Helpers ─────────────────────────────────────────────────────────────────────

function esc(text: string): string {
    const el = document.createElement('span');
    el.textContent = text;
    return el.innerHTML;
}

function occupationLabel(app: EmploymentApplication) {
    if (app.occupation === 'other' && app.occupation_other) {
        return app.occupation_other.length > 30 ? app.occupation_other.slice(0, 30) + '...' : app.occupation_other;
    }
    return app.occupation.charAt(0).toUpperCase() + app.occupation.slice(1);
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getZone(km: number): { label: string; color: string } {
    if (km <= 50) return { label: 'Zone 1', color: '#22c55e' };
    if (km <= 100) return { label: 'Zone 2', color: '#f59e0b' };
    return { label: 'Zone 3', color: '#ef4444' };
}

function popupHtml(app: EmploymentApplication): string {
    const color = STATUS_COLORS[app.status] ?? '#94a3b8';
    return `<div style="min-width:180px;font-family:system-ui,sans-serif">
        <p style="margin:0 0 2px;font-size:13px;font-weight:600">${esc(app.first_name)} ${esc(app.surname)}</p>
        <p style="margin:0;font-size:11px;color:#888">${esc(occupationLabel(app))}</p>
        <p style="margin:0;font-size:11px;color:#888">${esc(app.suburb)}</p>
        <p style="margin:0;font-size:11px;color:#888">${esc(app.email)}</p>
        <p style="margin:0;font-size:11px;color:#888">${esc(app.phone)}</p>
        <div style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="display:inline-block;border:1px solid ${color};color:${color};border-radius:9999px;padding:1px 8px;font-size:11px;font-weight:500">${STATUS_LABELS[app.status] ?? app.status}</span>
            <button onclick="window.__mapCrowFly&&window.__mapCrowFly(${app.id})" style="
                display:inline-flex;align-items:center;gap:3px;
                border:1px solid #e5e5e5;background:#fff;color:#1a1a1a;
                border-radius:9999px;padding:2px 8px;font-size:11px;font-weight:500;
                cursor:pointer;transition:all 0.15s;
            " onmouseover="this.style.background='#1a1a1a';this.style.color='#fff';this.style.borderColor='#1a1a1a'"
               onmouseout="this.style.background='#fff';this.style.color='#1a1a1a';this.style.borderColor='#e5e5e5'"
            >✈ Crow fly</button>
            <button onclick="window.__mapDriving&&window.__mapDriving(${app.id})" style="
                display:inline-flex;align-items:center;gap:3px;
                border:1px solid #e5e5e5;background:#fff;color:#1a1a1a;
                border-radius:9999px;padding:2px 8px;font-size:11px;font-weight:500;
                cursor:pointer;transition:all 0.15s;
            " onmouseover="this.style.background='#1a1a1a';this.style.color='#fff';this.style.borderColor='#1a1a1a'"
               onmouseout="this.style.background='#fff';this.style.color='#1a1a1a';this.style.borderColor='#e5e5e5'"
            >🚗 Driving</button>
            <a href="/employment-applications/${app.id}" style="font-size:11px;text-decoration:underline;margin-left:auto">View</a>
        </div>
    </div>`;
}

// ── Server-side geocoding & autocomplete ───────────────────────────────────────

interface Prediction {
    place_id: string;
    description: string;
}

const apiHeaders = {
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
};

async function fetchSuggestions(input: string): Promise<Prediction[]> {
    if (input.length < 3) return [];
    try {
        const res = await fetch(`/geocode/suggest?${new URLSearchParams({ input })}`, { headers: apiHeaders });
        if (!res.ok) return [];
        const data = await res.json();
        return data.predictions ?? [];
    } catch {
        return [];
    }
}

async function geocodePlace(placeId: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
    try {
        const res = await fetch(`/geocode?${new URLSearchParams({ place_id: placeId })}`, { headers: apiHeaders });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.latitude || !data.longitude) return null;
        return { lat: data.latitude, lng: data.longitude, formatted: data.formatted_address };
    } catch {
        return null;
    }
}

interface DrivingResult {
    info: DrivingInfo;
    geometry: [number, number][];
}

async function fetchDrivingRoute(
    fromLat: number, fromLng: number,
    toLat: number, toLng: number,
): Promise<DrivingResult | null> {
    try {
        const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`,
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes?.[0]) return null;
        const route = data.routes[0];
        // GeoJSON coordinates are [lng, lat] — flip to [lat, lng] for Leaflet
        const geometry: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]],
        );
        return {
            info: {
                distance: route.distance / 1000,
                duration: route.duration / 60,
            },
            geometry,
        };
    } catch {
        return null;
    }
}

// ── Map sub-components ─────────────────────────────────────────────────────────

function ClusterLayer({
    applications,
    jitteredPositions,
    onMarkerClickRef,
}: {
    applications: EmploymentApplication[];
    jitteredPositions: [number, number][];
    onMarkerClickRef: React.RefObject<(id: number) => void>;
}) {
    const map = useMap();
    const clusterRef = useRef<any>(null);

    // Listen for hide/show events from the line drawing
    useEffect(() => {
        const hide = () => { if (clusterRef.current && map.hasLayer(clusterRef.current)) map.removeLayer(clusterRef.current); };
        const show = () => { if (clusterRef.current && !map.hasLayer(clusterRef.current)) map.addLayer(clusterRef.current); };
        (map as any).on('hideclusters', hide);
        (map as any).on('showclusters', show);
        return () => { (map as any).off('hideclusters', hide); (map as any).off('showclusters', show); };
    }, [map]);

    useEffect(() => {
        if (applications.length === 0) return;

        // Clean up previous cluster if rebuilding
        if (clusterRef.current) {
            map.removeLayer(clusterRef.current);
            clusterRef.current = null;
        }

        // @ts-expect-error leaflet.markercluster adds this to L
        const cluster = L.markerClusterGroup({
            maxClusterRadius: 25,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            disableClusteringAtZoom: 13,
            chunkedLoading: true,
            iconCreateFunction(cl: { getChildCount: () => number }) {
                const count = cl.getChildCount();
                const size = count < 20 ? 38 : count < 50 ? 44 : 50;
                return L.divIcon({
                    html: `<div style="
                        width:${size}px;height:${size}px;
                        display:flex;align-items:center;justify-content:center;
                        background:#fff;color:#1a1a1a;
                        font-weight:700;font-size:${count < 100 ? 13 : 11}px;
                        border-radius:50%;
                        border:2px solid #e5e5e5;
                        box-shadow:0 1px 4px rgba(0,0,0,0.1),0 2px 8px rgba(0,0,0,0.06);
                        font-family:system-ui,-apple-system,sans-serif;
                        cursor:pointer;transition:all 0.15s ease;
                    " onmouseover="this.style.background='#1a1a1a';this.style.color='#fff';this.style.borderColor='#1a1a1a';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.18)'"
                       onmouseout="this.style.background='#fff';this.style.color='#1a1a1a';this.style.borderColor='#e5e5e5';this.style.boxShadow='0 1px 4px rgba(0,0,0,0.1),0 2px 8px rgba(0,0,0,0.06)'"
                    >${count}</div>`,
                    className: '',
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2],
                });
            },
        });

        const markers: L.Marker[] = [];
        applications.forEach((app, idx) => {
            const marker = L.marker(jitteredPositions[idx], { icon: getIcon(app.status, `${app.first_name} ${app.surname}`, app.occupation) });
            marker.bindPopup(popupHtml(app));
            marker.on('click', () => onMarkerClickRef.current(app.id));
            markers.push(marker);
        });

        cluster.addLayers(markers);
        map.addLayer(cluster);
        clusterRef.current = cluster;

        if (jitteredPositions.length > 0) {
            const bounds = L.latLngBounds(jitteredPositions.map(([lat, lng]) => L.latLng(lat, lng)));
            map.fitBounds(bounds, { padding: [40, 40] });
        }

        return () => {
            map.removeLayer(cluster);
            clusterRef.current = null;
        };
    // Rebuild only when the application IDs change (i.e. filters applied, not state changes)
     
    }, [applications.map((a) => a.id).join()]);

    return null;
}

function TargetMarkerLayer({ position, label }: { position: [number, number] | null; label: string }) {
    const map = useMap();
    const layerRef = useRef<L.LayerGroup | null>(null);

    useEffect(() => {
        if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
        }
        if (!position) return;

        const group = L.layerGroup();
        L.marker(position, { icon: targetIcon, zIndexOffset: 10000 }).addTo(group);

        // Address label below the pin — show only street address
        if (label) {
            const street = label.split(',')[0].trim();
            const labelEl = document.createElement('span');
            labelEl.textContent = street;
            labelEl.style.cssText = 'font:600 11px system-ui,sans-serif;visibility:hidden;position:absolute;white-space:nowrap;';
            document.body.appendChild(labelEl);
            const textWidth = Math.ceil(labelEl.offsetWidth) + 28;
            document.body.removeChild(labelEl);

            L.marker(position, {
                icon: L.divIcon({
                    className: '',
                    iconSize: [textWidth, 26],
                    iconAnchor: [textWidth / 2, -8],
                    html: `<div style="
                        display:flex;align-items:center;justify-content:center;
                        width:${textWidth}px;height:26px;
                        background:#1a1a1a;color:#fff;
                        font-family:system-ui,sans-serif;font-size:11px;font-weight:600;
                        padding:0 12px;border-radius:13px;
                        box-shadow:0 2px 8px rgba(0,0,0,0.25);
                        white-space:nowrap;
                    ">${street}</div>`,
                }),
                interactive: false,
                zIndexOffset: 10001,
            }).addTo(group);
        }

        group.addTo(map);
        layerRef.current = group;
        return () => { map.removeLayer(group); };
    }, [position, label, map]);

    return null;
}

function FlyTo({ position }: { position: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (!position) return;
        map.flyTo(position, Math.max(map.getZoom(), 14), { duration: 0.4 });
    }, [position, map]);
    return null;
}

// Draws a single line on the map — crow-fly (dashed) or driving route (solid)
// Hides all other markers when active, shows them when cleared
function MapLineLayer() {
    const map = useMap();
    const layerRef = useRef<L.LayerGroup | null>(null);

    useEffect(() => {
        const clear = () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
            (map as any).fire('showclusters');
        };

        const makeBadge = (text: string, _bg: string, km?: number) => {
            const zone = km != null ? getZone(km) : null;
            const zoneText = zone ? zone.label : '';
            // Measure text width
            const measure = document.createElement('span');
            measure.style.cssText = 'font:700 14px system-ui,sans-serif;visibility:hidden;position:absolute;white-space:nowrap;';
            measure.textContent = text + (zoneText ? '  ' + zoneText : '');
            document.body.appendChild(measure);
            const width = Math.ceil(measure.offsetWidth) + (zone ? 60 : 32);
            document.body.removeChild(measure);

            return L.divIcon({
                className: '',
                iconAnchor: [width / 2, 20],
                iconSize: [width, 40],
                html: `<div style="
                    display:inline-flex;align-items:stretch;
                    height:40px;
                    background:#fff;
                    border-radius:12px;
                    box-shadow:0 2px 12px rgba(0,0,0,0.18);
                    font-family:system-ui,-apple-system,sans-serif;
                    white-space:nowrap;overflow:hidden;
                    border:1.5px solid #e5e5e5;
                "><span style="
                    display:flex;align-items:center;
                    padding:0 14px;
                    color:#1a1a1a;font-size:14px;font-weight:700;
                ">${text}</span>${zone ? `<span style="
                    display:flex;align-items:center;
                    padding:0 12px;
                    background:${zone.color};color:#fff;
                    font-size:12px;font-weight:700;letter-spacing:0.3px;
                ">${zoneText}</span>` : ''}</div>`,
            });
        };

        const drawCrowFly = (e: any) => {
            clear();
            (map as any).fire('hideclusters');
            const { from, to, km, appMarkerHtml } = e as { from: [number, number]; to: [number, number]; km: number; appMarkerHtml: string };
            const group = L.layerGroup();

            L.polyline([from, to], { color: '#3b82f6', weight: 3, opacity: 0.8, dashArray: '10 8' }).addTo(group);
            L.circleMarker(from, { radius: 5, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 1, weight: 0 }).addTo(group);
            L.circleMarker(to, { radius: 5, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 1, weight: 0 }).addTo(group);

            // Show the selected applicant's marker
            if (appMarkerHtml) {
                L.marker(to, {
                    icon: L.divIcon({ className: '', iconAnchor: [0, 52], html: appMarkerHtml }),
                    zIndexOffset: 9000,
                }).addTo(group);
            }

            const midLat = (from[0] + to[0]) / 2;
            const midLng = (from[1] + to[1]) / 2;
            L.marker([midLat, midLng], {
                icon: makeBadge(`✈ ${formatDistance(km)}`, '#3b82f6', km),
                interactive: false,
                zIndexOffset: 10000,
            }).addTo(group);

            group.addTo(map);
            layerRef.current = group;
        };

        const drawRoute = (e: any) => {
            clear();
            (map as any).fire('hideclusters');
            const { geometry, km, duration, to, appMarkerHtml, crowflyKm } = e as {
                geometry: [number, number][]; km: number; duration: number;
                to: [number, number]; appMarkerHtml: string;
                crowflyKm: number;
            };
            const group = L.layerGroup();

            // Route outline + main line
            L.polyline(geometry, { color: '#1e3a5f', weight: 10, opacity: 0.25 }).addTo(group);
            L.polyline(geometry, { color: '#3b82f6', weight: 6, opacity: 0.9 }).addTo(group);

            // Show the selected applicant's marker
            if (appMarkerHtml) {
                L.marker(to, {
                    icon: L.divIcon({ className: '', iconAnchor: [0, 52], html: appMarkerHtml }),
                    zIndexOffset: 9000,
                }).addTo(group);
            }

            const mid = geometry[Math.floor(geometry.length / 2)];
            L.marker(mid, {
                icon: makeBadge(`🚗 ${formatDistance(km)} · ${formatDuration(duration)}`, '#3b82f6', crowflyKm),
                interactive: false,
                zIndexOffset: 10000,
            }).addTo(group);

            group.addTo(map);
            layerRef.current = group;

            const bounds = L.latLngBounds(geometry.map(([lat, lng]) => L.latLng(lat, lng)));
            map.fitBounds(bounds, { padding: [80, 80] });
        };

        (map as any).on('drawcrowfly', drawCrowFly);
        (map as any).on('drawroute', drawRoute);
        (map as any).on('clearline', clear);

        return () => {
            clear();
            (map as any).off('drawcrowfly', drawCrowFly);
            (map as any).off('drawroute', drawRoute);
            (map as any).off('clearline', clear);
        };
    }, [map]);

    return null;
}

function MapRefCapture({ mapRef }: { mapRef: React.RefObject<L.Map | null> }) {
    const map = useMap();
    useEffect(() => { mapRef.current = map; }, [map, mapRef]);
    return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
    applications: EmploymentApplication[];
}

export default function ApplicantMapView({ applications }: Props) {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
    const [targetAddress, setTargetAddress] = useState<string>('');
    const [targetPosition, setTargetPosition] = useState<[number, number] | null>(null);
    const [activeLineId, setActiveLineId] = useState<number | null>(null);
    const [drivingInfo, setDrivingInfo] = useState<{ id: number; info: DrivingInfo } | null>(null);
    const [drivingLoading, setDrivingLoading] = useState<number | null>(null);

    const listRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const addressInputRef = useRef<HTMLInputElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);

    const [geocoding, setGeocoding] = useState(false);
    const [suggestions, setSuggestions] = useState<Prediction[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [addressInput, setAddressInput] = useState('');
    const suggestTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    const handleAddressChange = useCallback((value: string) => {
        setAddressInput(value);
        clearTimeout(suggestTimeout.current);
        if (value.trim().length < 3) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        suggestTimeout.current = setTimeout(async () => {
            const results = await fetchSuggestions(value.trim());
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
        }, 300);
    }, []);

    const handleSelectSuggestion = useCallback(async (prediction: Prediction) => {
        setShowSuggestions(false);
        setSuggestions([]);
        setAddressInput(prediction.description);
        setGeocoding(true);
        const result = await geocodePlace(prediction.place_id);
        setGeocoding(false);
        if (result) {
            setTargetPosition([result.lat, result.lng]);
            setTargetAddress(result.formatted);
            setFlyTarget([result.lat, result.lng]);
            setAddressInput(result.formatted);
            setActiveLineId(null);
            setDrivingInfo(null);
        }
    }, []);

    const mappable = useMemo(
        () => applications.filter((a) => a.latitude != null && a.longitude != null && !isNaN(Number(a.latitude)) && !isNaN(Number(a.longitude))),
        [applications],
    );

    const unmappable = useMemo(
        () => applications.filter((a) => a.latitude == null || a.longitude == null || isNaN(Number(a.latitude)) || isNaN(Number(a.longitude))),
        [applications],
    );

    // Jitter overlapping markers
    const jitteredPositions = useMemo(() => {
        const seen = new Map<string, number>();
        return mappable.map((a) => {
            const lat = Number(a.latitude);
            const lng = Number(a.longitude);
            const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
            const count = seen.get(key) ?? 0;
            seen.set(key, count + 1);
            if (count === 0) return [lat, lng] as [number, number];
            const angle = (count * 137.5 * Math.PI) / 180;
            const radius = 0.0015 * Math.sqrt(count);
            return [lat + radius * Math.cos(angle), lng + radius * Math.sin(angle)] as [number, number];
        });
    }, [mappable]);

    // Crow-fly distances from target
    const distances = useMemo(() => {
        if (!targetPosition) return new Map<number, number>();
        const map = new Map<number, number>();
        mappable.forEach((app) => {
            const d = haversineDistance(targetPosition[0], targetPosition[1], Number(app.latitude), Number(app.longitude));
            map.set(app.id, d);
        });
        return map;
    }, [targetPosition, mappable]);

    // Sort by distance when target is set
    const sortedMappable = useMemo(() => {
        if (!targetPosition) return mappable;
        return [...mappable].sort((a, b) => (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity));
    }, [mappable, targetPosition, distances]);

    const center = useMemo<[number, number]>(() => {
        if (jitteredPositions.length === 0) return [-37.8136, 144.9631];
        const avgLat = jitteredPositions.reduce((s, p) => s + p[0], 0) / jitteredPositions.length;
        const avgLng = jitteredPositions.reduce((s, p) => s + p[1], 0) / jitteredPositions.length;
        return [avgLat, avgLng];
    }, [jitteredPositions]);

    const handleMarkerClick = useCallback((id: number) => {
        setSelectedId((prev) => (prev === id ? null : id));
        const card = listRefs.current[id];
        const container = scrollContainerRef.current;
        if (card && container) {
            const cardTop = card.offsetTop - container.offsetTop;
            container.scrollTo({ top: cardTop - container.clientHeight / 2 + card.clientHeight / 2, behavior: 'smooth' });
        }
    }, []);

    const markerClickRef = useRef(handleMarkerClick);
    markerClickRef.current = handleMarkerClick;

    const handleCardClick = useCallback((app: EmploymentApplication) => {
        setSelectedId(app.id);
        const idx = mappable.indexOf(app);
        if (idx >= 0) setFlyTarget(jitteredPositions[idx]);
    }, [mappable, jitteredPositions]);

    // Draw crow-fly line for a specific applicant
    const handleCrowFly = useCallback((app: EmploymentApplication) => {
        if (!targetPosition || !mapRef.current) return;

        if (activeLineId === app.id) {
            setActiveLineId(null);
            setDrivingInfo(null);
            (mapRef.current as any).fire('clearline');
            return;
        }

        const idx = mappable.indexOf(app);
        const to = idx >= 0 ? jitteredPositions[idx] : [Number(app.latitude), Number(app.longitude)] as [number, number];
        const km = distances.get(app.id) ?? haversineDistance(targetPosition[0], targetPosition[1], to[0], to[1]);

        setActiveLineId(app.id);
        setDrivingInfo(null);
        const appIcon = getIcon(app.status, `${app.first_name} ${app.surname}`, app.occupation);
        (mapRef.current as any).fire('drawcrowfly', { from: targetPosition, to, km, appMarkerHtml: appIcon.options.html });

        const bounds = L.latLngBounds([targetPosition, to]);
        mapRef.current.fitBounds(bounds, { padding: [80, 80] });
    }, [targetPosition, activeLineId, mappable, jitteredPositions, distances]);

    // Fetch driving route and draw it on the map
    const handleDriving = useCallback(async (app: EmploymentApplication) => {
        if (!targetPosition || !mapRef.current) return;

        if (drivingInfo?.id === app.id) {
            setDrivingInfo(null);
            setActiveLineId(null);
            (mapRef.current as any).fire('clearline');
            return;
        }

        setDrivingLoading(app.id);
        setActiveLineId(app.id);
        const result = await fetchDrivingRoute(
            targetPosition[0], targetPosition[1],
            Number(app.latitude), Number(app.longitude),
        );
        setDrivingLoading(null);
        if (result && mapRef.current) {
            setDrivingInfo({ id: app.id, info: result.info });
            const idx = mappable.indexOf(app);
            const to = idx >= 0 ? jitteredPositions[idx] : [Number(app.latitude), Number(app.longitude)] as [number, number];
            const appIcon = getIcon(app.status, `${app.first_name} ${app.surname}`, app.occupation);
            const crowflyKm = distances.get(app.id) ?? haversineDistance(targetPosition[0], targetPosition[1], Number(app.latitude), Number(app.longitude));
            (mapRef.current as any).fire('drawroute', {
                geometry: result.geometry,
                km: result.info.distance,
                duration: result.info.duration,
                from: targetPosition,
                to,
                appMarkerHtml: appIcon.options.html,
                crowflyKm,
            });
        }
    }, [targetPosition, drivingInfo, mappable, jitteredPositions, distances]);

    // Register global handlers for popup buttons
    const targetPosRef = useRef(targetPosition);
    targetPosRef.current = targetPosition;
    const handleCrowFlyRef = useRef(handleCrowFly);
    handleCrowFlyRef.current = handleCrowFly;
    const handleDrivingRef = useRef(handleDriving);
    handleDrivingRef.current = handleDriving;
    const mappableRef = useRef(mappable);
    mappableRef.current = mappable;

    useEffect(() => {
        (window as any).__mapCrowFly = (id: number) => {
            if (!targetPosRef.current) { alert('Search an address first to measure distances.'); return; }
            const app = mappableRef.current.find((a) => a.id === id);
            if (app) handleCrowFlyRef.current(app);
        };
        (window as any).__mapDriving = (id: number) => {
            if (!targetPosRef.current) { alert('Search an address first to measure distances.'); return; }
            const app = mappableRef.current.find((a) => a.id === id);
            if (app) handleDrivingRef.current(app);
        };
        return () => {
            delete (window as any).__mapCrowFly;
            delete (window as any).__mapDriving;
        };
    }, []);

    const clearLine = useCallback(() => {
        setActiveLineId(null);
        setDrivingInfo(null);
        if (mapRef.current) (mapRef.current as any).fire('clearline');
    }, []);

    const clearTarget = useCallback(() => {
        setTargetPosition(null);
        setTargetAddress('');
        setAddressInput('');
        setSuggestions([]);
        setActiveLineId(null);
        setDrivingInfo(null);
        if (mapRef.current) (mapRef.current as any).fire('clearline');
    }, []);

    return (
        <div className="flex h-full min-h-0 overflow-hidden rounded-lg border">
            {/* Left panel */}
            <div className="flex w-[320px] shrink-0 flex-col overflow-hidden border-r lg:w-[360px]">
                {/* Address input */}
                <div className="border-b px-3 py-2.5">
                    <div className="relative">
                        <MapPin className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                        <Input
                            ref={addressInputRef}
                            type="text"
                            placeholder="Search address to measure distances..."
                            className="pl-8 pr-8 text-sm"
                            value={addressInput}
                            disabled={geocoding}
                            onChange={(e) => handleAddressChange(e.target.value)}
                            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                            onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }}
                        />
                        {(targetPosition || addressInput) && (
                            <button
                                onClick={() => { clearTarget(); setAddressInput(''); setSuggestions([]); }}
                                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                        {geocoding && (
                            <div className="text-muted-foreground absolute top-1/2 right-8 -translate-y-1/2 text-xs animate-pulse">...</div>
                        )}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-white shadow-lg dark:bg-neutral-900">
                                {suggestions.map((p) => (
                                    <button
                                        key={p.place_id}
                                        className="hover:bg-muted w-full px-3 py-2 text-left text-sm transition-colors first:rounded-t-md last:rounded-b-md"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleSelectSuggestion(p)}
                                    >
                                        {p.description}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Count */}
                <div className="border-b px-3 py-1.5">
                    <p className="text-muted-foreground text-xs">
                        {mappable.length} applicant{mappable.length !== 1 ? 's' : ''} on map
                        {unmappable.length > 0 && ` · ${unmappable.length} without coordinates`}
                    </p>
                </div>

                {/* Applicant list */}
                <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollContainerRef}>
                    <div className="flex flex-col gap-0.5 p-1.5">
                        {sortedMappable.map((app) => (
                            <ApplicantCard
                                key={app.id}
                                app={app}
                                isSelected={selectedId === app.id}
                                crowflyKm={distances.get(app.id)}
                                hasTarget={targetPosition !== null}
                                isLineActive={activeLineId === app.id}
                                drivingInfo={drivingInfo?.id === app.id ? drivingInfo.info : undefined}
                                drivingLoading={drivingLoading === app.id}
                                onRef={(el) => { listRefs.current[app.id] = el; }}
                                onClick={() => handleCardClick(app)}
                                onCrowFly={() => handleCrowFly(app)}
                                onDriving={() => handleDriving(app)}
                            />
                        ))}
                        {unmappable.length > 0 && (
                            <>
                                <div className="text-muted-foreground px-2 pt-3 pb-1 text-xs font-medium">
                                    Not on map ({unmappable.length})
                                </div>
                                {unmappable.map((app) => (
                                    <div key={app.id} className="rounded-md border border-dashed p-2.5 opacity-60">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <Link href={`/employment-applications/${app.id}`} className="text-sm font-medium hover:underline">
                                                    {app.first_name} {app.surname}
                                                </Link>
                                                <p className="text-muted-foreground truncate text-xs">{app.suburb || 'No suburb'}</p>
                                            </div>
                                            <Badge variant="outline" className="text-xs">{STATUS_LABELS[app.status] ?? app.status}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Right panel: map */}
            <div className="relative min-w-0 flex-1">
                {mappable.length === 0 ? (
                    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3">
                        <MapPin className="h-12 w-12 opacity-30" />
                        <p className="text-sm">No geocoded applicants to display</p>
                        <p className="text-xs">Run <code className="bg-muted rounded px-1">php artisan applications:geocode</code> to geocode existing applications</p>
                    </div>
                ) : (
                    <>
                        <MapContainer center={center} zoom={10} className="h-full w-full" zoomControl={true}>
                            <MapRefCapture mapRef={mapRef} />
                            <TileLayer
                                url="https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2"
                                maxZoom={20}
                                subdomains="0123"
                            />
                            <ClusterLayer
                                applications={mappable}
                                jitteredPositions={jitteredPositions}
                                onMarkerClickRef={markerClickRef}
                            />
                            <TargetMarkerLayer position={targetPosition} label={targetAddress} />
                            <FlyTo position={flyTarget} />
                            <MapLineLayer />
                        </MapContainer>
                        {activeLineId !== null && (
                            <Button
                                variant="default"
                                size="sm"
                                className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2 gap-1.5 shadow-lg"
                                onClick={clearLine}
                            >
                                <X className="h-3.5 w-3.5" />
                                Back to all applicants
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Applicant card ─────────────────────────────────────────────────────────────

const ApplicantCard = memo(function ApplicantCard({
    app,
    isSelected,
    crowflyKm,
    hasTarget,
    isLineActive,
    drivingInfo,
    drivingLoading,
    onRef,
    onClick,
    onCrowFly,
    onDriving,
}: {
    app: EmploymentApplication;
    isSelected: boolean;
    crowflyKm?: number;
    hasTarget: boolean;
    isLineActive: boolean;
    drivingInfo?: DrivingInfo;
    drivingLoading: boolean;
    onRef: (el: HTMLDivElement | null) => void;
    onClick: () => void;
    onCrowFly: () => void;
    onDriving: () => void;
}) {
    return (
        <div
            ref={onRef}
            className={`cursor-pointer rounded-md border p-2.5 transition-colors ${
                isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
            }`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <Link
                        href={`/employment-applications/${app.id}`}
                        className="text-sm font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {app.first_name} {app.surname}
                    </Link>
                    <p className="text-muted-foreground truncate text-xs">{occupationLabel(app)}</p>
                    <p className="text-muted-foreground truncate text-xs">{app.suburb}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: STATUS_COLORS[app.status] ?? '#94a3b8', color: STATUS_COLORS[app.status] ?? '#94a3b8' }}
                    >
                        {STATUS_LABELS[app.status] ?? app.status}
                    </Badge>
                    {hasTarget && crowflyKm != null ? (
                        <div className="flex items-center gap-0 overflow-hidden rounded-md border" style={{ borderColor: getZone(crowflyKm).color + '40' }}>
                            <span className="px-2 py-0.5 text-[11px] font-semibold" style={{ color: getZone(crowflyKm).color }}>
                                {formatDistance(crowflyKm)}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: getZone(crowflyKm).color }}>
                                {getZone(crowflyKm).label.replace('Zone ', 'Z')}
                            </span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground text-xs">{formatDate(app.created_at)}</span>
                    )}
                </div>
            </div>

            {/* Crow-fly / Driving buttons — only when target is set */}
            {hasTarget && (
                <div className="mt-1.5 flex items-center gap-1.5">
                    <Button
                        variant={isLineActive ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); onCrowFly(); }}
                    >
                        <Plane className="h-3 w-3" />
                        {isLineActive && crowflyKm != null ? formatDistance(crowflyKm) : 'Crow fly'}
                    </Button>
                    <Button
                        variant={drivingInfo ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        disabled={drivingLoading}
                        onClick={(e) => { e.stopPropagation(); onDriving(); }}
                    >
                        <Navigation className="h-3 w-3" />
                        {drivingLoading
                            ? 'Loading...'
                            : drivingInfo
                                ? `${formatDistance(drivingInfo.distance)} · ${formatDuration(drivingInfo.duration)}`
                                : 'Driving'}
                    </Button>
                </div>
            )}
        </div>
    );
});
