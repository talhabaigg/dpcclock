<?php

namespace App\Http\Controllers;

use Http;
use Illuminate\Http\Request;
use Log;

class ChatController extends Controller
{
    public function handle(Request $request)
    {

        $data = $request->validate([
            'message' => 'required|string',
            'conversation_id' => 'nullable|string',
        ]);
        Log::info('Received chat message:', $data);


        // Load previous messages from DB/cache if you want persistent conversations:
        // $history = $this->loadHistory($data['conversation_id']);


        Log::info(env('VITE_OPEN_AI_API_KEY'));
        $response = Http::withToken(env('VITE_OPEN_AI_API_KEY'))
            ->post('https://api.openai.com/v1/responses', [
                'model' => 'gpt-4.1-2025-04-14',
                'input' => $data['message'],
            ]);

        $result = $response->json();
        if ($response->failed()) {
            return response()->json([
                'error' => 'Failed to contact OpenAI',
                'details' => $response->json(),
            ], 500);
        }

        $output = $result['output'][0]['content'][0]['text'] ?? '';

        $assistantMessage = is_string($output) ? $output : '';
        Log::info('Assistant message: ' . $assistantMessage);

        // Save to DB if you’re tracking conversations
        // $this->saveMessages($data['conversation_id'], $messages, $assistantMessage);

        return response()->json([
            'reply' => $assistantMessage,
            'conversation_id' => $data['conversation_id'],
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
