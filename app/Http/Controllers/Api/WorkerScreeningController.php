<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkerScreening;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

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

    public function store(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'surname' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'date_of_birth' => 'nullable|date',
            'reason' => 'required|string',
        ]);

        $phone = WorkerScreening::normalizePhone($validated['phone'] ?? null);
        $email = $validated['email'] ?? null;
        $firstName = $validated['first_name'];
        $surname = $validated['surname'];
        $dob = $validated['date_of_birth'] ?? null;

        if (! $phone && ! $email && ! ($firstName && $surname && $dob)) {
            throw ValidationException::withMessages([
                'phone' => 'At least one identifier is required: phone, email, or name with date of birth.',
            ]);
        }

        $existing = WorkerScreening::checkWorker([
            'phone' => $phone,
            'email' => $email,
            'first_name' => $firstName,
            'surname' => $surname,
            'date_of_birth' => $dob,
        ]);

        if ($existing) {
            throw ValidationException::withMessages([
                'first_name' => 'An active screening entry already exists for this person.',
            ]);
        }

        $screening = WorkerScreening::create([
            ...$validated,
            'added_by' => $request->user()->id,
            'status' => 'active',
        ]);

        return response()->json([
            'id' => $screening->id,
            'first_name' => $screening->first_name,
            'surname' => $screening->surname,
            'phone' => $screening->phone,
            'email' => $screening->email,
            'date_of_birth' => $screening->date_of_birth?->format('Y-m-d'),
            'reason' => $screening->reason,
            'status' => $screening->status,
            'created_at' => $screening->created_at->toIso8601String(),
        ], 201);
    }
}
