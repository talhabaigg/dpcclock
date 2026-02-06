<?php

namespace App\Notifications;

use App\Models\LabourForecast;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class LabourForecastStatusNotification extends Notification
{
    use Queueable;

    protected LabourForecast $forecast;

    protected string $action;

    protected ?User $actor;

    protected ?string $message;

    /**
     * Create a new notification instance.
     *
     * @param  LabourForecast  $forecast  The forecast that changed
     * @param  string  $action  The action taken (submitted, approved, rejected)
     * @param  User|null  $actor  The user who performed the action
     * @param  string|null  $message  Optional message (e.g., rejection reason)
     */
    public function __construct(
        LabourForecast $forecast,
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

        $url = route('labour-forecast.show', ['location' => $this->forecast->location_id]);

        return (new WebPushMessage)
            ->title($data['title'])
            ->body($data['body'])
            ->icon('/icon-192x192.png')
            ->badge('/icon-192x192.png')
            ->tag('labour-forecast-'.$this->forecast->id)
            ->data(['url' => $url])
            ->options(['TTL' => 86400]); // 24 hours
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray(object $notifiable): array
    {
        $location = $this->forecast->location;
        $locationName = $location?->name ?? 'Unknown Location';
        $jobNumber = $location?->external_id ?? 'N/A';
        $forecastMonth = $this->forecast->forecast_month->format('M Y');
        $actorName = $this->actor?->name ?? 'System';

        $title = match ($this->action) {
            'submitted' => 'Labour Forecast Submitted',
            'approved' => 'Labour Forecast Approved',
            'rejected' => 'Labour Forecast Rejected',
            default => 'Labour Forecast Updated',
        };

        $body = match ($this->action) {
            'submitted' => "{$actorName} submitted the labour forecast for {$locationName} ({$forecastMonth}) for approval.",
            'approved' => "The labour forecast for {$locationName} ({$forecastMonth}) has been approved by {$actorName}.",
            'rejected' => "The labour forecast for {$locationName} ({$forecastMonth}) was rejected by {$actorName}.",
            default => "The labour forecast for {$locationName} ({$forecastMonth}) was updated.",
        };

        return [
            'type' => 'LabourForecastStatus',
            'action' => $this->action,
            'title' => $title,
            'body' => $body,
            'message' => $this->message,
            'forecast_id' => $this->forecast->id,
            'location_id' => $this->forecast->location_id,
            'location_name' => $locationName,
            'job_number' => $jobNumber,
            'forecast_month' => $this->forecast->forecast_month->format('Y-m'),
            'status' => $this->forecast->status,
            'actor_id' => $this->actor?->id,
            'actor_name' => $actorName,
        ];
    }
}
