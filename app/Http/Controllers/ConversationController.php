<?php

namespace App\Http\Controllers;

use App\Models\AiChatMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConversationController extends Controller
{
    /**
     * List all conversations for the authenticated user.
     */
    public function index(Request $request)
    {
        $userId = auth()->id();

        $conversations = DB::table('ai_chat_messages')
            ->select(
                'conversation_id',
                DB::raw('MIN(CASE WHEN role = \'user\' THEN message END) as title'),
                DB::raw('MAX(created_at) as last_message_at'),
                DB::raw('COUNT(*) as message_count'),
            )
            ->where('user_id', $userId)
            ->groupBy('conversation_id')
            ->orderByDesc('last_message_at')
            ->limit(100)
            ->get()
            ->map(function ($row) {
                return [
                    'conversation_id' => $row->conversation_id,
                    'title' => $row->title ? \Illuminate\Support\Str::limit($row->title, 80) : 'Untitled',
                    'last_message_at' => $row->last_message_at,
                    'message_count' => $row->message_count,
                ];
            });

        return response()->json($conversations);
    }

    /**
     * Load all messages for a specific conversation.
     */
    public function show(string $conversationId)
    {
        $userId = auth()->id();

        $messages = AiChatMessage::where('conversation_id', $conversationId)
            ->where('user_id', $userId)
            ->orderBy('created_at')
            ->get()
            ->map(fn ($msg) => [
                'id' => $msg->id,
                'role' => $msg->role,
                'content' => $msg->message,
                'created_at' => $msg->created_at->toISOString(),
            ]);

        if ($messages->isEmpty()) {
            return response()->json(['error' => 'Conversation not found'], 404);
        }

        return response()->json([
            'conversation_id' => $conversationId,
            'messages' => $messages,
        ]);
    }

    /**
     * Delete a conversation and all its messages.
     */
    public function destroy(string $conversationId)
    {
        $userId = auth()->id();

        $deleted = AiChatMessage::where('conversation_id', $conversationId)
            ->where('user_id', $userId)
            ->delete();

        if ($deleted === 0) {
            return response()->json(['error' => 'Conversation not found'], 404);
        }

        return response()->json(['success' => true]);
    }
}
