<?php

namespace App\Services;

use App\Models\Location;
use DB;

class GeneratePONumberService
{
    public function generate($requisition)
    {
        return DB::transaction(function () use ($requisition) {
            $parentId = Location::where('id', $requisition->project_number)->value('eh_parent_id');
            $companyService = new GetCompanyCodeService;
            $companyCode = $companyService->getCompanyCode($parentId);
            $sequence = DB::table('po_num_sequence')->lockForUpdate()->where('company_code', $companyCode)->first();

            // Build formatted PO number
            $poNumber = str_pad($sequence->next_po_number, 6, '0', STR_PAD_LEFT);

            // Assign and save
            $requisition->po_number = $poNumber;
            $requisition->status = 'processed';
            $requisition->save();

            // Increment the sequence
            DB::table('po_num_sequence')->where('company_code', $companyCode)->update([
                'next_po_number' => $sequence->next_po_number + 1,
            ]);

            return $poNumber; // ✅ Make sure to return the PO number
        });
    }
}
