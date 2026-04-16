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
    compact?: boolean;
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

export default function WeatherWidget({ weather, compact = false }: WeatherWidgetProps) {
    if (!weather || (!weather.current && !weather.forecast)) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <Cloud className="h-5 w-5" />
                <span>Weather unavailable for this location</span>
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
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-sky-200/60 dark:border-sky-800/40 bg-gradient-to-br from-sky-50 via-blue-50/80 to-indigo-50/50 dark:from-sky-950/30 dark:via-blue-950/20 dark:to-indigo-950/10">
            <div className="p-4">
                {/* Current conditions */}
                {current && (
                    <div className="flex items-center gap-4">
                        <GoogleWeatherIcon iconBaseUri={current.icon_code} size={56} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                                {current.temp != null && (
                                    <span className="text-4xl font-bold tracking-tighter">
                                        {Math.round(current.temp)}°
                                    </span>
                                )}
                                {current.condition && (
                                    <span className="text-sm font-medium text-muted-foreground">
                                        {current.condition}
                                    </span>
                                )}
                            </div>
                            {current.feels_like != null && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Feels like {Math.round(current.feels_like)}°
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Stats row */}
                {current && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        {current.humidity != null && (
                            <div className="flex items-center gap-1.5 rounded-lg bg-white/60 dark:bg-white/5 px-2.5 py-1.5">
                                <Droplets className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground leading-none">Humidity</p>
                                    <p className="text-sm font-semibold leading-tight">{current.humidity}%</p>
                                </div>
                            </div>
                        )}
                        {current.wind_speed != null && (
                            <div className="flex items-center gap-1.5 rounded-lg bg-white/60 dark:bg-white/5 px-2.5 py-1.5">
                                <Wind className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground leading-none">Wind</p>
                                    <p className="text-sm font-semibold leading-tight">{Math.round(current.wind_speed)} km/h</p>
                                </div>
                            </div>
                        )}
                        {current.uv_index != null && (
                            <div className="flex items-center gap-1.5 rounded-lg bg-white/60 dark:bg-white/5 px-2.5 py-1.5">
                                <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground leading-none">UV Index</p>
                                    <p className="text-sm font-semibold leading-tight">{current.uv_index}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Forecast bar */}
            {forecast && (
                <div className="flex items-center justify-between gap-3 border-t border-sky-200/60 dark:border-sky-800/40 bg-white/40 dark:bg-white/5 px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                        {forecast.icon_code && current && (
                            <GoogleWeatherIcon iconBaseUri={forecast.icon_code} size={28} />
                        )}
                        <span className="font-medium">Today</span>
                        {forecast.condition && (
                            <span className="text-muted-foreground hidden sm:inline">{forecast.condition}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {forecast.high != null && (
                            <span className="flex items-center gap-0.5 font-semibold">
                                <ArrowUp className="h-3 w-3 text-red-400" />
                                {Math.round(forecast.high)}°
                            </span>
                        )}
                        {forecast.low != null && (
                            <span className="flex items-center gap-0.5 text-muted-foreground">
                                <ArrowDown className="h-3 w-3 text-blue-400" />
                                {Math.round(forecast.low)}°
                            </span>
                        )}
                        {forecast.rain_chance != null && (
                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <CloudRain className="h-3.5 w-3.5" />
                                {forecast.rain_chance}%
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
