<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class GuestPrestartSignedEvent implements ShouldBroadcastNow
{
    use InteractsWithSockets, SerializesModels;

    public string|int $kiosk_id;

    public Collection $guests;

    public function __construct(string|int $kiosk_id, Collection $guests)
    {
        $this->kiosk_id = $kiosk_id;
        $this->guests = $guests;
    }

    public function broadcastWith(): array
    {
        return [
            'guests' => $this->guests,
        ];
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('kiosk.'.$this->kiosk_id);
    }

    public function broadcastAs(): string
    {
        return 'guest.prestart.signed';
    }
}
