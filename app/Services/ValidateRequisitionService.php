<?php

namespace App\Services;
class ValidateRequisitionService
{
    public function validateStatus($requisition)
    {
        if (!in_array($requisition->status, ['pending', 'failed'])) {
            return redirect()
                ->route('requisition.index')
                ->with('error', 'Requisition is not in pending status.');
        }
        return true; // or any other logic you want to implement
    }

    public function validateCostCodes($requisition)
    {
        $validCostCodes = $requisition->location->costCodes->pluck('code')->map(fn($c) => strtoupper($c))->toArray();
        $invalidCodes = collect();

        foreach ($requisition->lineItems as $item) {
            if (!in_array(strtoupper($item->cost_code), $validCostCodes)) {
                $invalidCodes->push($item->cost_code);
            }
        }

        if ($invalidCodes->isNotEmpty()) {
            $formatted = $invalidCodes->implode(', ');
            return redirect()
                ->route('requisition.show', $requisition->id)
                ->with('error', "Invalid cost code(s) found: {$formatted}. Check if they are active in Premier for this job. Sync cost codes after activating them.");
        }

        return true; // or any other logic you want to implement
    }
}