# Security Audit Report — Bank-Level / ISO 27001 Compliance

**Codebase:** `c:\Laravel\dpcclock` | **Date:** 2026-02-23 | **Scope:** Full-stack (Laravel 12 + React/TS)

7 parallel audit domains were scanned covering OWASP Top 10, ISO 27001 controls, and data integrity.

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| **CRITICAL** | 13 | Immediate action required |
| **HIGH** | 12 | This week |
| **MEDIUM** | 15 | This sprint |
| **LOW** | 8 | Backlog |

---

## CRITICAL — Fix Immediately

### 1. Hardcoded Credentials in `.env` (committed to repo context)
- DB password, AWS secret key, OpenAI/Anthropic API keys, Premier passwords all in plaintext
- **Action:** Rotate ALL credentials. Use AWS Secrets Manager or Vault.

### 2. `APP_DEBUG=true` in `.env`
- Exposes stack traces, DB queries, env variables, file paths on any error
- **Action:** Set `APP_DEBUG=false`, `APP_ENV=production`

### 3. `SESSION_ENCRYPT=false`
- Session data stored unencrypted in database — session hijacking if DB compromised
- **Action:** Set `SESSION_ENCRYPT=true`, `SESSION_SECURE_COOKIE=true`, `SESSION_SAME_SITE=strict`

### 4. Unauthenticated endpoints
- `/employees/sync` — no auth middleware, triggers Employment Hero API calls
- `/requisition/update-status` (GET/POST) — GUID-only auth, no rate limiting
- `/php-limits` — exposes PHP config to anyone
- **Action:** Add `auth` + `permission` middleware, remove debug endpoints

### 5. CORS wildcard `allowed_origins: ['*']`
- Any website can make cross-origin API requests
- **Action:** Whitelist specific domains only

### 6. Command injection in `BackupDatabase`
- `exec()` with interpolated DB password — shell injection via special chars
- **Action:** Use `Symfony\Component\Process\Process` with array syntax

### 7. Hardcoded default PIN `1234` for all employees
- Plaintext PIN comparison, no rate limiting on attempts
- **Action:** Hash PINs with `Hash::make()`, add rate limiting (5 attempts/min)

### 8. Missing authorization on routes
- Supplier categories (CRUD) — any authenticated user can modify
- Update pricing — any authenticated user can apply price changes
- Queue status view — inconsistent middleware
- **Action:** Add `permission:` middleware to all administrative routes

### 9. IDOR in requisition management
- `show()`, `process()`, `sendApi()` — no ownership/location verification
- Any user with `requisitions.view` can see ALL requisitions across locations
- **Action:** Add location-based ownership checks

### 10. OpenAI API key exposed in browser
- `resources/js/pages/purchasing/create-partials/aiImageExtractor.tsx` uses `dangerouslyAllowBrowser: true` with client-side API key
- **Action:** Move all AI calls to backend proxy endpoints

### 11. Sanctum tokens never expire
- `config/sanctum.php` → `'expiration' => null`
- **Action:** Set `'expiration' => 10080` (7 days)

### 12. No malware scanning on file uploads
- Drawing, site walk photo uploads go straight to S3 without scanning
- No MIME type validation on drawing uploads (`required|file|max:51200` only)
- **Action:** Add MIME validation, consider ClamAV scanning

### 13. npm vulnerabilities (14 high, 7 moderate)
- axios DoS, qs DoS, xlsx prototype pollution, vite server.fs.deny bypasses
- **Action:** `npm audit fix && npm update`

---

## HIGH — Fix This Week

| # | Issue | File |
|---|-------|------|
| 1 | No security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) | Missing middleware |
| 2 | No API rate limiting on any endpoint | `routes/api.php` |
| 3 | Plaintext credentials written to temp JSON for Playwright | `app/Jobs/SendToSupplierViaAgentJob.php` |
| 4 | Weak GUID validation (timing-attack vulnerable, should use `hash_equals()`) | `app/Http/Controllers/PurchasingController.php` |
| 5 | Kiosk token generation on GET (cached in browser/logs) | `routes/web.php:190` |
| 6 | User can modify own roles to admin | `app/Http/Controllers/UserController.php:36` |
| 7 | Database SSL not enforced | `config/database.php` |
| 8 | No brute force protection on admin PIN (4 digits = 10K combos) | `app/Http/Controllers/KioskController.php:305` |
| 9 | `dd()` calls in production code (13 instances in ClockController) | `app/Http/Controllers/ClockController.php:435+` |
| 10 | Real Reverb credentials in `.env.example` | `.env.example:67` |
| 11 | Missing file ownership verification on photo deletion | `app/Http/Controllers/Api/SiteWalkController.php:230` |
| 12 | S3 bucket visibility not explicitly set to private | `config/filesystems.php:52` |

