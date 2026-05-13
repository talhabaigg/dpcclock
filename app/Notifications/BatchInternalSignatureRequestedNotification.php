<?php

namespace App\Notifications;

use App\Models\SigningRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

/**
 * Sends a single email to the internal signer listing every document in a batch
 * that's awaiting their signature.
 */
class BatchInternalSignatureRequestedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  Collection<int, SigningRequest>  $signingRequests
     */
    public function __construct(
        private Collection $signingRequests,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['mail', 'database'];

        if ($notifiable->pushSubscriptions()->exists()) {
            $channels[] = WebPushChannel::class;
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $first = $this->signingRequests->first();
        $admin = $first?->sentBy;
        $count = $this->signingRequests->count();
        $recipientName = $first?->recipient_name ?? 'the recipient';

        $subject = $count === 1
            ? "Signature requested: {$this->labelFor($first)}"
            : "Signature requested on {$count} documents for {$recipientName}";

        $message = (new MailMessage)
            ->subject($subject)
            ->greeting("Hi {$notifiable->name},");

        if ($count === 1 && $first) {
            $message
                ->line("{$admin?->name} has requested your signature on **{$this->labelFor($first)}** before it is sent to {$recipientName}.")
                ->action('Review & Sign', $first->getInternalSigningUrl());
        } else {
            $message->line("{$admin?->name} has requested your signature on the following documents before they are sent to {$recipientName}:");
            foreach ($this->signingRequests as $sr) {
                $message->line('- **' . $this->labelFor($sr) . '**');
            }
            // Action points to the first request — its sign page handles the whole batch.
            if ($first) {
                $message->action('Review & Sign All', $first->getInternalSigningUrl());
            }
        }

        $message->line('Once you sign, the documents will be automatically sent to the recipient.');

        return $message;
    }

    public function toWebPush(object $notifiable, $notification): WebPushMessage
    {
        $data = $this->toArray($notifiable);

        return (new WebPushMessage)
            ->title($data['title'])
            ->body($data['body'])
            ->icon('/icon-192x192.png')
            ->badge('/icon-192x192.png')
            ->tag('internal-sign-batch-' . ($this->signingRequests->first()?->batch_id ?? 'unknown'))
            ->options(['TTL' => 86400]);
    }

    public function toArray(object $notifiable): array
    {
        $first = $this->signingRequests->first();
        $count = $this->signingRequests->count();
        $recipientName = $first?->recipient_name ?? 'a recipient';

        $body = $count === 1 && $first
            ? "Your signature is needed on \"{$this->labelFor($first)}\" before it can be sent to {$recipientName}."
            : "Your signature is needed on {$count} documents before they can be sent to {$recipientName}.";

        return [
            'type' => 'InternalSignatureRequested',
            'title' => 'Signature requested',
            'body' => $body,
            'signing_request_id' => $first?->id,
            'url' => $first?->getInternalSigningUrl(),
        ];
    }

    private function labelFor(SigningRequest $sr): string
    {
        return $sr->documentTemplate?->name ?? $sr->document_title ?? 'Document';
    }
}
