<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class EmployeeClockedEvent implements ShouldBroadcastNow
{
    use InteractsWithSockets, SerializesModels;

    public string|int $kiosk_id;

    public Collection $employees;

    /**
     * @return void
     */
    public function __construct(string|int $kiosk_id, Collection $employees)
    {
        $this->kiosk_id = $kiosk_id;
        $this->employees = $employees;
    }

    public function broadcastWith(): array
    {
        return [

            'employees' => $this->employees,
        ];
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('kiosk.'.$this->kiosk_id);
    }

    public function broadcastAs(): string
    {
        return 'employee.clocked';
    }
}
