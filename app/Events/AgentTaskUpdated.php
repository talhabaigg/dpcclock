<?php

namespace App\Events;

use App\Models\AgentTask;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class AgentTaskUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public int $taskId;

    public int $requisitionId;

    public string $taskType;

    public string $taskStatus;

    public function __construct(
        AgentTask $task,
        public ?int $step = null,
        public ?int $totalSteps = null,
        public ?string $stepMessage = null,
        public ?string $screenshotUrl = null,
        public ?string $errorMessage = null,
        public ?string $stepPhase = null,
    ) {
        $this->taskId = $task->id;
        $this->requisitionId = $task->requisition_id;
        $this->taskType = $task->type;
        $this->taskStatus = $task->status;
    }

    public function broadcastOn(): Channel
    {
        return new Channel('agent-tasks');
    }

    public function broadcastAs(): string
    {
        return 'agent.task.updated';
    }

    public function broadcastWith(): array
    {
        $data = [
            'task_id' => $this->taskId,
            'requisition_id' => $this->requisitionId,
            'type' => $this->taskType,
            'status' => $this->taskStatus,
            'timestamp' => now()->toISOString(),
        ];

        if ($this->step !== null) {
            $data['step'] = $this->step;
            $data['total_steps'] = $this->totalSteps;
            $data['step_message'] = $this->stepMessage;
            $data['screenshot_url'] = $this->screenshotUrl;
            $data['step_phase'] = $this->stepPhase;
        }

        if ($this->errorMessage) {
            $data['error_message'] = $this->errorMessage;
        }

        return $data;
    }
}
