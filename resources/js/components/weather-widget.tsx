import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Cloud, CloudRain, Droplets, Sun, Wind } from 'lucide-react';

interface WeatherData {
    current?: {
        temp?: number | null;
        feels_like?: number | null;
        condition?: string | null;
        icon_code?: string | null;
        humidity?: number | null;
        wind_speed?: number | null;
        wind_direction?: number | null;
        uv_index?: number | null;
    } | null;
    forecast?: {
        high?: number | null;
        low?: number | null;
        rain_chance?: number | null;
        condition?: string | null;
        icon_code?: string | null;
    } | null;
    fetched_at?: string | null;
}

interface WeatherWidgetProps {
    weather: WeatherData | null;
    workDate?: string | null;
    compact?: boolean;
    dense?: boolean;
}

function brisbaneDateOf(iso: string): string | null {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Australia/Brisbane',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (!y || !m || !d) return null;
    return `${y}-${m}-${d}`;
}

function formatBrisbane(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Brisbane',
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}

function GoogleWeatherIcon({ iconBaseUri, size = 48 }: { iconBaseUri?: string | null; size?: number }) {
    if (!iconBaseUri) return <Cloud className="h-10 w-10 text-gray-400" />;
    return (
        <img
            src={`${iconBaseUri}.png`}
            alt="Weather"
            width={size}
            height={size}
            className="drop-shadow-sm"
        />
    );
}

