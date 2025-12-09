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
                'tools' => [
                    [
                        'type' => 'mcp',
                        'server_label' => 'superiorportal',
                        'server_url' => 'https://portal.superiorgroup.com.au/mcp/requisitions',
                        'require_approval' => "never",
                    ]
                ],
            ]);

        $result = $response->json();
        Log::info('OpenAI response:', ['response' => json_encode($result, JSON_PRETTY_PRINT)]);
        if ($response->failed()) {
            return response()->json([
                'error' => 'Failed to contact OpenAI',
                'details' => $response->json(),
            ], 500);
        }

        $output = $result['output'][0]['content'][0]['text'] ?? '';
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
