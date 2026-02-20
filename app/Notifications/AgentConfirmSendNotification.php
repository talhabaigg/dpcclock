<?php

namespace App\Notifications;

use App\Models\AgentTask;
use App\Models\Requisition;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class AgentConfirmSendNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected AgentTask $task,
        protected Requisition $requisition
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];

        if ($notifiable->pushSubscriptions()->exists()) {
            $channels[] = WebPushChannel::class;
        }

        return $channels;
    }

    public function toWebPush(object $notifiable, $notification): WebPushMessage
    {
        $data = $this->toArray($notifiable);

        return (new WebPushMessage)
            ->title($data['title'])
            ->body($data['body'])
            ->icon('/icon-192x192.png')
            ->badge('/icon-192x192.png')
            ->tag('agent-send-'.$this->requisition->id)
            ->data(['url' => route('requisition.show', $this->requisition->id)])
            ->options(['TTL' => 86400]);
    }

    public function toArray(object $notifiable): array
    {
        $supplierName = $this->requisition->supplier?->name ?? 'Unknown Supplier';
        $locationName = $this->requisition->location?->name ?? 'Unknown Location';
        $poNumber = 'PO'.$this->requisition->po_number;
        $totalCost = number_format($this->requisition->lineItems->sum('total_cost'), 2);

        return [
            'type' => 'AgentConfirmSend',
            'title' => 'PO Ready to Send',
            'body' => "{$poNumber} for {$supplierName} ({$locationName}) — \${$totalCost}. Confirm to send to supplier.",
            'requisition_id' => $this->requisition->id,
            'agent_task_id' => $this->task->id,
            'po_number' => $poNumber,
            'supplier_name' => $supplierName,
            'location_name' => $locationName,
            'total_cost' => $totalCost,
        ];
    }
}