---

## MEDIUM — Fix This Sprint

| # | Issue |
|---|-------|
| 1 | No audit logging on User, Location, Drawing, Employee models (ISO 27001 requires audit trails) |
| 2 | No data retention/deletion policy for soft-deleted records (GDPR compliance) |
| 3 | `$request->all()` logged without filtering sensitive fields |
| 4 | Original filenames stored without sanitization (potential injection in Content-Disposition) |
| 5 | Path traversal risk in `downloadIssuesFile()` (basename only) |
| 6 | Image processing without dimension limits (DoS via large images) |
| 7 | Inertia shared props expose full User object to all pages |
| 8 | Queue job payloads not encrypted (use `ShouldBeEncrypted` interface) |
| 9 | Power Automate webhook GUID check commented out |
| 10 | Mail scheme not enforcing TLS |
| 11 | MD5 used for cache keys (weak collision resistance) |
| 12 | OTP cookie missing `httpOnly` and `secure` flags |
| 13 | Loose comparison `!=` in kiosk middleware (should be `!==`) |
| 14 | No rate limiting on file uploads |
| 15 | Pannellum XSS vulnerability (v2.5.1-2.5.6) |

---

## Detailed Findings

### SQL Injection & Query Safety

#### Command Injection in BackupDatabase
**File:** `app/Console/Commands/BackupDatabase.php:43-48`
**Severity:** CRITICAL

```php
$command = "mysqldump -h{$dbHost} -P{$dbPort} -u{$dbUser} -p\"{$dbPass}\" {$dbName} > {$backupFilePath}";
exec($command, $output, $result);
```

- Database credentials visible in process list (`ps aux`)
- Shell injection if password contains special characters like `"; rm -rf /`
- **Fix:** Use `Symfony\Component\Process\Process` with array syntax:

```php
use Symfony\Component\Process\Process;

$process = new Process([
    'mysqldump',
    "-h{$dbHost}",
    "-P{$dbPort}",
    "-u{$dbUser}",
    "-p{$dbPass}",
    $dbName,
]);
$process->run();
file_put_contents($backupFilePath, $process->getOutput());
```

#### SQL String Interpolation in CashForecastController
**File:** `app/Http/Controllers/CashForecastController.php:840-847`
**Severity:** HIGH (mitigated — hardcoded input only)

```php
private function getMonthExpression(string $column): string
{
    return "DATE_FORMAT({$column}, '%Y-%m')";  // Variable interpolation
}
```

Currently safe (called with hardcoded `'job_cost_details.transaction_date'`), but dangerous pattern if reused.

**Fix:** Add column whitelist validation:
```php
private function getMonthExpression(string $column): string
{
    $allowed = ['job_cost_details.transaction_date', 'transaction_date'];
    if (!in_array($column, $allowed)) {
        throw new \InvalidArgumentException("Invalid column name");
    }
    return "DATE_FORMAT({$column}, '%Y-%m')";
}
```

#### SQL String Interpolation in LocationController
**File:** `app/Http/Controllers/LocationController.php:134-139`
**Severity:** HIGH (mitigated — hardcoded input only)

Same pattern as above with `selectRaw("$monthExpression as month, SUM(amount) as total")`.

---

### Authentication & Authorization

#### Unauthenticated Employee Sync Endpoint
**File:** `routes/web.php:95`
**Severity:** CRITICAL

```php
Route::get('/employees/sync', [EmployeeController::class, 'sync'])->name('employees.sync');
```

No `auth` middleware. Makes external API calls to Employment Hero. Controller even has a fallback:
```php
if (! Auth::check()) {
    return response()->json(['message' => 'Employees synced successfully.'], 200);
}
```

**Fix:** Add authentication and permission middleware.

#### Unauthenticated Webhook with auth()->user() Call
**File:** `app/Http/Controllers/PurchasingController.php:930-979`
**Severity:** CRITICAL

```php
activity()->performedOn($requisition)->causedBy(auth()->user())  // NULL if unauthenticated
```

Route has no `auth` middleware. `auth()->user()` returns NULL in webhook context, breaking audit trail.

**Fix:** Use `hash_equals()` for GUID validation, don't call `auth()->user()` in webhook context.

#### Missing Authorization on Supplier Categories
**File:** `routes/web.php:358-364`
**Severity:** CRITICAL

All 7 supplier category CRUD routes have no permission checks beyond `auth`.

