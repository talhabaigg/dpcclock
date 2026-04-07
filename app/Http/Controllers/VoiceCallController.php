<?php

namespace App\Http\Controllers;

use App\Models\AiChatMessage;
use App\Models\VoiceCallSession;
use App\Traits\ExecutesAiTools;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class VoiceCallController extends Controller
{
    use ExecutesAiTools;
    /**
     * Create an ephemeral token for the OpenAI Realtime API
     * This allows secure browser-to-OpenAI WebSocket connections
     */
    public function createSession(Request $request)
    {
        try {
            $apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: env('VITE_OPEN_AI_API_KEY');

            if (! $apiKey) {
                return response()->json(['error' => 'OpenAI API key is not configured'], 500);
            }

            $voice = $request->input('voice', 'echo');

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

            if (! $session) {
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
            $result = $this->executeAiToolCall($validated['tool_name'], $validated['arguments']);

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
                'output' => json_encode(['error' => 'Tool execution failed: '.$e->getMessage()]),
            ], 500);
        }
    }

    /**
     * Get voice-specific instructions
     */
    private function getVoiceInstructions(): string
    {
        return <<<'INSTRUCTIONS'
You are Superior AI, a voice assistant for the Superior Portal — a construction project management system used by Superior Wall & Ceiling.

## Personality & Tone
- Warm but efficient — like a knowledgeable colleague
- Direct and practical — construction professionals are busy, don't waste their time
- Confident but not robotic — sound like a real person, not a script

## Speaking Style
- Use natural contractions (I'm, you're, we'll, that's)
- Keep responses concise — aim for 1-2 sentences when possible
- Read numbers naturally (e.g. "twenty-five hundred dollars" not "two thousand five hundred dollars")
- For dollar amounts, say "dollars" not "USD"
- For lists, give a quick summary count first, then offer to go through details
- Use casual acknowledgements: "Got it", "Sure thing", "No worries", "Done"
- Avoid filler phrases like "Great question!" or "I'd be happy to help with that"
- Never start with "Sure, I can help you with that" — just do it

## Tool Usage
You have access to tools for:
- Searching and reading requisitions/purchase orders
- Looking up materials and pricing
- Finding locations/projects and suppliers
- Creating new requisitions with line items
- Viewing job summaries with cost and revenue data

When using tools:
- Briefly let them know: "Let me pull that up" or "Checking now"
- Summarize results conversationally — never read raw data or IDs
- Lead with the most important info (status, total, key items)
- If there are many results, give the count and highlights, then ask if they want more

## Creating Orders via Voice
When helping create an order:
1. Ask for the project/location and supplier
2. Walk through items one by one — confirm each before moving on
3. Before submitting, give a quick summary: "That's 3 items totalling twelve hundred dollars for Bunnings at the Smith Street project. Want me to submit?"
4. Always get explicit confirmation before creating

## Important
- If you don't understand something, ask for clarification rather than guessing
- If a tool returns an error, explain what went wrong in plain language
- Remember context within the conversation — don't re-ask things they've already told you
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
                'name' => 'get_job_summary',
                'description' => 'Get job summary data including costs, revenue, and billing status for projects. Use "search" to find jobs by project name — this is the preferred parameter when the user says a project name.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'search' => [
                            'type' => 'string',
                            'description' => 'Search by project name or job number. Use this when the user says a name like "Southbank" or "CBD Tower".',
                        ],
                        'job_number' => [
                            'type' => 'string',
                            'description' => 'Filter by exact job number. Only if user gives a specific number.',
                        ],
                        'company_code' => [
                            'type' => 'string',
                            'description' => 'Filter by company code (SWC, GREEN, SWCP)',
                        ],
                        'status' => [
                            'type' => 'string',
                            'description' => 'Filter by job status',
                        ],
                        'limit' => [
                            'type' => 'integer',
                            'description' => 'Max results (default 20)',
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
     * Save a voice transcript exchange to the conversation history.
     */
    public function saveTranscript(Request $request)
    {
        $validated = $request->validate([
            'voice_session_id' => 'required|integer',
            'conversation_id' => 'nullable|string',
            'user_transcript' => 'nullable|string',
            'ai_transcript' => 'nullable|string',
        ]);

        $userId = $request->user()->id;
        $conversationId = $validated['conversation_id'] ?? 'voice-'.($validated['voice_session_id'] ?? Str::uuid()->toString());

        $saved = [];

        if (! empty($validated['user_transcript'])) {
            $saved[] = AiChatMessage::create([
                'user_id' => $userId,
                'conversation_id' => $conversationId,
                'role' => 'user',
                'message' => $validated['user_transcript'],
                'model_used' => 'voice-realtime',
            ]);
        }

        if (! empty($validated['ai_transcript'])) {
            $saved[] = AiChatMessage::create([
                'user_id' => $userId,
                'conversation_id' => $conversationId,
                'role' => 'assistant',
                'message' => $validated['ai_transcript'],
                'model_used' => 'gpt-4o-mini-realtime',
            ]);
        }

        return response()->json([
            'conversation_id' => $conversationId,
            'saved_count' => count($saved),
        ]);
    }
}
