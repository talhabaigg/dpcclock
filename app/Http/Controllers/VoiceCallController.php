<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class VoiceCallController extends Controller
{
    /**
     * Create an ephemeral token for the OpenAI Realtime API
     * This allows secure browser-to-OpenAI WebSocket connections
     */
    public function createSession(Request $request)
    {
        try {
            $apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: env('VITE_OPEN_AI_API_KEY');

            if (!$apiKey) {
                return response()->json(['error' => 'OpenAI API key is not configured'], 500);
            }

            // Create ephemeral token via OpenAI Realtime sessions endpoint
            $response = Http::withToken($apiKey)
                ->timeout(30)
                ->post('https://api.openai.com/v1/realtime/sessions', [
                    'model' => 'gpt-4o-mini-realtime-preview-2024-12-17',
                    'voice' => 'alloy',
                    'instructions' => $this->getVoiceInstructions(),
                    'tools' => $this->getRealtimeTools(),
                    'tool_choice' => 'auto',
                    'input_audio_transcription' => [
                        'model' => 'whisper-1',
                    ],
                    'turn_detection' => [
                        'type' => 'server_vad',
                        'threshold' => 0.5,
                        'prefix_padding_ms' => 300,
                        'silence_duration_ms' => 500,
                    ],
                ]);

            if ($response->failed()) {
                Log::error('Failed to create Realtime session', [
                    'status' => $response->status(),
                    'body' => $response->json(),
                ]);
                return response()->json([
                    'error' => 'Failed to create voice session',
                    'details' => $response->json(),
                ], $response->status());
            }

            $data = $response->json();

            Log::info('Realtime session created', ['response' => $data]);

            return response()->json([
                'client_secret' => $data['client_secret'] ?? null,
                'session_id' => $data['id'] ?? null,
                'expires_at' => $data['expires_at'] ?? null,
                // Include full response for debugging
                'debug' => app()->isProduction() ? null : $data,
            ]);
        } catch (\Throwable $e) {
            Log::error('Voice session creation error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Failed to create voice session',
                'message' => app()->isProduction() ? 'Please try again later' : $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Execute a tool call from the Realtime API
     * This endpoint is called by the frontend when the AI requests a function call
     */
    public function executeTool(Request $request)
    {
        $validated = $request->validate([
            'tool_name' => 'required|string',
            'arguments' => 'required|array',
            'call_id' => 'required|string',
        ]);

        try {
            $result = $this->executeToolCall($validated['tool_name'], $validated['arguments']);

            return response()->json([
                'call_id' => $validated['call_id'],
                'output' => $result,
            ]);
        } catch (\Throwable $e) {
            Log::error('Voice tool execution error', [
                'tool' => $validated['tool_name'],
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'call_id' => $validated['call_id'],
                'output' => json_encode(['error' => 'Tool execution failed: ' . $e->getMessage()]),
            ], 500);
        }
    }

    /**
     * Get voice-specific instructions
     */
    private function getVoiceInstructions(): string
    {
        return <<<'INSTRUCTIONS'
You are Superior AI, a helpful voice assistant for the Superior Portal application.

## Voice Interaction Guidelines
- Keep responses concise and conversational - you're speaking, not writing
- Use natural speech patterns and avoid overly technical jargon
- Summarize data rather than listing every detail
- For long lists, mention the total count and highlight the most relevant items
- Confirm actions before executing them when appropriate
- If you need to read numbers, say them naturally (e.g., "twenty-five hundred" instead of "two thousand five hundred")

## Tool Usage
You have access to database tools for:
- Searching and reading requisitions/orders
- Looking up materials and pricing
- Finding locations and suppliers
- Creating new requisitions

When a user asks about specific data, use the appropriate tool. After getting results:
- Summarize the key information verbally
- Mention totals and important details
- Ask if they want more details about specific items

## Creating Orders via Voice
When helping create an order:
1. Confirm the location and supplier
2. Help them add items one by one
3. Read back the order summary before creating
4. Confirm the total cost
INSTRUCTIONS;
    }

    /**
     * Get tools configured for Realtime API format
     * Realtime API uses a slightly different format than the Responses API
     */
    private function getRealtimeTools(): array
    {
        return [
            [
                'type' => 'function',
                'name' => 'read_requisition',
                'description' => 'Look up a requisition by ID to get details including status, items, and costs.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'requisition_id' => [
                            'type' => 'integer',
                            'description' => 'The numeric ID of the requisition',
                        ],
                    ],
                    'required' => ['requisition_id'],
                ],
            ],
            [
                'type' => 'function',
                'name' => 'search_requisitions',
                'description' => 'Search for requisitions by status, location, supplier, PO number, or date range.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'status' => [
                            'type' => 'string',
                            'description' => 'Filter by status: pending, processed, failed',
                        ],
                        'location_id' => [
                            'type' => 'integer',
                            'description' => 'Filter by location/project ID',
                        ],
                        'supplier_id' => [
                            'type' => 'integer',
                            'description' => 'Filter by supplier ID',
                        ],
                        'po_number' => [
                            'type' => 'string',
                            'description' => 'Filter by PO number (partial match)',
                        ],
                        'date_from' => [
                            'type' => 'string',
                            'description' => 'Start date (YYYY-MM-DD)',
                        ],
                        'date_to' => [
                            'type' => 'string',
                            'description' => 'End date (YYYY-MM-DD)',
                        ],
                        'search' => [
                            'type' => 'string',
                            'description' => 'Search term for PO, reference, or requestor',
                        ],
                        'limit' => [
                            'type' => 'integer',
                            'description' => 'Max results (default 10)',
                        ],
                    ],
                    'required' => [],
                ],
            ],
            [
                'type' => 'function',
                'name' => 'get_requisition_stats',
                'description' => 'Get statistics about requisitions for a date range.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'date_from' => [
                            'type' => 'string',
                            'description' => 'Start date (YYYY-MM-DD)',
                        ],
                        'date_to' => [
                            'type' => 'string',
                            'description' => 'End date (YYYY-MM-DD)',
                        ],
                        'location_id' => [
                            'type' => 'integer',
                            'description' => 'Filter by location',
                        ],
                    ],
                    'required' => [],
                ],
            ],
            [
                'type' => 'function',
                'name' => 'list_locations',
                'description' => 'List available locations/projects.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'search' => [
                            'type' => 'string',
                            'description' => 'Search term to filter locations',
                        ],
                    ],
                    'required' => [],
                ],
            ],
            [
                'type' => 'function',
                'name' => 'list_suppliers',
                'description' => 'List available suppliers.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'search' => [
                            'type' => 'string',
                            'description' => 'Search term to filter suppliers',
                        ],
                    ],
                    'required' => [],
                ],
            ],
            [
                'type' => 'function',
                'name' => 'search_materials',
                'description' => 'Search for material items by code or description.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'search' => [
                            'type' => 'string',
                            'description' => 'Search term',
                        ],
                        'location_id' => [
                            'type' => 'integer',
                            'description' => 'Location for pricing',
                        ],
                        'supplier_id' => [
                            'type' => 'integer',
                            'description' => 'Filter by supplier',
                        ],
                        'limit' => [
                            'type' => 'integer',
                            'description' => 'Max results',
                        ],
                    ],
                    'required' => [],
                ],
            ],
            [
                'type' => 'function',
                'name' => 'create_requisition',
                'description' => 'Create a new requisition/order with line items.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'location_id' => [
                            'type' => 'integer',
                            'description' => 'Location/project ID',
                        ],
                        'supplier_id' => [
                            'type' => 'integer',
                            'description' => 'Supplier ID',
                        ],
                        'date_required' => [
                            'type' => 'string',
                            'description' => 'Required date (YYYY-MM-DD)',
                        ],
                        'requested_by' => [
                            'type' => 'string',
                            'description' => 'Requestor name',
                        ],
                        'items' => [
                            'type' => 'array',
                            'description' => 'Line items to add',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'code' => ['type' => 'string', 'description' => 'Material code'],
                                    'description' => ['type' => 'string', 'description' => 'Item description'],
                                    'qty' => ['type' => 'number', 'description' => 'Quantity'],
                                    'unit_cost' => ['type' => 'number', 'description' => 'Unit cost'],
                                ],
                                'required' => ['qty'],
                            ],
                        ],
                    ],
                    'required' => ['location_id', 'supplier_id', 'items'],
                ],
            ],
        ];
    }

    /**
     * Execute a tool call - delegates to ChatController's tool methods
     */
    private function executeToolCall(string $name, array $arguments): string
    {
        // Instantiate ChatController to reuse its tool methods
        $chatController = app(ChatController::class);

        // Use reflection to call the private executeToolCall method
        $reflection = new \ReflectionClass($chatController);
        $method = $reflection->getMethod('executeToolCall');
        $method->setAccessible(true);

        return $method->invoke($chatController, $name, $arguments);
    }
}
