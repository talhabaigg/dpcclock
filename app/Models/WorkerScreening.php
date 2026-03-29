<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkerScreening extends Model
{
    protected $fillable = [
        'first_name',
        'surname',
        'phone',
        'email',
        'date_of_birth',
        'reason',
        'status',
        'added_by',
        'removed_by',
        'removed_at',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'removed_at' => 'datetime',
    ];

    public static function normalizePhone(?string $phone): ?string
    {
        if (! $phone) {
            return null;
        }

        return preg_replace('/\D/', '', $phone);
    }

    protected static function booted(): void
    {
        static::saving(function (WorkerScreening $screening) {
            $screening->phone = static::normalizePhone($screening->phone);
        });
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function addedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function removedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'removed_by');
    }

    /**
     * Check if a worker matches any active screening record.
     * Matches by: phone (digits-only), email (case-insensitive), or first_name+surname+DOB.
     */
    public static function checkWorker(array $criteria): ?self
    {
        $phone = static::normalizePhone($criteria['phone'] ?? null);
        $email = $criteria['email'] ?? null;
        $firstName = $criteria['first_name'] ?? null;
        $surname = $criteria['surname'] ?? null;
        $dob = $criteria['date_of_birth'] ?? null;

        $hasAnyCriteria = $phone || $email || $firstName || $surname || $dob;
        if (! $hasAnyCriteria) {
            return null;
        }

        return static::active()
            ->where(function ($query) use ($phone, $email, $firstName, $surname, $dob) {
                if ($phone) {
                    $query->orWhere('phone', $phone);
                }
                if ($email) {
                    $query->orWhereRaw('LOWER(email) = ?', [strtolower($email)]);
                }
                // Name + DOB combo
                if ($firstName && $surname && $dob) {
                    $query->orWhere(function ($q) use ($firstName, $surname, $dob) {
                        $q->whereRaw('LOWER(first_name) = ?', [strtolower($firstName)])
                          ->whereRaw('LOWER(surname) = ?', [strtolower($surname)])
                          ->where('date_of_birth', $dob);
                    });
                } elseif ($firstName && $dob) {
                    $query->orWhere(function ($q) use ($firstName, $dob) {
                        $q->whereRaw('LOWER(first_name) = ?', [strtolower($firstName)])
                          ->where('date_of_birth', $dob);
                    });
                } elseif ($surname && $dob) {
                    $query->orWhere(function ($q) use ($surname, $dob) {
                        $q->whereRaw('LOWER(surname) = ?', [strtolower($surname)])
                          ->where('date_of_birth', $dob);
                    });
                }
            })
            ->first();
    }
}
