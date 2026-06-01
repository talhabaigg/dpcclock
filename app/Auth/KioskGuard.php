<?php

namespace App\Auth;

use App\Models\Kiosk;
use App\Models\KioskDevice;
use Illuminate\Auth\GenericUser;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Auth\Guard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Resolves an "authenticated" identity for kiosk-context requests so private
 * broadcast channels (e.g. private-kiosk.{id}) can be authorized on device-token
 * iPads that have no web-auth user. The synthetic user only exposes an ID of
 * the form "kiosk:{id}" — it never grants any other authorization.
 */
class KioskGuard implements Guard
{
    protected Request $request;

    protected ?Authenticatable $user = null;

    protected bool $resolved = false;

    public function __construct(Request $request)
    {
        $this->request = $request;
    }

    public function check(): bool
    {
        return $this->user() !== null;
    }

    public function guest(): bool
    {
        return ! $this->check();
    }

    public function user(): ?Authenticatable
    {
        if ($this->resolved) {
            return $this->user;
        }

        $this->resolved = true;
        $this->user = $this->resolveKioskUser();

        return $this->user;
    }

    public function id(): ?string
    {
        return $this->user()?->getAuthIdentifier();
    }

    public function validate(array $credentials = []): bool
    {
        return false;
    }

    public function setUser(Authenticatable $user): void
    {
        $this->user = $user;
        $this->resolved = true;
    }

    public function hasUser(): bool
    {
        return $this->user !== null;
    }

    /**
     * Try each kiosk-access path: device-token cookie, worker-token cookie,
     * then validated session. The synthetic identity is keyed by the kiosk's
     * database id so channel callbacks can verify the user's kiosk matches the
     * channel's kiosk.
     */
    protected function resolveKioskUser(): ?Authenticatable
    {
        $deviceToken = $this->request->cookie('kiosk_device_token');
        if ($deviceToken) {
            $device = KioskDevice::where('device_token', $deviceToken)
                ->where('is_active', true)
                ->first();
            if ($device && $device->kiosk_id) {
                return $this->makeUser((int) $device->kiosk_id);
            }
        }

        $workerToken = $this->request->cookie('kiosk_worker_token');
        if ($workerToken) {
            $workerAccess = Cache::get("kiosk_worker:{$workerToken}");
            if ($workerAccess && now()->isBefore($workerAccess['expires_at'])) {
                return $this->makeUser((int) $workerAccess['kiosk_id']);
            }
        }

        $session = $this->request->hasSession() ? $this->request->session() : null;
        $access = $session?->get('kiosk_access');
        if ($access && isset($access['kiosk_id'], $access['expires_at']) && now()->isBefore($access['expires_at'])) {
            return $this->makeUser((int) $access['kiosk_id']);
        }

        return null;
    }

    protected function makeUser(int $kioskId): GenericUser
    {
        return new GenericUser([
            'id' => 'kiosk:'.$kioskId,
            'kiosk_id' => $kioskId,
        ]);
    }
}
