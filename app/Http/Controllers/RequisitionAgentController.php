<?php

namespace App\Http\Controllers;

use App\Ai\Agents\RequisitionAgent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Enums\Lab;

class RequisitionAgentController extends Controller
{
    /**
     * Available models for the frontend dropdown.
     */
    private const MODELS = [
        ['id' => 'gpt-4.1-mini', 'name' => 'GPT-4.1 Mini', 'provider' => 'openai', 'cost' => '$'],
        ['id' => 'gpt-4o-mini', 'name' => 'GPT-4o Mini', 'provider' => 'openai', 'cost' => '$'],
        ['id' => 'claude-haiku-4-5-20251001', 'name' => 'Claude Haiku 4.5', 'provider' => 'anthropic', 'cost' => '$'],
        ['id' => 'gpt-4.1', 'name' => 'GPT-4.1', 'provider' => 'openai', 'cost' => '$$'],
        ['id' => 'gpt-4o', 'name' => 'GPT-4o', 'provider' => 'openai', 'cost' => '$$'],
        ['id' => 'claude-sonnet-4-6', 'name' => 'Claude Sonnet 4.6', 'provider' => 'anthropic', 'cost' => '$$'],
        ['id' => 'claude-sonnet-4-5-20250929', 'name' => 'Claude Sonnet 4.5', 'provider' => 'anthropic', 'cost' => '$$'],
        ['id' => 'claude-opus-4-6', 'name' => 'Claude Opus 4.6', 'provider' => 'anthropic', 'cost' => '$$$'],
    ];

    private const DEFAULT_MODEL = 'gpt-4.1-mini';

    /**
     * GET /api/requisition-agent/models
     */
    public function models(): JsonResponse
    {
        return response()->json([
            'models' => self::MODELS,
            'default' => self::DEFAULT_MODEL,
        ]);
    }