#### Missing Authorization on Update Pricing
**File:** `routes/web.php:369-371`
**Severity:** HIGH

Any authenticated user can apply bulk price changes.

#### IDOR in Requisition Management
**File:** `app/Http/Controllers/PurchasingController.php:250-313`
**Severity:** CRITICAL

`show()`, `process()`, `sendApi()` load requisitions by ID without verifying the user has access to that location/project.

**Fix:**
```php
public function show($id)
{
    $requisition = Requisition::findOrFail($id);
    $user = auth()->user();
    if (!$user->hasRole('admin') && !$user->hasRole('backoffice')) {
        $userLocationIds = $user->managedKiosks()->pluck('eh_location_id')->unique();
        if (!$userLocationIds->contains($requisition->location->eh_location_id)) {
            abort(403);
        }
    }
}
```

#### User Can Modify Own Roles
**File:** `app/Http/Controllers/UserController.php:36-59`
**Severity:** HIGH

Controller doesn't prevent self-role-modification. A user with `users.manage-roles` can escalate to admin.

**Fix:** Add `if ($user->id === auth()->id()) abort(403);`

#### Hardcoded Default PIN
**File:** `app/Http/Controllers/EmployeeController.php:48`
**Severity:** CRITICAL

```php
'pin' => 1234,  // All employees created with same PIN, stored plaintext
```

**Fix:** Hash PINs with `Hash::make()`, generate random defaults.

#### No Brute Force Protection on PIN
**File:** `app/Http/Controllers/KioskAuthController.php:97-109`
**Severity:** HIGH

4-digit PIN = 10,000 combinations. No rate limiting.

**Fix:** Add `throttle:5,1` middleware (5 attempts per minute).

#### Sanctum Tokens Never Expire
**File:** `config/sanctum.php:49`
**Severity:** HIGH

```php
'expiration' => null,
```

**Fix:** Set `'expiration' => 10080` (7 days).

---

### XSS, CSRF & Input Validation

#### OpenAI API Key Exposed in Browser
**File:** `resources/js/pages/purchasing/create-partials/aiImageExtractor.tsx:15`
**Severity:** CRITICAL

```jsx
const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPEN_AI_API_KEY,
    dangerouslyAllowBrowser: true,
});
```

Key extractable from browser DevTools/network tab.

**Fix:** Create a Laravel proxy endpoint for OpenAI calls.

#### CORS Wildcard
**File:** `config/cors.php:18-26`
**Severity:** CRITICAL

```php
'allowed_origins' => ['*'],
'allowed_methods' => ['*'],
'allowed_headers' => ['*'],
```

**Fix:**
```php
'allowed_origins' => [env('APP_URL'), 'https://yourdomain.com'],
'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
'allowed_headers' => ['Content-Type', 'Authorization', 'X-CSRF-TOKEN'],
```

#### Sensitive Data Logged
**File:** `app/Http/Controllers/ForecastProjectController.php:512`
**Severity:** HIGH

```php
\Log::info('Request Data:', $request->all());
```

**Fix:** Filter sensitive fields: `$request->except(['password', 'pin', 'token'])`

#### No Content Security Policy
**Severity:** HIGH

No CSP headers configured anywhere. Vulnerable to inline script injection.

**Fix:** Add security headers middleware:
```php
$response->headers->set('Content-Security-Policy', "default-src 'self'; ...");
$response->headers->set('X-Content-Type-Options', 'nosniff');
$response->headers->set('X-Frame-Options', 'DENY');
$response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
```

---

### File Upload & Storage Security

#### No MIME Type Validation on Drawing Uploads
**File:** `app/Http/Controllers/DrawingController.php:119`
**Severity:** HIGH

```php
'files.*' => 'required|file|max:51200',  // Accepts ANY file type
```

**Fix:** Add `mimetypes:application/pdf,image/jpeg,image/png`

#### No Malware Scanning
**Severity:** CRITICAL

Files uploaded directly to S3 without virus/malware scanning.

**Fix:** Integrate ClamAV or AWS S3 malware scanning.

#### Original Filenames Not Sanitized
**File:** `app/Http/Controllers/DrawingController.php:130`
**Severity:** MEDIUM

```php
$fileName = $file->getClientOriginalName();
'original_name' => $fileName,  // Stored as-is
```

**Fix:** Use UUID-based filenames: `Str::random(16) . '.' . $file->getClientOriginalExtension()`

#### S3 Visibility Not Explicit
**File:** `config/filesystems.php:52-63`
**Severity:** HIGH

No explicit `'visibility' => 'private'` on S3 disk.

