<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class KioskClockedInNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    protected $employees;

    protected $kioskName;

    public function __construct($employees, $kioskName)
    {
        $this->kioskName = $kioskName;
        $this->employees = $employees;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $channels = ['mail', 'database'];

        // Add WebPush channel if user has push subscriptions
        if ($notifiable->pushSubscriptions()->exists()) {
            $channels[] = WebPushChannel::class;
        }

        return $channels;
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
            return '* '.$employee['name'];
        }, $this->employees));
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject(now()->format('d-m-Y')." - Employees Clocked In at {$this->kioskName} - ") // Add Kiosk Name and current date to subject
            ->line('The following employees are still clocked in at '.$this->kioskName.':'); // Kiosk Name in body

        foreach ($this->employees as $employee) {
            $clock = $employee['clocks'][0] ?? null;
            $clockInTime = $clock['clock_in'] ?? 'N/A';
            $mail->line('• '.$employee['name'].' (Clocked in at: '.$clockInTime.')');
        }

        $mail->action('View Details', url('/timesheets'))
            ->line('Thank you for using our application!');

        return $mail;
    }

    /**
     * Get the web push representation of the notification.
     */
    public function toWebPush(object $notifiable, $notification): WebPushMessage
    {
        $employeeCount = count($this->employees);
        $body = $employeeCount === 1
            ? "{$this->employees[0]['name']} is still clocked in at {$this->kioskName}"
            : "{$employeeCount} employees are still clocked in at {$this->kioskName}";

        return (new WebPushMessage)
            ->title('Workers Still Clocked In')
            ->body($body)
            ->icon('/icon-192x192.png')
            ->badge('/icon-192x192.png')
            ->tag('clocked-in-'.now()->format('Y-m-d'))
            ->options(['TTL' => 3600]); // 1 hour
    }

    /**
     * Get the array representation of the notification (for database).
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $employeeCount = count($this->employees);
        $employeeNames = array_map(fn ($e) => $e['name'], $this->employees);

        $message = $employeeCount === 1
            ? "{$this->employees[0]['name']} is still clocked in at {$this->kioskName}"
            : "{$employeeCount} employees are still clocked in at {$this->kioskName}";

        return [
            'type' => 'KioskClockedIn',
            'title' => 'Workers Still Clocked In',
            'body' => $message,
            'message' => $message,
            'kiosk_name' => $this->kioskName,
            'employee_count' => $employeeCount,
            'employee_names' => $employeeNames,
            'url' => url('/timesheets'),
        ];
    }
}
