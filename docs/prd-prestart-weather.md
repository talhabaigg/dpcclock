# PRD: Automated Weather for Daily Prestarts

## Problem Statement

Foremen currently enter weather conditions manually as free text when creating a daily prestart. This is inconsistent, often inaccurate, and adds friction to the prestart creation flow. The "weather impact" field is underutilised and overlaps with safety concerns. When prestarts are copied from the previous day (a very common workflow), stale weather data carries over without being updated.

## Solution

Replace the manual weather entry with automated weather data fetched from the Google Maps Weather API. When a prestart is created or saved, the system fetches current conditions and the daily forecast using the location's geocoded coordinates, storing the result as structured JSON. A visual weather widget displays this data on the prestart UI. The weather impact field is hidden from the frontend but retained in the database for future use.

Location addresses are sourced from the Premier ERP system via the `GET /api/Job/GetJobs` endpoint and geocoded to lat/lng using the Google Geocoding API. This address and coordinate data is stored on the Location model for reuse across other features.

## User Stories

1. As a foreman, I want weather to be automatically populated when I create a prestart, so that I don't have to manually type conditions.
2. As a foreman, I want to see a visual weather widget showing temperature, conditions, and an icon, so that weather information is easy to read at a glance.
3. As a foreman, I want to see both current conditions and the daily forecast, so that I know what to expect for the full work day.
4. As a foreman, I want weather to refresh automatically when I copy yesterday's prestart, so that I get today's weather instead of yesterday's.
5. As a foreman, I want the weather to be captured at the time of prestart creation, so that the signed document reflects conditions when the crew acknowledged it.
6. As a site worker signing a prestart on the kiosk, I want to see a clear weather summary, so that I understand the day's conditions before signing.
7. As an admin, I want location addresses to sync from Premier automatically, so that I don't have to manually enter site addresses.
8. As an admin, I want addresses to be geocoded automatically when they sync, so that weather and other location-based features work without manual coordinate entry.
9. As an admin, I want locations with placeholder addresses (e.g. "TBA") to be skipped for geocoding, so that the system doesn't store incorrect coordinates.
10. As a user viewing the prestart PDF, I want weather data rendered clearly in the document, so that the printed/exported record includes weather conditions.
11. As an admin, I want the weather impact column preserved in the database, so that it can be re-enabled for future use if needed.
12. As a foreman, I want weather to be fetched based on the specific job site location, so that conditions are accurate for where I'm actually working.
13. As a system, I want to only re-geocode a location when its address changes, so that unnecessary API calls are avoided.
14. As a system, I want weather fetched once on prestart creation and locked in, so that the signed document remains an accurate point-in-time record.

## Implementation Decisions

### Data Sources

- **Location addresses** come from the Premier Swagger API endpoint `GET /api/Job/GetJobs` (requires `CompanyId` parameter and OAuth2 bearer token via `PremierAuthenticationService`).
- Jobs are matched to locations via `JobNumber` to `Location.external_id`.
- The API returns `AddressLine1`, `City`, `StateCode`, `CountryCode`, `ZipCode` per job. Some jobs have "TBA" placeholder values — these are skipped for geocoding.
- Currently only the SWCP company is accessible (`3341c7c6-2abb-49e1-8a59-839d1bcff972`), but the pattern supports multiple companies.

### Schema Changes

- **`locations` table** — Add columns: `address_line1` (string, nullable), `city` (string, nullable), `state_code` (string, nullable), `country_code` (string, nullable), `zip_code` (string, nullable), `latitude` (decimal 10,7, nullable), `longitude` (decimal 10,7, nullable).
- **`daily_prestarts` table** — No schema changes. The existing `weather` (text, nullable) column stores JSON. The `weather_impact` column remains but is no longer populated from the frontend.

### Modules

1. **Premier Job Address Sync** — A new job or extension to the existing Premier sync flow that calls `GetJobs` per company, matches to locations, and upserts address fields. Geocodes inline when address changes using the GeocodingService.

2. **GeocodingService** — New service with interface `geocode(string $address): ?array{lat, lng}`. Uses Google Geocoding API with the existing `GOOGLE_MAPS_API_KEY`. Returns null for unresolvable addresses. Called inline during Premier sync — volume is low enough that a queue job is unnecessary.

3. **WeatherService** — New service with interface `getWeather(float $lat, float $lng): array`. Calls Google Maps Weather API endpoints (`currentConditions:lookup` and `forecast:lookup`). Returns structured array with current conditions (temp, condition text, icon code, humidity, wind speed) and daily forecast (high, low, rain chance, condition text).

4. **DailyPrestart model changes** — Cast `weather` column to `array`. On create/save, if the location has coordinates, call WeatherService and store the result. On copy from previous day, always re-fetch weather for the new work_date and location.

5. **Weather Widget (React)** — A visual component rendering the structured weather JSON. Displays current temp, condition icon, wind, humidity, and forecast high/low with rain chance. Used on the prestart sign page and create/edit form.

6. **PDF template update** — Update `prestart-sign-sheet.blade.php` to render weather from the JSON structure. Remove `weather_impact` display.

7. **Frontend cleanup** — Remove `weather` free-text input and `weather_impact` input from prestart create/edit forms. Remove `weather_impact` display from prestart sign page.

### Weather JSON Structure

```json
{
  "current": {
    "temp": 28,
    "condition": "Partly Cloudy",
    "icon": "partly_cloudy",
    "humidity": 60,
    "wind_speed": 15
  },
  "forecast": {
    "high": 32,
    "low": 21,
    "rain_chance": 20,
    "condition": "Mostly Sunny"
  }
}
```

### Key Decisions

- Weather is fetched **once on create/save** and locked in. No periodic refresh. The prestart is a point-in-time compliance document.
- Geocoding happens **inline during Premier sync**, not queued. Volume is low (handful of locations).
- Google Geocoding API for server-side lat/lng resolution. Google Places API remains reserved for frontend autocomplete (employment applications).
- All Google APIs share the existing `GOOGLE_MAPS_API_KEY`.
- Old free-text `weather` values in the database are handled gracefully — check type before rendering.

## Testing Decisions

Tests should verify external behaviour through the service interfaces, not implementation details. Mock external API responses (Google, Premier) rather than hitting live endpoints.

### Modules to test

- **GeocodingService** — Test that a valid address returns lat/lng, that "TBA" or empty addresses return null, and that malformed API responses are handled gracefully.
- **WeatherService** — Test that valid lat/lng returns the expected structured array, that missing API fields are handled with sensible defaults, and that API failures return null or throw appropriately.

### Test approach

- Feature tests with mocked HTTP responses using Laravel's `Http::fake()`.
- Assert on the returned data structure and values, not on how the service internally constructs the request.

## Out of Scope

- Manual address entry UI for locations (addresses come from Premier sync only for now).
- Weather alerts or severe weather notifications.
- Historical weather data or weather trends.
- Updating weather after prestart creation (no periodic refresh).
- Removing the `weather_impact` database column.
- Other companies beyond SWCP (will work automatically when API access is granted).
- Google Places autocomplete on location edit page (planned separately for employment applications).

## Further Notes

- The `weather_impact` column is intentionally kept in the database. It may be re-enabled in a future iteration if there's a need for foremen to annotate weather-related work impacts.
- Locations without coordinates (no Premier address or "TBA" address) will simply not have automated weather — the weather widget should handle this gracefully with a "Weather unavailable" state.
- The location address and coordinate data has value beyond weather (e.g. mapping, travel distance, geofencing) — storing it on the Location model enables these future features.
