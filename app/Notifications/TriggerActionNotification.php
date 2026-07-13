<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

/**
 * Generic notification fired by a send_notification trigger action. Title,
 * body and URL arrive already rendered (placeholders substituted) — this
 * class only routes them to the channels the action was configured with.
 */
class TriggerActionNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<int, string>  $channels  subset of: database, mail, webpush
     */
    public function __construct(
        private string $title,
        private string $body,
        private ?string $url,
        private array $channels,
    ) {}

    public function via(object $notifiable): array
    {
        $via = array_values(array_intersect(['database', 'mail'], $this->channels));

        if (in_array('webpush', $this->channels, true) && $notifiable->pushSubscriptions()->exists()) {
            $via[] = WebPushChannel::class;
        }

        return $via;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject($this->title)
            ->greeting("Hi {$notifiable->name},")
            ->line($this->body);

        if ($this->url) {
            $mail->action('View', $this->url);
        }

        return $mail;
    }

    public function toWebPush(object $notifiable, $notification): WebPushMessage
    {
        return (new WebPushMessage)
            ->title($this->title)
            ->body($this->body)
            ->icon('/icon-192x192.png')
            ->badge('/icon-192x192.png')
            ->data(['url' => $this->url ?? route('dashboard')])
            ->options(['TTL' => 86400]);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'TriggerAction',
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
        ];
    }
}
