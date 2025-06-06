<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SyncedTimesheetsWithEH extends Notification
{
    use Queueable;

    /**
     * The notification message.
     *
     * @var string
     */
    protected $message;

    /**
     * Create a new notification instance.
     */
    public function __construct()
    {
        $this->message = 'Timesheets have been successfully synced with Employment Hero.';
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Timesheets Synced with EH')
            ->markdown('mail.timesheets.synced', [
                'message' => $this->message,
                'appName' => config('app.name'),
            ]);
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'message' => $this->message,
        ];
    }
}