    /**
     * POST /api/requisition-agent/chat
     * Non-streaming chat endpoint.
     */
    public function chat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|max:10000',
            'conversation_id' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:50',
        ]);

        $agent = new RequisitionAgent;
        [$provider, $model] = $this->resolveModel($validated['model'] ?? null);

        if (! empty($validated['conversation_id'])) {
            $agent = $agent->continue($validated['conversation_id'], as: auth()->user());
        } else {
            $agent = $agent->forUser(auth()->user());
        }

        $response = $agent->prompt(
            $validated['message'],
            provider: $provider,
            model: $model,
        );

        $displayableTools = ['SearchLocations', 'ListSuppliers', 'SearchMaterials', 'UpdateRequisitionDraft'];
        $toolResults = $response->toolResults
            ->filter(fn ($tr) => in_array($tr->name, $displayableTools))
            ->map(fn ($tr) => [
                'tool_name' => $tr->name,
                'result' => json_decode($tr->result, true),
            ])->values();

        return response()->json([
            'reply' => (string) $response,
            'conversation_id' => $response->conversationId,
            'model' => $model,
            'tool_results' => $toolResults,
        ]);
    }

    /**
     * POST /api/requisition-agent/stream
     * SSE streaming chat endpoint.
     */
    public function stream(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:10000',
            'conversation_id' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:50',
        ]);

        $agent = new RequisitionAgent;
        [$provider, $model] = $this->resolveModel($validated['model'] ?? null);

        if (! empty($validated['conversation_id'])) {
            $agent = $agent->continue($validated['conversation_id'], as: auth()->user());
        } else {
            $agent = $agent->forUser(auth()->user());
        }

        return $agent->stream(
            $validated['message'],
            provider: $provider,
            model: $model,
        );
    }

    /**
     * POST /api/requisition-agent/extract-file
     * Extract text/line items from uploaded PDF or image using OpenAI file/image input.
     */
    public function extractFile(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:jpg,jpeg,png,pdf,webp|max:10240',
        ]);

        $file = $request->file('file');
        $mimeType = $file->getMimeType();
        $extension = strtolower($file->getClientOriginalExtension());
        $originalName = $file->getClientOriginalName();
        $normalizedFilename = pathinfo($originalName, PATHINFO_FILENAME);
        if ($extension !== '') {
            $normalizedFilename .= '.'.$extension;
        }

        try {
            $apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY');
            $extractionPrompt = <<<'EXTRACTION'
Extract all line items from this supplier quotation/invoice/order document.

Return a JSON object with:
{
  "supplier_name": "detected supplier name or null",
  "project_name": "detected project/job name or null",
  "items": [
    {
      "code": "item code if visible",
      "description": "item description (include size/length/spec in description, NOT in qty)",
      "qty": number,
      "unit_cost": number,
      "line_total": number,
      "ambiguous": false
    }
  ],
  "grand_total": number or null,
  "notes": "any other relevant info"
}

CRITICAL RULES for qty and unit_cost:
- qty is the NUMBER OF UNITS being ordered (e.g. 42 panels, 100 tracks). It is NOT a length or measurement.
- unit_cost is the PRICE PER SINGLE UNIT (e.g. price per panel, price per track).
- If the document has columns like "Length", "Size", "UOM" (unit of measure) — these describe the product spec, NOT the order quantity. Include them in the description field.
- If you cannot confidently determine which value is qty vs unit_cost vs length/size, set "ambiguous": true and include all candidate values in the description so the user can clarify.
- Prioritise ex-GST pricing over incl-GST where both are available.

CRITICAL RULES for totals and rounding:
- line_total MUST be copied exactly as shown in the document — do NOT recalculate it. The document's line total is the source of truth.
- unit_cost MUST be copied exactly as shown in the document — do NOT round or truncate.
- If qty * unit_cost does not exactly equal the line_total shown in the document, adjust qty slightly so that qty * unit_cost = line_total to the cent. The line_total from the document always wins.
- grand_total MUST be copied exactly as shown in the document (ex-GST subtotal). The sum of all line_total values should equal grand_total. If it does not, flag the discrepancy in notes.
- NEVER round unit_cost or line_total. Preserve exact decimal values from the document.

Return ONLY valid JSON - no markdown fences, no explanation.
EXTRACTION;
            $base64 = base64_encode(file_get_contents($file->getRealPath()));

            $fileInput = $extension === 'pdf'
                ? [
                    'type' => 'input_file',
                    'filename' => $normalizedFilename,
                    'file_data' => "data:{$mimeType};base64,{$base64}",
                ]
                : [
                    'type' => 'input_image',
                    'image_url' => "data:{$mimeType};base64,{$base64}",
                ];

            $response = Http::withToken($apiKey)
                ->timeout($extension === 'pdf' ? 120 : 60)
                ->post('https://api.openai.com/v1/responses', [
                    'model' => 'gpt-4o',
                    'input' => [
                        [
                            'role' => 'user',
                            'content' => [
                                [
                                    'type' => 'input_text',
                                    'text' => $extractionPrompt,
                                ],
                                $fileInput,
                            ],
                        ],
                    ],
                ]);

            if (! $response->successful()) {
                Log::error('OpenAI Responses API failed for requisition file extraction', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'mime_type' => $mimeType,
                    'extension' => $extension,
                ]);

                throw new \RuntimeException('OpenAI API error: '.$response->status().' - '.$response->json('error.message', 'Unknown error'));
            }

            $content = collect($response->json('output', []))
                ->where('type', 'message')
                ->pluck('content')
                ->flatten(1)
                ->where('type', 'output_text')
                ->pluck('text')
                ->implode('');

            $content = trim($content);
            $content = preg_replace('/^```(?:json)?\s*/', '', $content);
            $content = preg_replace('/\s*```$/', '', $content);

            $parsed = json_decode($content, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                Log::warning('File extraction returned non-JSON', ['raw' => substr($content, 0, 500)]);

                return response()->json([
                    'error' => 'Failed to parse extracted data. The AI response was not valid JSON.',
                    'raw' => substr($content, 0, 500),
                ], 422);
            }

            return response()->json([
                'success' => true,
                'extracted' => $parsed,
            ]);
        } catch (\Throwable $e) {
            Log::error('File extraction failed', ['error' => $e->getMessage()]);

            return response()->json([
                'error' => 'Failed to extract data from file: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Resolve a model ID to a [provider, model] tuple.
     *
     * @return array{0: Lab, 1: string}
     */
    private function resolveModel(?string $modelId): array
    {
        $modelId = $modelId ?: self::DEFAULT_MODEL;

        $provider = str_starts_with($modelId, 'claude')
            ? Lab::Anthropic
            : Lab::OpenAI;

        return [$provider, $modelId];
    }
}