export default function WeatherWidget({ weather, workDate, compact = false, dense = false }: WeatherWidgetProps) {
    // Reject stale weather — if the stored payload was fetched on a different
    // Brisbane day than the prestart's work_date, treat it as not yet fetched.
    const isStale = (() => {
        if (!workDate || !weather?.fetched_at) return false;
        const fetchedDay = brisbaneDateOf(weather.fetched_at);
        return fetchedDay !== null && fetchedDay !== workDate;
    })();

    if (isStale || !weather || (!weather.current && !weather.forecast)) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <Cloud className="h-5 w-5" />
                <span>Weather will be fetched on work date</span>
            </div>
        );
    }

    const { current, forecast } = weather;

    if (compact) {
        return (
            <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20 border border-sky-200/60 dark:border-sky-800/40 px-4 py-2">
                <GoogleWeatherIcon iconBaseUri={current?.icon_code || forecast?.icon_code} size={36} />
                <div className="flex items-center gap-3 text-sm">
                    {current?.temp != null && (
                        <span className="text-lg font-semibold">{Math.round(current.temp)}°C</span>
                    )}
                    {current?.condition && (
                        <span className="text-muted-foreground">{current.condition}</span>
                    )}
                    {forecast?.rain_chance != null && forecast.rain_chance > 0 && (
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Droplets className="h-3.5 w-3.5" />
                            {forecast.rain_chance}%
                        </span>
                    )}
                </div>
                {weather.fetched_at && (
                    <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
                        as at {formatBrisbane(weather.fetched_at)}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-sky-200/40 bg-gradient-to-br from-white via-sky-50/60 to-sky-100/40 shadow-[0_4px_20px_-14px_rgba(14,165,233,0.25)] dark:border-sky-900/40 dark:from-sky-950/40 dark:via-sky-950/60 dark:to-blue-950/60 dark:shadow-[0_4px_20px_-14px_rgba(2,132,199,0.3)]">
            {dense ? (
                current && (
                    <div className="flex items-center gap-3 px-3 py-2">
                        <GoogleWeatherIcon iconBaseUri={current.icon_code} size={32} />
                        {current.temp != null && (
                            <span className="text-xl font-bold tracking-tighter">{Math.round(current.temp)}°</span>
                        )}
                        {current.condition && (
                            <span className="truncate text-xs text-muted-foreground">{current.condition}</span>
                        )}
                        <div className="ml-auto flex items-center gap-2.5 text-xs">
                            {current.humidity != null && (
                                <span className="flex items-center gap-1"><Droplets className="h-3 w-3 text-blue-500" />{current.humidity}%</span>
                            )}
                            {current.wind_speed != null && (
                                <span className="flex items-center gap-1"><Wind className="h-3 w-3 text-teal-500" />{Math.round(current.wind_speed)}</span>
                            )}
                            {current.uv_index != null && (
                                <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-amber-500" />{current.uv_index}</span>
                            )}
                        </div>
                    </div>
                )
            ) : (
                <div className="p-5">
                    {/* Current conditions */}
                    {current && (
                        <div className="flex items-center gap-4">
                            <GoogleWeatherIcon iconBaseUri={current.icon_code} size={60} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2.5">
                                    {current.temp != null && (
                                        <span className="text-5xl font-medium tracking-[-0.04em]">
                                            {Math.round(current.temp)}°
                                        </span>
                                    )}
                                    {current.condition && (
                                        <span className="text-muted-foreground text-sm font-medium">
                                            {current.condition}
                                        </span>
                                    )}
                                </div>
                                {current.feels_like != null && (
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        Feels like {Math.round(current.feels_like)}°
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Stats row */}
                    {current && (
                        <div className="mt-4 grid grid-cols-3 gap-3">
                            {current.humidity != null && (
                                <div className="flex items-center gap-2">
                                    <Droplets className="text-muted-foreground/70 h-4 w-4 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-muted-foreground text-[11px] leading-none">Humidity</p>
                                        <p className="text-sm font-medium leading-tight">{current.humidity}%</p>
                                    </div>
                                </div>
                            )}
                            {current.wind_speed != null && (
                                <div className="flex items-center gap-2">
                                    <Wind className="text-muted-foreground/70 h-4 w-4 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-muted-foreground text-[11px] leading-none">Wind</p>
                                        <p className="text-sm font-medium leading-tight">{Math.round(current.wind_speed)} km/h</p>
                                    </div>
                                </div>
                            )}
                            {current.uv_index != null && (
                                <div className="flex items-center gap-2">
                                    <Sun className="text-muted-foreground/70 h-4 w-4 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-muted-foreground text-[11px] leading-none">UV Index</p>
                                        <p className="text-sm font-medium leading-tight">{current.uv_index}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Forecast bar */}
            {forecast && (
                <div className={cn('flex items-center justify-between gap-3 border-t border-sky-200/50 bg-white/50 backdrop-blur-md dark:border-sky-800/50 dark:bg-sky-950/40', dense ? 'px-3 py-1 text-xs' : 'px-4 py-2.5 text-sm')}>
                    <div className="flex min-w-0 items-center gap-2">
                        {forecast.icon_code && current && !dense && (
                            <GoogleWeatherIcon iconBaseUri={forecast.icon_code} size={28} />
                        )}
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium">Today</span>
                                {forecast.condition && (
                                    <span className="text-muted-foreground hidden sm:inline">{forecast.condition}</span>
                                )}
                            </div>
                            {weather.fetched_at && (
                                <span className="text-muted-foreground block text-[10px] leading-none">
                                    as at {formatBrisbane(weather.fetched_at)}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className={cn('flex items-center', dense ? 'gap-2' : 'gap-3')}>
                        {forecast.high != null && (
                            <span className="flex items-center gap-0.5 font-medium">
                                <ArrowUp className="text-muted-foreground/70 h-3 w-3" />
                                {Math.round(forecast.high)}°
                            </span>
                        )}
                        {forecast.low != null && (
                            <span className="text-muted-foreground flex items-center gap-0.5">
                                <ArrowDown className="text-muted-foreground/70 h-3 w-3" />
                                {Math.round(forecast.low)}°
                            </span>
                        )}
                        {forecast.rain_chance != null && (
                            <span className="text-muted-foreground flex items-center gap-1">
                                <CloudRain className="text-muted-foreground/70 h-3 w-3" />
                                {forecast.rain_chance}%
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
