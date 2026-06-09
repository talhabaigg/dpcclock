<?php

namespace App\Http\Controllers;

use App\Models\SigningRequest;
use App\Services\SigningBatchLinkService;

class SigningBatchController extends Controller
{
    public function __construct(
        private SigningBatchLinkService $batchLinks,
    ) {}

    public function show(string $token)
    {
        $ids = $this->batchLinks->resolve($token);

        if (! $ids) {
            return view('signing.expired', [
                'message' => 'This link has expired',
            ]);
        }

        $requests = SigningRequest::query()
            ->whereIn('id', $ids)
            ->with(['documentTemplate', 'sentBy'])
            ->whereNotIn('status', ['cancelled', 'draft'])
            ->get()
            ->sortBy(fn ($sr) => [$sr->status === 'signed' ? 1 : 0, $sr->created_at?->timestamp ?? 0])
            ->values();

        if ($requests->isEmpty()) {
            return view('signing.expired', [
                'message' => 'These documents are no longer available',
            ]);
        }

        $first = $requests->first();
        $recipientName = $first->recipient_name ?: 'there';
        $senderName = $first->sentBy?->name ?? 'Your employer';

        $pendingCount = $requests->reject(fn ($sr) => $sr->status === 'signed')->count();
        $signedCount = $requests->where('status', 'signed')->count();

        $cmsEntityId = (int) config('services.employment_hero.cms_entity_id');
        $signable = $first->signable;
        $isCms = $signable instanceof \App\Models\Employee && (int) $signable->employing_entity_id === $cmsEntityId;
        $logoPath = $isCms ? 'logo-cms.png' : 'logo.png';
        $brandLabel = $isCms ? 'CMS' : 'DPC';

        return view('signing.batch', [
            'requests' => $requests,
            'recipientName' => $recipientName,
            'senderName' => $senderName,
            'pendingCount' => $pendingCount,
            'signedCount' => $signedCount,
            'logoPath' => $logoPath,
            'brandLabel' => $brandLabel,
        ]);
    }
}
