<?php

namespace App\Services;

use App\Models\CreditCardReceipt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ReceiptExtractionService
{
    private const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

    private const MODEL = 'gpt-4o-mini';

    private const PROMPT = <<<'PROMPT'
Analyze this receipt/invoice and extract ALL of the following 6 fields. You MUST include every field in your response. Return ONLY valid JSON with no markdown formatting or explanation.

IMPORTANT: If the invoice shows amounts in multiple currencies (e.g. USD charges with an AUD converted total), extract ALL amounts in the SAME single currency. The total_amount, gst_amount, and currency must all be consistent with each other.

{
  "merchant_name": "string - the business/store name on the receipt",
  "total_amount": "number - the final total amount charged. If multiple currencies shown, use the amount matching the currency field below",
  "gst_amount": "number or null - tax/GST amount in the same currency as total_amount",
  "currency": "string - REQUIRED - the 3-letter currency code. If the invoice shows charges in USD but a converted AUD total, use USD and the USD amount. Use the currency of the original charges, not the local conversion",
  "transaction_date": "string or null - the date in YYYY-MM-DD format if visible",
  "category": "string - REQUIRED - classify the purchase into exactly one of: fuel, materials, meals, travel, tools, office, other. Use 'fuel' for petrol/gas stations, 'materials' for building/construction supplies, 'meals' for restaurants/cafes/food, 'travel' for flights/hotels/accommodation/transport, 'tools' for equipment/hardware, 'office' for stationery/printing/office supplies, 'other' for anything else"
}
PROMPT;

    public function extract(CreditCardReceipt $receipt): array
    {
        $media = $receipt->getFirstMedia('receipts');

        if (! $media) {
            return ['success' => false, 'error' => 'No media file found for receipt'];
        }

        try {
            $contents = $this->getMediaContents($media);
            $mimeType = $media->mime_type;
            $base64 = base64_encode($contents);

            $fileContent = $mimeType === 'application/pdf'
                ? ['type' => 'input_file', 'filename' => $media->file_name, 'file_data' => "data:{$mimeType};base64,{$base64}"]
                : ['type' => 'input_image', 'image_url' => "data:{$mimeType};base64,{$base64}"];

            $input = [
                [
                    'role' => 'user',
                    'content' => [
                        ['type' => 'input_text', 'text' => self::PROMPT],
                        $fileContent,
                    ],
                ],
            ];

            $response = Http::withToken($this->getApiKey())
                ->timeout(60)
                ->post(self::OPENAI_API_URL, [
                    'model' => self::MODEL,
                    'input' => $input,
                ]);

            if ($response->failed()) {
                Log::error('Receipt extraction API failed', [
                    'receipt_id' => $receipt->id,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return ['success' => false, 'error' => 'OpenAI API request failed: '.$response->status()];
            }

            $data = $response->json();
            $text = $data['output'][0]['content'][0]['text'] ?? null;

            if (! $text) {
                return ['success' => false, 'error' => 'No text in API response'];
            }

            // Strip markdown code fences if present
            $text = preg_replace('/^```(?:json)?\s*/m', '', $text);
            $text = preg_replace('/\s*```$/m', '', $text);
            $text = trim($text);

            $extracted = json_decode($text, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                return [
                    'success' => false,
                    'error' => 'Failed to parse JSON response: '.json_last_error_msg(),
                    'raw' => $text,
                ];
            }

            return [
                'success' => true,
                'data' => $extracted,
                'raw' => $data,
            ];
        } catch (\Throwable $e) {
            Log::error('Receipt extraction failed', [
                'receipt_id' => $receipt->id,
                'error' => $e->getMessage(),
            ]);

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function getMediaContents($media): string
    {
        $disk = $media->disk;

        if ($disk === 's3') {
            return Storage::disk('s3')->get($media->getPathRelativeToRoot());
        }

        return file_get_contents($media->getPath());
    }

    private function getApiKey(): string
    {
        $key = config('services.openai.api_key') ?: env('OPENAI_API_KEY');

        if (! $key) {
            throw new \RuntimeException('OpenAI API key is not configured');
        }

        return $key;
    }
}
