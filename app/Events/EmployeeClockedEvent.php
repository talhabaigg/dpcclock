<?php

namespace App\Events;

use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class EmployeeClockedEvent implements ShouldBroadcastNow
{
    use InteractsWithSockets, SerializesModels;

    /**
     * @var string|int
     */
    public string|int $kiosk_id;

    /**
     * @var \Illuminate\Support\Collection
     */
    public Collection $employees;

    /**
     * @param string|int $kiosk_id
     * @param \Illuminate\Support\Collection $employees
     * @return void
     */
    public function __construct(string|int $kiosk_id, Collection $employees)
    {
        $this->kiosk_id = $kiosk_id;
        $this->employees = $employees;
    }

    /**
     * @return array
     */
    public function broadcastWith(): array
    {
        return [

            "employees" => $this->employees,
        ];
    }

    /**
     * @return \Illuminate\Broadcasting\PrivateChannel
     */
    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("kiosk.".$this->kiosk_id);
    }

    /**
     * @return string
     */
    public function broadcastAs(): string
    {
        return "employee.clocked";
    }
}
