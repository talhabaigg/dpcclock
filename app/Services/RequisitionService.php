<?php

namespace App\Services;

use App\Models\CostCode;
use App\Models\Location;
use Carbon\Carbon;
use Http;
use Log;
use Storage;

class RequisitionService
{
    public function sendExcelFileToSFTP($fileName)
    {
        $fileContent = Storage::disk('public')->get($fileName);
        $uploaded = Storage::disk('premier_sftp')->put("upload/{$fileName}", $fileContent);

        return $uploaded;
    }

    public function notifyRequisitionProcessed($requisition)
    {
        if (! $requisition->creator?->email) {
            return redirect()->route('requisition.index')->with('success', 'Creator email not found.');
        }

        $creatorEmail = $requisition->creator->email;
        $timestamp = now()->format('d/m/Y h:i A');
        $auth = auth()->user()->name;
        $messageBody = "Requisition #{$requisition->id} (PO number (PO{$requisition->po_number})) has been sent to Premier for Processing by {$auth}.";
        $response = Http::post(config('services.power_automate.notification_url'), [
            'user_email' => $creatorEmail,
            'requisition_id' => $requisition->id,
            'message' => $messageBody,
        ]);

        if ($response->failed()) {
            return redirect()->route('requisition.index')->with('error', 'Failed to send notification.');
        }

        $requisition->update([
            'status' => 'sent to premier',
            'processed_by' => auth()->id(),
        ]);

        if ($response->failed()) {
            return redirect()->route('requisition.index')->with('success', 'Failed to send notification.');
        }

        return redirect()->route('requisition.index')->with('success', 'Requisition processed and submitted successfully.');
    }

    public function generateRequisitionPayload($requisition, $companyCode)
    {
        $payload = [
            'Company' => $companyCode,
            'APSubledger' => 'AP',
            'PurchaseOrderNumber' => 'PO'.$requisition->po_number,
            'PurchaseOrderType' => 'PO',
            'Job' => $requisition->location?->external_id ?? 'N/A',
            'Memo' => $requisition->order_reference ?? '',
            'RequestedBy' => $requisition->requested_by ?? 'N/A',
            'PurchaseOrderDate' => now()->toDateString(),
            'RequiredDate' => isset($requisition->date_required) ? Carbon::parse($requisition->date_required)->format('Y-m-d') : now()->format('Y-m-d'),
            'PromisedDate' => isset($requisition->date_required)
                ? Carbon::parse($requisition->date_required)->format('Y-m-d')
                : now()->format('Y-m-d'),
            'BlanketExpiryDate' => null,
            'SendDate' => null,
            // "SendDate" => isset($requisition->date_required)
            //     ? Carbon::parse($requisition->date_required)->format('Y-m-d')
            //     : now()->format('Y-m-d'),
            'PurchaseOrderReference' => $requisition->order_reference ?? 'N/A',
            'Vendor' => $requisition->supplier?->code ?? 'N/A',
            'VendorReferenceNumber' => null,
            'ShipToType' => 'JOB',
            'ShipTo' => $requisition->location?->external_id ?? 'N/A',
            'ShipToAddress' => $requisition->location?->address ?? 'N/A',
            'Attention' => $requisition->delivery_contact ?? 'N/A',
            'FOBShipVia' => '',
            'PurchaseOrderLines' => $requisition->lineItems->map(function ($lineItem, $index) use ($companyCode) {
                $lineItemValue = $lineItem->code ? $lineItem->code.'-'.$lineItem->description : $lineItem->description;
                $costCode = CostCode::with('costType')->where('code', $lineItem->cost_code)->first();
                $costType = $costCode?->costType?->code ?? 'MAT';

                return [
                    'POLineNumber' => $index + 1,
                    'Item' => null,
                    'Description' => $lineItemValue,
                    'Quantity' => $lineItem->qty ?? 0,
                    'UnitOfMeasure' => ((float) $lineItem->qty != (int) $lineItem->qty) ? 'm' : 'EA',
                    'UnitCost' => $lineItem->unit_cost ?? 0,
                    'POLineCompany' => $companyCode,
                    'POLineDistributionType' => 'J',
                    'POLineJob' => $lineItem->requisition->location?->external_id ?? 'N/A',
                    'JobCostType' => $costType,
                    'JobCostItem' => $lineItem->cost_code ?? 'N/A',
                    'JobCostDepartment' => null,
                    'JobCostLocation' => null,
                    'InventorySubledger' => null,
                    'Warehouse' => null,
                    'WarehouseLocation' => null,
                    'GLAccount' => null,
                    'GLSubAccount' => null,
                    'Division' => null,
                    'TaxGroup' => 'GST',
                    'Discount' => 0,
                    'DiscountPercent' => 0,
                    'DateRequired' => isset($lineItem->date_required) ? Carbon::parse($lineItem->date_required)->format('Y-m-d') : now()->format('Y-m-d'),
                    'PromisedDate' => isset($lineItem->date_required) ? Carbon::parse($lineItem->date_required)->format('Y-m-d') : now()->format('Y-m-d'),
                ];
            })->toArray(),
        ];

        return $payload;

    }

