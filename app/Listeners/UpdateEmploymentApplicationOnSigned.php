<?php

namespace App\Listeners;

use App\Events\DocumentSigned;
use App\Models\EmploymentApplication;

class UpdateEmploymentApplicationOnSigned
{
    public function handle(DocumentSigned $event): void
    {
        $signingRequest = $event->signingRequest;

        if ($signingRequest->signable_type !== EmploymentApplication::class) {
            return;
        }

        $application = $signingRequest->signable;

        if (! $application) {
            return;
        }

        if ($application->status !== EmploymentApplication::STATUS_CONTRACT_SIGNED) {
            $application->update(['status' => EmploymentApplication::STATUS_CONTRACT_SIGNED]);
        }

        $application->addSystemComment(
            "Contract signed by {$signingRequest->signer_full_name}",
            ['type' => 'contract_signed', 'signing_request_id' => $signingRequest->id],
            $signingRequest->sent_by,
        );
    }
}
