<?php

namespace App\Http\Controllers;

use App\Models\AiChatMessage;
use Http;
use Illuminate\Http\Request;
use Log;
use Illuminate\Support\Str;

class ChatController extends Controller
{
    public function handle(Request $request)
    {

        $data = $request->validate([
            'message' => 'required|string',
            'conversation_id' => 'nullable|string',
        ]);

        $conversationId = $data['conversation_id'] ?? Str::uuid()->toString();
        $userId = auth()->id() ?? 1; // adjust to your auth setup
        Log::info('Received chat message:', $data);

        $firstMessage = AiChatMessage::create([
            'user_id' => $userId,
            'conversation_id' => $conversationId,
            'role' => 'user',
            'message' => $data['message'],
        ]);

        // Load previous messages from DB/cache if you want persistent conversations:
        $history = AiChatMessage::where('conversation_id', $conversationId)
            ->orderBy('created_at')
            ->get();
        foreach ($history as $msg) {
            $input[] = [
                'role' => $msg->role,       // 'user' or 'assistant'
                'content' => $msg->message,
            ];
        }

        // Log::info(env('VITE_OPEN_AI_API_KEY'));
        $response = Http::withToken(env('VITE_OPEN_AI_API_KEY'))
            ->post('https://api.openai.com/v1/responses', [
                'model' => 'gpt-4.1',
                'input' => $input,
                'instructions' => 'Provide accurate and concise information based on the user\'s queries. If you do not know the answer, respond with "I am not sure about that." Do not make up answers. Always look for answers in file search tools if available.',
                'tools' => [
                    [
                        'type' => 'file_search',
                        'vector_store_ids' => ['vs_693b42274360819194f48f75a299bea9'],
                    ],
                ],
                // 'tools' => [
                //     [
                //         'type' => 'mcp',
                //         'server_label' => 'superiorportal',
                //         'server_url' => 'https://portal.superiorgroup.com.au/mcp/requisitions',
                //         'require_approval' => 'never',
                //     ]
                // ],
            ]);

        $result = $response->json();
        Log::info('OpenAI response:', ['response' => json_encode($result, JSON_PRETTY_PRINT)]);
        if ($response->failed()) {
            return response()->json([
                'error' => 'Failed to contact OpenAI',
                'details' => $response->json(),
            ], 500);
        }

        $output = '';

        if (isset($result['output']) && is_array($result['output'])) {
            foreach ($result['output'] as $entry) {
                if (
                    isset($entry['type']) &&
                    $entry['type'] === 'message' &&
                    isset($entry['content']) &&
                    is_array($entry['content'])
                ) {
                    foreach ($entry['content'] as $content) {
                        if ($content['type'] === 'output_text' && isset($content['text'])) {
                            $output = $content['text'];
                            break 2; // stop after finding the first text message
                        }
                    }
                }
            }
        }

        $assistantMessage = is_string($output) ? $output : '';
        Log::info('Assistant message: ' . $assistantMessage);
        AiChatMessage::create([
            'user_id' => 1,
            'conversation_id' => $conversationId,
            'role' => 'assistant',
            'message' => $assistantMessage,
            'model_used' => $result['model'] ?? null,
            'tokens_used' => $result['usage']['total_tokens'] ?? null,
        ]);
        // Save to DB if you’re tracking conversations
        // $this->saveMessages($data['conversation_id'], $messages, $assistantMessage);

        return response()->json([
            'reply' => $assistantMessage,
            'conversation_id' => $conversationId,
        ]);
    }

