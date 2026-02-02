<?php

namespace App\Notifications;

use App\Models\Requisition;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class RequisitionSentToOfficeNotification extends Notification
{
    use Queueable;

    protected Requisition $requisition;
    protected ?User $sender;

    /**
     * Create a new notification instance.
     *
     * @param Requisition $requisition The requisition sent to office
     * @param User|null $sender The user who sent it to office
     */
    public function __construct(Requisition $requisition, ?User $sender = null)
    {
        $this->requisition = $requisition;
        $this->sender = $sender;
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

        return (new WebPushMessage)
            ->title($data['title'])
            ->body($data['body'])
            ->icon('/icon-192x192.png')
            ->badge('/icon-192x192.png')
            ->tag('requisition-office-' . $this->requisition->id)
            ->data(['url' => route('requisition.show', $this->requisition->id)])
            ->options(['TTL' => 86400]); // 24 hours
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray(object $notifiable): array
    {
        $senderName = $this->sender?->name ?? 'A user';
        $locationName = $this->requisition->location?->name ?? 'Unknown Location';
        $supplierName = $this->requisition->supplier?->name ?? 'Unknown Supplier';
        $totalCost = number_format($this->requisition->lineItems->sum('total_cost'), 2);

        return [
            'type' => 'RequisitionSentToOffice',
            'title' => 'Requisition Needs Review',
            'body' => "{$senderName} sent requisition #{$this->requisition->id} for {$locationName} to office for review. Total: \${$totalCost}",
            'requisition_id' => $this->requisition->id,
            'location_name' => $locationName,
            'supplier_name' => $supplierName,
            'total_cost' => $totalCost,
            'sender_id' => $this->sender?->id,
            'sender_name' => $senderName,
        ];
    }
}
