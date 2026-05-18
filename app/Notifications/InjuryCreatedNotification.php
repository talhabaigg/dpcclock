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

    public function __construct(
        private Injury $injury,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['mail'];

        if (method_exists($notifiable, 'routeNotificationForClicksend')
            && $notifiable->routeNotificationForClicksend()) {
            $channels[] = ClickSendChannel::class;
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