**Fix:** Add `'visibility' => 'private'` to S3 config.

#### Missing Authorization on File Deletion
**File:** `app/Http/Controllers/Api/SiteWalkController.php:230-242`
**Severity:** HIGH

```php
public function destroyPhoto(SiteWalkPhoto $photo)
{
    $photo->delete();  // No authorization check
}
```

**Fix:** Add `$this->authorize('delete', $photo)` with policy.

#### Path Traversal in downloadIssuesFile
**File:** `app/Http/Controllers/MaterialItemController.php:313`
**Severity:** MEDIUM

```php
$filename = basename($filename);  // Basic check only
```

**Fix:** Validate filename format with regex whitelist.

#### Image Processing Without Dimension Limits
**File:** `app/Services/ImageCropService.php:50-97`
**Severity:** MEDIUM

Can process arbitrarily large images causing memory exhaustion.

**Fix:** Add max dimension validation (e.g., 20000x20000px).

---

### API & Secrets Exposure

#### Debug Mode Enabled
**File:** `.env:4`
**Severity:** CRITICAL

`APP_DEBUG=true` — exposes full stack traces, credentials, file paths.

#### Exposed Debug Endpoint
**File:** `routes/web.php:813-819`
**Severity:** HIGH

```php
Route::get('/php-limits', fn () => response()->json([
    'sapi' => php_sapi_name(),
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    // ...
]));
```

No authentication required.

#### No API Rate Limiting
**File:** `routes/api.php`
**Severity:** HIGH

No throttle middleware on any API endpoint. Login, sync, drawing endpoints all unlimited.

**Fix:**
```php
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () { ... });
Route::post('/login', [...])->middleware('throttle:5,1');
```

#### Playwright Credentials in Plaintext Temp File
**File:** `app/Jobs/SendToSupplierViaAgentJob.php:69-81`
**Severity:** HIGH

```php
file_put_contents($configFile, json_encode([
    'PREMIER_WEB_PASSWORD' => config('premier.web.password'),
    'ANTHROPIC_API_KEY' => config('services.anthropic.api_key'),
]));
```

Race condition between creation and deletion. Other processes can read.

**Fix:** Use encrypted cache or environment variables with restricted file permissions.

#### `dd()` Calls in Production Code
**File:** `app/Http/Controllers/ClockController.php:435+`
**Severity:** HIGH

13 `dd()` calls that will crash requests if triggered.

**Fix:** Replace with `Log::error()` and proper error handling.

#### Real Credentials in .env.example
**File:** `.env.example:67-69`
**Severity:** HIGH

```env
REVERB_APP_ID=459254
REVERB_APP_KEY=u4kcr1cnv3378upcpfy4
REVERB_APP_SECRET=zesyv1xwnkfai3lprrm4
```

**Fix:** Replace with placeholders, rotate credentials.

---

### Mass Assignment, Encryption & Data Handling

#### Session Encryption Disabled
**File:** `config/session.php:50`, `.env:34`
**Severity:** CRITICAL

```php
'encrypt' => env('SESSION_ENCRYPT', false),
```

**Fix:** Enable encryption, set secure cookie flags.

#### No Field-Level Encryption for PII
**Severity:** HIGH

No models use Laravel's `'encrypted'` cast. Phone numbers, emails, PINs stored in plaintext.

**Fix:**
```php
protected function casts(): array {
    return ['phone' => 'encrypted', 'pin' => 'encrypted'];
}
```

#### Database SSL Not Enforced
**File:** `config/database.php:60-62`
**Severity:** HIGH

SSL CA is optional. Data transmitted in cleartext if not configured.

#### Mass Assignment Protection — Good
All 76 models have `$fillable` defined. No `$guarded = []` found.

#### Incomplete Audit Logging
**Severity:** MEDIUM (ISO 27001 gap)

Only 5/76 models use `LogsActivity`. Critical models like User, Location, Drawing, Employee lack audit trails.

#### No Data Retention Policy
**Severity:** MEDIUM (GDPR gap)

15+ models use `SoftDeletes` but no automated permanent deletion after retention period.

#### Queue Payloads Not Encrypted
**Severity:** MEDIUM

19+ queue jobs don't use `ShouldBeEncrypted` interface.

#### Inertia Props Expose Full User Object
**File:** `app/Http/Middleware/HandleInertiaRequests.php:46-50`
**Severity:** MEDIUM

User object with all attributes serialized to JavaScript on every page.

**Fix:** Use `->only(['id', 'name', 'email'])` or API Resource.

---

### Dependencies & Configuration

#### npm Vulnerabilities
**Severity:** CRITICAL

