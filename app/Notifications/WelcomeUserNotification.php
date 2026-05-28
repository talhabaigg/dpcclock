<?php

namespace App\Notifications;

use App\Notifications\Channels\ClickSendChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class WelcomeUserNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /** Restrict channels to a subset (values: 'mail', 'sms'). Null = all available. */
    public ?array $onlyChannels = null;

    public function __construct(
        private string $token,
        private string $inviterName,
    ) {}

    public function only(array $channels): self
    {
        $this->onlyChannels = $channels;

        return $this;
    }

    public function via(object $notifiable): array
    {
        $want = $this->onlyChannels ?? ['mail', 'sms'];
        $channels = [];

        if (in_array('mail', $want, true)) {
            $mailRoute = method_exists($notifiable, 'routeNotificationForMail')
                ? $notifiable->routeNotificationForMail($this)
                : $notifiable->routeNotificationFor('mail', $this);
            if (! empty($mailRoute)) {
                $channels[] = 'mail';
            }
        }

        if (in_array('sms', $want, true)) {
            $smsRoute = method_exists($notifiable, 'routeNotificationForClicksend')
                ? $notifiable->routeNotificationForClicksend()
                : $notifiable->routeNotificationFor('clicksend', $this);
            if (! empty($smsRoute)) {
                $channels[] = ClickSendChannel::class;
            }
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $prefix = app()->environment('production') ? '' : 'TEST - ';
        $appName = config('app.name');
        $url = $this->buildUrl($notifiable);
        $expireMinutes = $this->expireMinutes();

        return (new MailMessage)
            ->subject("{$prefix}{$this->inviterName} added you to {$appName}")
            ->greeting("Hi {$notifiable->name},")
            ->line("{$this->inviterName} has added you to {$appName}.")
            ->line('Click the button below to get started.')
            ->action('Get Started', $url)
            ->line("This link expires in {$expireMinutes} minutes. If it expires, use the **Forgot password** link on the sign-in page to request a new one.")
            ->line("If you weren't expecting this, you can safely ignore this email or reach out to {$this->inviterName}.");
    }

    public function toClicksend(object $notifiable): string
    {
        $prefix = app()->environment('production') ? '' : 'TEST - ';
        $appName = config('app.name');
        $url = $this->buildShortUrl($notifiable);
        $expireMinutes = $this->expireMinutes();

        return "{$prefix}{$this->inviterName} added you to {$appName}. Get started: {$url} (expires in {$expireMinutes} min)";
    }

    private function buildShortUrl(object $notifiable): string
    {
        $payload = [
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ];
        $ttl = now()->addMinutes($this->expireMinutes());

        do {
            $code = Str::random(8);
        } while (! Cache::add("setup-link:{$code}", $payload, $ttl));

        return url(route('setup-link.redirect', ['code' => $code], false));
    }

    private function buildUrl(object $notifiable): string
    {
        return url(route('password.reset', [
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ], false));
    }

    private function expireMinutes(): int
    {
        return config('auth.passwords.'.config('auth.defaults.passwords').'.expire');
    }
}
