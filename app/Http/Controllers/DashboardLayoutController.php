<?php

namespace App\Http\Controllers;

use App\Models\DashboardLayout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardLayoutController extends Controller
{
    public function index(): JsonResponse
    {
        $layouts = DashboardLayout::select('id', 'name', 'is_active', 'updated_at')
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();

        return response()->json($layouts);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'clone_from' => 'nullable|integer|exists:dashboard_layouts,id',
        ]);

        $gridLayout = null;
        $hiddenWidgets = [];

        if ($request->clone_from) {
            $source = DashboardLayout::findOrFail($request->clone_from);
            $gridLayout = $source->grid_layout;
            $hiddenWidgets = $source->hidden_widgets ?? [];
        }

        // Use default layout if not cloning
        if (!$gridLayout) {
            $gridLayout = [
                ['i' => 'project-details', 'x' => 0, 'y' => 0, 'w' => 4, 'h' => 2],
                ['i' => 'variations', 'x' => 4, 'y' => 0, 'w' => 4, 'h' => 2],
                ['i' => 'budget-safety', 'x' => 8, 'y' => 0, 'w' => 2, 'h' => 3],
                ['i' => 'industrial-action', 'x' => 10, 'y' => 0, 'w' => 2, 'h' => 3],
                ['i' => 'budget-weather', 'x' => 12, 'y' => 0, 'w' => 2, 'h' => 3],
                ['i' => 'margin-health', 'x' => 4, 'y' => 2, 'w' => 1, 'h' => 1],
                ['i' => 'this-month', 'x' => 4, 'y' => 3, 'w' => 1, 'h' => 1],
                ['i' => 'other-items', 'x' => 5, 'y' => 2, 'w' => 1, 'h' => 2],
                ['i' => 'po-commitments', 'x' => 4, 'y' => 4, 'w' => 2, 'h' => 2],
                ['i' => 'sc-commitments', 'x' => 6, 'y' => 4, 'w' => 2, 'h' => 2],
                ['i' => 'employees-on-site', 'x' => 10, 'y' => 6, 'w' => 6, 'h' => 4],
                ['i' => 'claim-vs-production', 'x' => 6, 'y' => 2, 'w' => 2, 'h' => 2],
                ['i' => 'project-income', 'x' => 0, 'y' => 4, 'w' => 4, 'h' => 2],
                ['i' => 'labour-budget', 'x' => 0, 'y' => 6, 'w' => 8, 'h' => 4],
            ];
        }

        $layout = DashboardLayout::create([
            'name' => $request->name,
            'grid_layout' => $gridLayout,
            'hidden_widgets' => $hiddenWidgets,
            'is_active' => false,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json($layout, 201);
    }

    public function update(Request $request, DashboardLayout $layout): JsonResponse
    {
        $request->validate([
            'name' => 'sometimes|string|max:100',
            'grid_layout' => 'sometimes|array',
            'grid_layout.*.i' => 'required|string|max:50',
            'grid_layout.*.x' => 'required|integer|min:0',
            'grid_layout.*.y' => 'required|integer|min:0',
            'grid_layout.*.w' => 'required|integer|min:1|max:14',
            'grid_layout.*.h' => 'required|integer|min:1|max:20',
            'hidden_widgets' => 'sometimes|array',
            'hidden_widgets.*' => 'string|max:50',
        ]);

        $data = $request->only(['name', 'grid_layout', 'hidden_widgets']);
        $data['updated_by'] = $request->user()->id;

        $layout->update($data);

        return response()->json(['success' => true]);
    }

    public function destroy(DashboardLayout $layout): JsonResponse
    {
        if ($layout->is_active) {
            return response()->json(['error' => 'Cannot delete the active layout.'], 422);
        }

        $layout->delete();

        return response()->json(['success' => true]);
    }

    public function activate(DashboardLayout $layout): JsonResponse
    {
        DB::transaction(function () use ($layout) {
            DashboardLayout::where('is_active', true)->update(['is_active' => false]);
            $layout->update(['is_active' => true]);
        });

        return response()->json(['success' => true]);
    }
}
