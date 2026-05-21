<?php

namespace App\Notifications;

use App\Http\Controllers\InjuryController;
use App\Models\Injury;
use App\Notifications\Channels\ClickSendChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InjuryCreatedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /** Restrict channels to a subset (values: 'mail', 'sms'). Null = all available. */
    public ?array $onlyChannels = null;

    public function __construct(
        private Injury $injury,
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
        $employeeName = $this->injury->employee?->name ?? $this->injury->employee_name ?? 'Unknown';
        $location = $this->injury->location?->name ?? 'Unknown';
        $occurredAt = $this->injury->occurred_at?->format('d/m/Y H:i') ?? 'Unknown';
        $reportedBy = $this->injury->creator?->name ?? 'Unknown';

        $prefix = app()->environment('production') ? '' : 'TEST - ';

        $employeeUrl = $this->injury->employee
            ? url(route('employees.show', $this->injury->employee))
            : null;

        $employeeLink = $employeeUrl
            ? "[{$employeeName}]({$employeeUrl})"
            : $employeeName;

        return (new MailMessage)
            ->subject("{$prefix}New Injury Report: {$this->injury->id_formal}")
            ->greeting("Hi {$notifiable->name},")
            ->line("A new injury report **{$this->injury->id_formal}** has been submitted.")
            ->line("**Employee:** {$employeeLink}")
            ->line("**Location:** {$location}")
            ->line("**Occurred:** {$occurredAt}")
            ->line("**Reported by:** {$reportedBy}")
            ->action('View Injury Report', url(route('injury-register.show', $this->injury)))
            ->line('[View All Injuries](' . url(route('injury-register.index')) . ')')
            ->attachData(
                InjuryController::generatePdf($this->injury),
                $this->injury->id_formal . '.pdf',
                ['mime' => 'application/pdf'],
            );
    }

    public function toClicksend(object $notifiable): string
    {
        $employeeName = $this->injury->employee?->name ?? $this->injury->employee_name ?? 'Unknown';
        $location = $this->injury->location?->name ?? 'Unknown';
        $occurredAt = $this->injury->occurred_at?->format('d/m/Y H:i') ?? 'Unknown';
        $reportedBy = $this->injury->creator?->name ?? 'Unknown';

        $isProd = app()->environment('production');
        $prefix = $isProd ? '' : 'TEST - ';

        $body = "{$prefix}A new injury report {$this->injury->id_formal} has been submitted.\n"
            . "Employee: {$employeeName}\n"
            . "Location: {$location}\n"
            . "Occurred: {$occurredAt}\n"
            . "Reported by: {$reportedBy}";

        if ($isProd) {
            $body .= "\nView: " . url(route('injury-register.show', $this->injury));
        }

        return $body;
    }
}
