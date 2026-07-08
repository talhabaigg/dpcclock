<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkerScreening;
use Illuminate\Http\Request;

class WorkerScreeningController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'search'   => 'nullable|string|max:255',
            'status'   => 'nullable|in:active,removed,all',
            'page'     => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:500',
        ]);

        $perPage = $validated['per_page'] ?? 100;
        $status = $validated['status'] ?? 'active';

        $screenings = WorkerScreening::query()
            ->with(['addedByUser:id,name', 'removedByUser:id,name'])
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->when($validated['search'] ?? null, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                        ->orWhere('surname', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('created_at')
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (WorkerScreening $s) => [
                'id' => $s->id,
                'first_name' => $s->first_name,
                'surname' => $s->surname,
                'phone' => $s->phone,
                'email' => $s->email,
                'date_of_birth' => $s->date_of_birth?->format('Y-m-d'),
                'reason' => $s->reason,
                'status' => $s->status,
                'added_by_name' => $s->addedByUser?->name,
                'removed_by_name' => $s->removedByUser?->name,
                'removed_at' => $s->removed_at?->toIso8601String(),
                'created_at' => $s->created_at->toIso8601String(),
                'updated_at' => $s->updated_at->toIso8601String(),
            ]);

        return response()->json($screenings);
    }
}
