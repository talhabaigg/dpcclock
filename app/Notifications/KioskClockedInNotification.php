<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class KioskClockedInNotification extends Notification
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    protected $employees;

    public function __construct($employees)
    {
        $this->employees = $employees;
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

    /**
     * Pass the employee list to the mail.
     */
    public function buildEmployeeList(): string
    {
        return implode("\n", array_map(function ($employee) {
            return '* ' . $employee['name'];
        }, $this->employees));
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->line('The following employees are still clocked in:');

        foreach ($this->employees as $employee) {
            $clock = $employee['clocks'][0] ?? null;
            $clockInTime = $clock['clock_in'] ?? 'N/A';
            $mail->line('• ' . $employee['name'] . ' (Clocked in at: ' . $clockInTime . ')');
        }

        $mail->action('View Details', url('/timesheets'))
            ->line('Thank you for using our application!');

        return $mail;
    }
    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            //
        ];
    }
}
