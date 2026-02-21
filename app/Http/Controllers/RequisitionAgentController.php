<?php

namespace App\Http\Controllers;

use App\Ai\Agents\RequisitionAgent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
     * Returns available models for the dropdown selector.
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
            'message' => 'required|string|max:5000',
            'conversation_id' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:50',
        ]);

        $agent = new RequisitionAgent;
        [$provider, $model] = $this->resolveModel($validated['model'] ?? null);

        // Continue existing conversation or start new one
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

        $displayableTools = ['SearchLocations', 'ListSuppliers', 'SearchMaterials'];
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
            'message' => 'required|string|max:5000',
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
