<?php

namespace App\Http\Controllers;

use App\Models\VoiceCallSession;
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

            // Voice options: alloy, ash, ballad, coral, echo, sage, shimmer, verse
            // Male voices: ash (calm), echo (warm/deep), verse (dynamic)
            // Female voices: alloy, ballad, coral, sage, shimmer
            $voice = $request->input('voice', 'echo'); // Default to echo - warm male voice

            // Create ephemeral token via OpenAI Realtime sessions endpoint
            $response = Http::withToken($apiKey)
                ->timeout(30)
                ->post('https://api.openai.com/v1/realtime/sessions', [
                    'model' => 'gpt-4o-mini-realtime-preview-2024-12-17',
                    'voice' => $voice,
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

            // Track the voice call session
            $voiceSession = VoiceCallSession::create([
                'user_id' => $request->user()->id,
                'session_id' => $data['id'] ?? null,
                'started_at' => now(),
                'status' => 'active',
                'metadata' => [
                    'voice' => $voice,
                    'model' => 'gpt-4o-mini-realtime-preview-2024-12-17',
                ],
            ]);

            return response()->json([
                'client_secret' => $data['client_secret'] ?? null,
                'session_id' => $data['id'] ?? null,
                'expires_at' => $data['expires_at'] ?? null,
                'voice_session_id' => $voiceSession->id,
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
     * End a voice call session
     * Called by the frontend when the call ends
     */
    public function endSession(Request $request)
    {
        $validated = $request->validate([
            'voice_session_id' => 'required|integer',
        ]);

        try {
            $session = VoiceCallSession::where('id', $validated['voice_session_id'])
                ->where('user_id', $request->user()->id)
                ->where('status', 'active')
                ->first();

            if (!$session) {
                return response()->json(['error' => 'Session not found or already ended'], 404);
            }

            $session->end();

            Log::info('Voice session ended', [
                'session_id' => $session->id,
                'duration_seconds' => $session->duration_seconds,
                'estimated_cost' => $session->estimated_cost,
            ]);

            return response()->json([
                'success' => true,
                'duration_seconds' => $session->duration_seconds,
                'duration_minutes' => $session->duration_minutes,
                'estimated_cost' => $session->estimated_cost,
            ]);
        } catch (\Throwable $e) {
            Log::error('Voice session end error', [
                'message' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Failed to end session'], 500);
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
You are Superior AI, a friendly male voice assistant for the Superior Portal - a construction project management system based in Queensland, Australia.

## Australian Personality & Accent
- You're a friendly Aussie bloke from Queensland - warm, laid-back but professional
- Speak with Australian English patterns and expressions
- IMPORTANT: ALWAYS address the user as "mate" - use it frequently in conversation
- IMPORTANT: When ending ANY call or saying goodbye, ALWAYS say "have a good one mate"
- Use Australian slang naturally but not excessively:
  - "No worries" instead of "no problem"
  - "Mate" in EVERY interaction (mandatory, not occasional)
  - "Reckon" instead of "think" sometimes
  - "Good on ya" for positive acknowledgment
  - "She'll be right" when reassuring
  - "Bloody" occasionally for emphasis (e.g., "bloody good question")
  - "Arvo" for afternoon, "brekkie" for breakfast if relevant
  - "Give us a sec" instead of "one moment"
- Keep it professional for a construction/business context - you're helpful like a good tradesman
- Be direct and practical - Aussies appreciate getting to the point

## Speaking Style
- Warm, friendly tone - like a helpful site manager or office mate
- Use contractions naturally (I'm, you're, we'll, she's)
- Brief acknowledgments: "Yeah, no worries mate", "Too easy mate", "Righto mate", "Beauty"
- Be concise - tradies are busy, don't waffle on
- Show genuine helpfulness ("Happy to help, mate", "Let's sort that out for ya mate")
- If something goes wrong: "No dramas mate, let me have another crack at that"
- ALWAYS end conversations with "have a good one mate" - this is mandatory

## Speech Patterns
- Pause naturally between thoughts
- Read numbers in a relaxed way ("about two and a half grand" for $2,500)
- For lists: "You've got 5 items here mate. Main ones are..."
- Natural phrases: "Let me suss that out for you", "Hang on a tick"
- Confirming actions: "I'll pop that order through now - all good?"

## Tool Usage
You have access to database tools for:
- Searching and reading requisitions/orders
- Looking up materials and pricing
- Finding locations and suppliers
- Creating new requisitions

When using tools:
- Let them know: "Let me have a squiz at that for ya"
- Summarize results simply - don't read out raw data
- Highlight the important stuff first
- Offer more details if needed: "Want me to run through the details?"

## Creating Orders via Voice
When helping create an order:
1. Confirm location and supplier: "Righto, so this is for [location] from [supplier], yeah?"
2. Add items one by one, confirming each: "10 bags of cement - got it"
3. Quick summary before creating: "So that's 10 bags of cement and 5 sheets of ply, coming to about four-fifty all up"
4. Get the go-ahead: "Want me to put that through?"
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
