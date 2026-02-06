<?php

namespace App\Notifications;

use App\Models\JobForecast;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class JobForecastStatusNotification extends Notification
{
    use Queueable;

    protected JobForecast $forecast;

    protected string $action;

    protected ?User $actor;

    protected ?string $message;

    /**
     * Create a new notification instance.
     *
     * @param  JobForecast  $forecast  The forecast that changed
     * @param  string  $action  The action taken (submitted, finalized, rejected)
     * @param  User|null  $actor  The user who performed the action
     * @param  string|null  $message  Optional message (e.g., rejection reason)
     */
    public function __construct(
        JobForecast $forecast,
        string $action,
        ?User $actor = null,
        ?string $message = null
    ) {
        $this->forecast = $forecast;
        $this->action = $action;
        $this->actor = $actor;
        $this->message = $message;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $channels = ['database'];

        // Add WebPush channel if user has push subscriptions
        if ($notifiable->pushSubscriptions()->exists()) {
            $channels[] = WebPushChannel::class;
        }

        return $channels;
    }

    /**
     * Get the web push representation of the notification.
     */
    public function toWebPush(object $notifiable, $notification): WebPushMessage
    {
        $data = $this->toArray($notifiable);

        // Build URL to the forecast page
        $location = \App\Models\Location::where('external_id', $this->forecast->job_number)->first();
        $url = $location
            ? route('jobForecast.show', ['location' => $location->id])
            : route('dashboard');

        return (new WebPushMessage)
            ->title($data['title'])
            ->body($data['body'])
            ->icon('/icon-192x192.png')
            ->badge('/icon-192x192.png')
            ->tag('forecast-'.$this->forecast->id)
            ->data(['url' => $url])
            ->options(['TTL' => 86400]); // 24 hours
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray(object $notifiable): array
    {
        $jobNumber = $this->forecast->job_number;
        $forecastMonth = $this->forecast->forecast_month->format('M Y');
        $actorName = $this->actor?->name ?? 'System';

        // Get location ID from job number
        $location = \App\Models\Location::where('external_id', $jobNumber)->first();
        $locationId = $location?->id;

        $title = match ($this->action) {
            'submitted' => 'Forecast Submitted for Review',
            'finalized' => 'Forecast Finalized',
            'rejected' => 'Forecast Rejected',
            default => 'Forecast Status Updated',
        };

        $body = match ($this->action) {
            'submitted' => "{$actorName} submitted the forecast for job {$jobNumber} ({$forecastMonth}) for review.",
            'finalized' => "The forecast for job {$jobNumber} ({$forecastMonth}) has been finalized by {$actorName}.",
            'rejected' => "The forecast for job {$jobNumber} ({$forecastMonth}) was rejected by {$actorName}.",
            default => "The forecast for job {$jobNumber} ({$forecastMonth}) status was updated.",
        };

        return [
            'type' => 'JobForecastStatus',
            'action' => $this->action,
            'title' => $title,
            'body' => $body,
            'message' => $this->message,
            'forecast_id' => $this->forecast->id,
            'job_number' => $jobNumber,
            'forecast_month' => $this->forecast->forecast_month->format('Y-m'),
            'status' => $this->forecast->status,
            'actor_id' => $this->actor?->id,
            'actor_name' => $actorName,
            'location_id' => $locationId,
        ];
    }
}
