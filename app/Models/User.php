<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use NotificationChannels\WebPush\HasPushSubscriptions;
use Spatie\Activitylog\Traits\CausesActivity;
use Spatie\LaravelPasskeys\Models\Concerns\HasPasskeys;
use Spatie\LaravelPasskeys\Models\Concerns\InteractsWithPasskeys;
use Spatie\OneTimePasswords\Models\Concerns\HasOneTimePasswords;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements HasPasskeys
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use CausesActivity, HasApiTokens, HasFactory, HasOneTimePasswords, HasPushSubscriptions, HasRoles, InteractsWithPasskeys, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'disable_kiosk_notifications',
        'passkey_prompt_dismissed',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'passkey_prompt_dismissed' => 'boolean',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    public function managedKiosks()
    {
        return $this->belongsToMany(Kiosk::class, 'kiosk_user');
    }

    public function aiChatMessages()
    {
        return $this->hasMany(AiChatMessage::class);
    }

    public function voiceCallSessions()
    {
        return $this->hasMany(VoiceCallSession::class);
    }

    public function tokenUsage(): int
    {
        return (int) $this->aiChatMessages()->sum('tokens_used');
    }

    /**
     * Get detailed token usage statistics
     */
    public function tokenStats(): array
    {
        $stats = $this->aiChatMessages()
            ->selectRaw('
                COALESCE(SUM(tokens_used), 0) as total_tokens,
                COALESCE(SUM(input_tokens), 0) as input_tokens,
                COALESCE(SUM(output_tokens), 0) as output_tokens,
                COUNT(*) as message_count
            ')
            ->first();

        $totalTokens = (int) ($stats->total_tokens ?? 0);
        $inputTokens = (int) ($stats->input_tokens ?? 0);
        $outputTokens = (int) ($stats->output_tokens ?? 0);

        // GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output
        // Use breakdown if available, otherwise estimate 30% input, 70% output
        if ($inputTokens > 0 || $outputTokens > 0) {
            $estimatedCost = ($inputTokens * 0.15 / 1_000_000) + ($outputTokens * 0.60 / 1_000_000);
        } else {
            // Fallback estimate when breakdown not available
            $estimatedCost = ($totalTokens * 0.30 * 0.15 / 1_000_000) + ($totalTokens * 0.70 * 0.60 / 1_000_000);
        }

        // Get voice call stats
        $voiceStats = $this->voiceCallSessions()
            ->where('status', 'completed')
            ->selectRaw('
                COALESCE(SUM(duration_seconds), 0) as total_seconds,
                COALESCE(SUM(estimated_cost), 0) as voice_cost,
                COUNT(*) as call_count
            ')
            ->first();

        $voiceMinutes = round(($voiceStats->total_seconds ?? 0) / 60, 2);
        $voiceCost = (float) ($voiceStats->voice_cost ?? 0);
        $totalCost = round($estimatedCost + $voiceCost, 4);

        return [
            'total_tokens' => $totalTokens,
            'input_tokens' => $inputTokens,
            'output_tokens' => $outputTokens,
            'message_count' => (int) ($stats->message_count ?? 0),
            'estimated_cost' => round($estimatedCost, 4),
            'limit' => 1_000_000, // Token limit per user
            // Voice stats
            'voice_minutes' => $voiceMinutes,
            'voice_calls' => (int) ($voiceStats->call_count ?? 0),
            'voice_cost' => round($voiceCost, 4),
            'total_cost' => $totalCost,
        ];
    }
}
