<?php

namespace App\Notifications;

use App\Models\FormRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class FormRequestNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private FormRequest $formRequest,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $formName = $this->formRequest->formTemplate?->name ?? 'Form';

        return (new MailMessage)
            ->subject("Please complete: {$formName}")
            ->greeting("Hi {$this->formRequest->recipient_name},")
            ->line("You have a form to complete: **{$formName}**.")
            ->line('Please click the button below to fill out the form.')
            ->action('Complete Form', $this->formRequest->getFormUrl())
            ->line('This link will expire in 7 days.')
            ->line('If you did not expect this form, please disregard this email.');
    }
}
