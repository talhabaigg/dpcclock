<?php

namespace App\Http\Controllers;

use App\Models\RequisitionNote;
use Illuminate\Http\Request;

class RequisitionNoteController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'requisition_id' => 'required|exists:requisitions,id',
            'note' => 'required|string|max:255',
        ]);

        $note = RequisitionNote::create([
            'requisition_id' => $request->requisition_id,
            'note' => $request->note,
            'created_by' => auth()->id(),
        ]);

        return redirect()->back()->with('success', 'Note added successfully.');
    }

}