    public function handleStream(Request $request)
    {
        $data = $request->validate([
            'message' => 'required|string',
            'conversation_id' => 'nullable|string',
        ]);

        $conversationId = $data['conversation_id'] ?? Str::uuid()->toString();
        $userId = auth()->id() ?? 1;

        // Save the user message
        AiChatMessage::create([
            'user_id' => $userId,
            'conversation_id' => $conversationId,
            'role' => 'user',
            'message' => $data['message'],
        ]);

        // Build conversation history
        $history = AiChatMessage::where('conversation_id', $conversationId)
            ->orderBy('created_at')
            ->get();

        $input = [];
        foreach ($history as $msg) {
            $input[] = [
                'role' => $msg->role,   // 'user' or 'assistant'
                'content' => $msg->message,
            ];
        }

        return response()->stream(function () use ($input, $conversationId, $userId) {
            @ini_set('output_buffering', 'off');
            @ini_set('zlib.output_compression', 0);
            @ini_set('implicit_flush', 1);
            @ob_implicit_flush(true);

            $fullText = '';

            // Call OpenAI with streaming enabled
            $stream = Http::withToken(env('VITE_OPEN_AI_API_KEY'))
                ->withHeaders([
                    'Accept' => 'text/event-stream',
                    'Content-Type' => 'application/json',
                ])
                ->withOptions([
                    'stream' => true,
                ])
                ->post('https://api.openai.com/v1/responses', [
                    'model' => 'gpt-4.1',
                    'input' => $input,
                    'instructions' => 'Provide accurate and concise information based on the user\'s queries. If you do not know the answer, respond with "I am not sure about that." Do not make up answers. Always look for answers in file search tools if available.',
                    'tools' => [
                        [
                            'type' => 'file_search',
                            'vector_store_ids' => ['vs_693b42274360819194f48f75a299bea9'],
                        ],
                        [
                            'type' => 'mcp',
                            'server_label' => 'superiorportal',
                            'server_url' => 'https://portal.superiorgroup.com.au/mcp/requisitions',
                            'require_approval' => 'never',
                        ]
                    ],
                    'stream' => true, // tell OpenAI to stream
                ])
                ->toPsrResponse()
                ->getBody(); // Psr\Http\Message\StreamInterface

            $buffer = '';
            $total_tokens = 0;
            while (!$stream->eof()) {
                $chunk = $stream->read(1024);
                if ($chunk === '' || $chunk === false) {
                    usleep(20000);
                    continue;
                }

                $buffer .= $chunk;

                // Process line-by-line (SSE from OpenAI)
                while (($pos = strpos($buffer, "\n")) !== false) {
                    $line = trim(substr($buffer, 0, $pos));
                    $buffer = substr($buffer, $pos + 1);

                    if ($line === '') {
                        continue;
                    }

                    if (strpos($line, 'data: ') !== 0) {
                        continue;
                    }

                    $payload = substr($line, 6);

                    if ($payload === '[DONE]') {
                        // end of OpenAI stream
                        break 2;
                    }

                    $event = json_decode($payload, true);
                    Log::info('Stream event: ' . $payload);
                    if (!is_array($event)) {
                        continue;
                    }

                    // We care about text deltas
                    if (($event['type'] ?? null) === 'response.output_text.delta') {
                        $delta = $event['delta'] ?? '';
                        if (!is_string($delta) || $delta === '') {
                            continue;
                        }

                        $fullText .= $delta;

                        // Send this chunk to the browser as SSE
                        echo 'data: ' . json_encode(['delta' => $delta]) . "\n\n";
                        @ob_flush();
                        @flush();
                    }

                    if (($event['type'] ?? null) === 'response.completed') {
                        $usage = $event['response']['usage'] ?? null;

                        if (is_array($usage)) {
                            $total_tokens = $usage['total_tokens'] ?? null;
                            Log::info('Streaming completed. Usage: ' . json_encode($usage));
                        }

                        break 2;
                    }
                }
            }

            // Save the full assistant message once streaming is done
            if ($fullText !== '') {
                AiChatMessage::create([
                    'user_id' => $userId,
                    'conversation_id' => $conversationId,
                    'role' => 'assistant',
                    'message' => $fullText,
                    'model_used' => 'gpt-4.1',
                    'tokens_used' => $total_tokens,
                ]);
            }

            // Final event for frontend (so it can store conversation_id etc.)
            echo "event: done\n";
            echo 'data: ' . json_encode([
                'conversation_id' => $conversationId,
            ]) . "\n\n";

            @ob_flush();
            @flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
    protected function loadHistory(?string $conversationId): array
    {
        if (!$conversationId) {
            return [
                [
                    'role' => 'system',
                    'content' => 'You are a helpful assistant inside a Laravel app.',
                ],
            ];
        }

        // Example: reconstruct messages from chat_messages table
        // return ChatMessage::where('conversation_id', $conversationId)
        //     ->orderBy('id')
        //     ->get()
        //     ->map(fn ($m) => ['role' => $m->role, 'content' => $m->content])
        //     ->toArray();

        return [];
    }
}
