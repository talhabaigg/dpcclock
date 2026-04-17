<?php

namespace App\Http\Controllers;

use App\Enums\SilicaOptionType;
use App\Models\SilicaEntry;
use App\Models\SilicaOption;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SilicaRegisterController extends Controller
{
    public function index(Request $request)
    {
        $query = SilicaEntry::with('employee')
            ->orderByDesc('clock_out_date')
            ->orderByDesc('created_at');

        if ($request->filled('search')) {
            $query->whereHas('employee', function ($q) use ($request) {
                $q->where('name', 'like', '%'.$request->search.'%')
                    ->orWhere('preferred_name', 'like', '%'.$request->search.'%');
            });
        }

        if ($request->filled('from')) {
            $query->where('clock_out_date', '>=', $request->from);
        }

        if ($request->filled('to')) {
            $query->where('clock_out_date', '<=', $request->to);
        }

        if ($request->filled('performed')) {
            $query->where('performed', $request->performed === 'yes');
        }

        $entries = $query->paginate(25)->withQueryString();

        $options = [
            'tasks' => SilicaOption::ofType(SilicaOptionType::Task)->orderBy('sort_order')->get(),
            'control_measures' => SilicaOption::ofType(SilicaOptionType::ControlMeasure)->orderBy('sort_order')->get(),
            'respirators' => SilicaOption::ofType(SilicaOptionType::Respirator)->orderBy('sort_order')->get(),
        ];

        return Inertia::render('silica-register/index', [
            'entries' => $entries,
            'filters' => $request->only(['search', 'from', 'to', 'performed']),
            'options' => $options,
        ]);
    }

    public function storeOption(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:task,control_measure,respirator',
            'label' => 'required|string|max:1000',
        ]);

        $maxSort = SilicaOption::where('type', $validated['type'])->max('sort_order') ?? 0;

        $option = SilicaOption::create([
            'type' => $validated['type'],
            'label' => $validated['label'],
            'sort_order' => $maxSort + 1,
            'active' => true,
        ]);

        return back();
    }

    public function updateOption(Request $request, SilicaOption $option)
    {
        $validated = $request->validate([
            'label' => 'sometimes|string|max:1000',
            'active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer',
        ]);

        $option->update($validated);

        return back();
    }

    public function reorderOptions(Request $request)
    {
        $validated = $request->validate([
            'options' => 'required|array',
            'options.*.id' => 'required|exists:silica_options,id',
            'options.*.sort_order' => 'required|integer',
        ]);

        foreach ($validated['options'] as $item) {
            SilicaOption::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        return back();
    }

    public function destroyOption(SilicaOption $option)
    {
        $option->delete();

        return back();
    }
}
