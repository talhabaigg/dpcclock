<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class LocationSyncNotification extends Notification
{
    use Queueable;

    protected $status;

    protected $message;

    /**
     * Create a new notification instance.
     */
    public function __construct(string $status, string $message)
    {
        $this->status = $status;
        $this->message = $message;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'LocationSync',
            'status' => $this->status,
            'message' => $this->message,
        ];
    }
}
