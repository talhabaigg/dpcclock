<?php

namespace App\Observers;

use App\Events\AgentTaskUpdated;
use App\Models\AgentTask;
use App\Models\Requisition;
use App\Models\User;
use App\Notifications\AgentConfirmSendNotification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class RequisitionObserver
{
    public function updating(Requisition $requisition): void
    {
        if (! $requisition->isDirty('status')) {
            return;
        }

        $newStatus = $requisition->status;
        $oldStatus = $requisition->getOriginal('status');

        if ($newStatus === 'success' && $oldStatus !== 'success') {
            $this->handleSuccessStatus($requisition);
        }
    }

    protected function handleSuccessStatus(Requisition $requisition): void
    {
        // Don't create duplicate tasks
        $existingTask = AgentTask::where('requisition_id', $requisition->id)
            ->where('type', 'send_to_supplier')
            ->whereNotIn('status', ['completed', 'cancelled', 'failed'])
            ->exists();

        if ($existingTask) {
            return;
        }

        $task = AgentTask::create([
            'requisition_id' => $requisition->id,
            'type' => 'send_to_supplier',
            'status' => 'awaiting_confirmation',
        ]);

        $requisition->agent_status = 'awaiting_confirmation';

        Log::info("Agent task created for requisition #{$requisition->id}", [
            'task_id' => $task->id,
            'type' => 'send_to_supplier',
        ]);

        // Notify backoffice users
        $backofficeUsers = User::permission('requisitions.approve-pricing')->get();
        if ($backofficeUsers->isNotEmpty()) {
            Notification::send($backofficeUsers, new AgentConfirmSendNotification($task, $requisition));
        }

        event(new AgentTaskUpdated($task));
    }
}
