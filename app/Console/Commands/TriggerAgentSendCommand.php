<?php

namespace App\Console\Commands;

use App\Events\AgentTaskUpdated;
use App\Models\AgentTask;
use App\Models\Requisition;
use Illuminate\Console\Command;

class TriggerAgentSendCommand extends Command
{
    protected $signature = 'agent:trigger-send {requisition_id}';

    protected $description = 'Manually trigger the agent send-to-supplier flow for an existing requisition';

    public function handle(): int
    {
        $requisition = Requisition::with('supplier', 'location')->find($this->argument('requisition_id'));

        if (! $requisition) {
            $this->error('Requisition not found.');

            return 1;
        }

        if ($requisition->status !== 'success') {
            $this->warn("Requisition #{$requisition->id} is in '{$requisition->status}' status, not 'success'.");
            if (! $this->confirm('Continue anyway?')) {
                return 1;
            }
        }

        // Check for existing active task
        $existingTask = AgentTask::where('requisition_id', $requisition->id)
            ->where('type', 'send_to_supplier')
            ->whereNotIn('status', ['completed', 'failed', 'cancelled'])
            ->first();

        if ($existingTask) {
            $this->warn("Active agent task #{$existingTask->id} already exists (status: {$existingTask->status}).");
            if (! $this->confirm('Cancel it and create a new one?')) {
                return 1;
            }
            $existingTask->update(['status' => 'cancelled']);
        }

        $task = AgentTask::create([
            'requisition_id' => $requisition->id,
            'type' => 'send_to_supplier',
            'status' => 'awaiting_confirmation',
        ]);

        $requisition->update(['agent_status' => 'awaiting_confirmation']);

        event(new AgentTaskUpdated($task));

        $this->info("Agent task #{$task->id} created for requisition #{$requisition->id}");
        $this->info("PO: PO{$requisition->po_number}");
        $this->info("Supplier: {$requisition->supplier?->name}");
        $this->info("Status: awaiting_confirmation");
        $this->info('');
        $this->info("Open the requisition in your browser to see the confirmation card.");

        return 0;
    }
}
