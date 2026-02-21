<?php

namespace App\Ai\Tools;

use App\Models\Supplier;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class ListSuppliers implements Tool
{
    public function description(): Stringable|string
    {
        return 'List or search suppliers by name or code. Returns supplier ID, name, and code.';
    }

    public function handle(Request $request): Stringable|string
    {
        $query = Supplier::query();

        $search = $request['search'] ?? null;

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $suppliers = $query->orderBy('name')->limit(50)->get(['id', 'name', 'code']);

        return json_encode([
            'suppliers' => $suppliers->toArray(),
            'count' => $suppliers->count(),
        ], JSON_PRETTY_PRINT);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'search' => $schema->string()->description('Optional search term to filter suppliers by name or code'),
        ];
    }
}