    public function sendRequisitionToPremierViaAPI($requisition, $payload)
    {
        $authService = new PremierAuthenticationService;
        $token = $authService->getAccessToken();
        $base_url = config('premier.swagger_api.base_url');
        Log::info($payload);

        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(60)
                ->post($base_url.'/api/PurchaseOrder/CreatePurchaseOrder', $payload);
        } catch (\Exception $e) {
            Log::error("Premier API exception for Requisition #{$requisition->id}", [
                'error' => $e->getMessage(),
            ]);
            $requisition->status = 'failed';
            $requisition->save();

            return redirect()->route('requisition.show', $requisition->id)->with('error', 'Premier API request timed out or failed to connect. Please check if the order was created in Premier before retrying.');
        }

        $poid = $response->json('Data.0.POID') ?? null;
        Log::info("Premier API Response for Requisition #{$requisition->id}", [
            'status' => $response->status(),
            'poid' => $poid,
            'body' => $response->body(),
        ]);

        // If we got a POID back, the order was created — treat as success regardless of HTTP status
        if ($poid) {
            $requisition->status = 'success';
            $requisition->premier_po_id = $poid;
            $requisition->processed_by = auth()->id();
            $requisition->save();
            activity()
                ->performedOn($requisition)
                ->event('api request successful')
                ->causedBy(auth()->user())
                ->log("Requisition #{$requisition->id} API request successful. POID: {$poid}");

            if ($response->failed()) {
                Log::warning("Premier returned HTTP {$response->status()} but PO was created with POID: {$poid}", [
                    'requisition_id' => $requisition->id,
                    'body' => $response->body(),
                ]);
            }
        } elseif ($response->failed()) {
            $requisition->status = 'failed';
            $requisition->save();
            activity()
                ->performedOn($requisition)
                ->event('api request failed')
                ->causedBy(auth()->user())
                ->log("Requisition #{$requisition->id} API request failed (HTTP {$response->status()}): ".$response->body());

            return redirect()->route('requisition.show', $requisition->id)->with('error', 'Failed to send API request to Premier (HTTP '.$response->status().'). '.$response->body());
        } else {
            // 2xx but no POID — unexpected
            Log::warning("Premier returned success but no POID for Requisition #{$requisition->id}", [
                'body' => $response->body(),
            ]);
            $requisition->status = 'success';
            $requisition->processed_by = auth()->id();
            $requisition->save();
        }

        // Send notification (only if PO was created)
        if ($requisition->status === 'success') {
            $creator = $requisition->creator;
            $creatorEmail = $creator->email ?? null;
            if (! $creatorEmail) {
                return redirect()->route('requisition.index')->with('success', 'PO created in Premier successfully. Creator email not found for notification.');
            }

            $auth = auth()->user()->name;
            $messageBody = "Requisition #{$requisition->id} (PO number (PO{$requisition->po_number})) has been sent to Premier for Processing by {$auth}.";
            $notificationResponse = Http::timeout(15)->post(config('services.power_automate.notification_url'), [
                'user_email' => $creatorEmail,
                'requisition_id' => $requisition->id,
                'message' => $messageBody,
            ]);

            if ($notificationResponse->failed()) {
                Log::warning("Notification failed for Requisition #{$requisition->id}", [
                    'status' => $notificationResponse->status(),
                ]);

                return redirect()->route('requisition.index')->with('success', 'PO created in Premier successfully. Notification failed to send.');
            }

            return redirect()->route('requisition.index')->with('success', 'Requisition processed and submitted successfully.');
        }

        return redirect()->route('requisition.show', $requisition->id)->with('error', 'Unexpected response from Premier.');
    }

    public function loadPurchaseOrderIdsForLocation($locationId)
    {
        $authService = new PremierAuthenticationService;
        $token = $authService->getAccessToken();
        $base_url = config('premier.swagger_api.base_url');
        $companyService = new GetCompanyCodeService;
        $location = Location::findOrFail($locationId);
        $companyId = '3341c7c6-2abb-49e1-8a59-839d1bcff972';
        $response = Http::withToken($token)
            ->acceptJson()
            ->get("{$base_url}/api/PurchaseOrder/GetPurchaseOrders", [
                'companyId' => $companyId,
                'pageSize' => 1000,

            ]);

        Log::info('Premier API Response: '.$response->body());

        return $response;
    }
}