- **axios** (1.8.4): DoS via `__proto__` key
- **qs** (<=6.14.1): Multiple DoS vulnerabilities
- **xlsx**: Prototype Pollution & ReDoS (no fix available)
- **vite** (6.0-6.4): 8 server.fs.deny bypass vulnerabilities
- **pannellum** (2.5.1-2.5.6): XSS vulnerability

**Fix:** `npm audit fix && npm update axios qs vite pannellum`

#### No HTTPS Enforcement
**File:** `config/session.php:172`
**Severity:** HIGH

```php
'secure' => env('SESSION_SECURE_COOKIE'),  // Defaults to NULL
```

No HTTPS redirect in `.htaccess` either.

**Fix:** Set `SESSION_SECURE_COOKIE=true`, add HTTPS redirect in `.htaccess` or middleware.

#### Weak Logging Level
**File:** `config/logging.php:64`
**Severity:** MEDIUM

```php
'level' => env('LOG_LEVEL', 'debug'),  // Defaults to debug
```

Debug logs may contain sensitive data. Should default to `'notice'` in production.

#### SSL Verification Disabled in Local
**File:** `app/Providers/AppServiceProvider.php:31-35`
**Severity:** LOW

```php
if ($this->app->environment('local')) {
    Http::globalOptions(['verify' => false]);
}
```

Could be accidentally deployed to production.

#### OTP Cookie Missing Security Flags
**File:** `app/Http/Controllers/Auth/AuthenticatedSessionController.php:83-89`
**Severity:** MEDIUM

Cookie created without explicit `secure`, `httpOnly`, `sameSite` flags.

#### Loose Comparison in Kiosk Middleware
**File:** `app/Http/Middleware/CheckKioskTokenValidation.php:78`
**Severity:** MEDIUM

```php
if ($access['kiosk_id'] != $requestedKioskDbId) {  // Should use !==
```

#### Redis Without Password
**File:** `config/database.php:162`
**Severity:** LOW

```php
'password' => env('REDIS_PASSWORD'),  // Can be NULL
```

---

## ISO 27001 Compliance Gaps

| Control | Status | Gap |
|---------|--------|-----|
| A.8.2 Access Control | Partial | IDOR, missing permissions on routes |
| A.10.1 Cryptography | Fail | No field encryption, session unencrypted, plaintext PINs |
| A.12.4 Logging/Monitoring | Fail | Only 5/76 models have audit logging |
| A.12.6 Vulnerability Management | Fail | 21+ npm vulnerabilities unpatched |
| A.13.1 Network Security | Partial | No HTTPS enforcement, DB SSL optional |
| A.14.2 Secure Development | Partial | `dd()` in production, debug mode enabled |
| A.18.1 Data Protection | Fail | No encryption at rest, no retention policy |

---

## Remediation Roadmap

### Phase 1 — TODAY (Critical)
1. `APP_DEBUG=false`, `SESSION_ENCRYPT=true`, `SESSION_SECURE_COOKIE=true`
2. Rotate all credentials (DB, AWS, API keys, Premier, Reverb)
3. Add auth middleware to unprotected endpoints (`/employees/sync`, `/php-limits`, webhooks)
4. `npm audit fix && npm update`

### Phase 2 — THIS WEEK (High)
5. Fix CORS to whitelist specific origins
6. Add security headers middleware (CSP, HSTS, X-Frame-Options)
7. Implement API rate limiting on all endpoints
8. Move OpenAI calls from browser to backend proxy
9. Hash employee PINs, add brute force protection
10. Fix BackupDatabase command injection
11. Remove all `dd()` calls from production code
12. Replace real credentials in `.env.example` with placeholders

### Phase 3 — THIS SPRINT (Medium)
13. Add `LogsActivity` to all critical models (User, Location, Drawing, Employee)
14. Implement field-level encryption for PII (phone, email, PIN)
15. Add MIME validation to all file uploads
16. Implement IDOR checks with location-based ownership
17. Enforce DB SSL, set Sanctum token expiry
18. Create data retention/deletion policy for soft-deleted records
19. Encrypt queue job payloads with `ShouldBeEncrypted`
20. Secure Playwright credential handling

### Phase 4 — ONGOING
21. Monthly `npm audit` + `composer audit` in CI/CD
22. Quarterly security audit
23. Secrets management (AWS Secrets Manager / Vault)
24. WAF deployment
25. Malware scanning integration for file uploads

---

**Report Generated:** 2026-02-23
**Auditor:** Claude Code Security Audit (7 parallel domain scans)
**Next Review:** 2026-05-23
