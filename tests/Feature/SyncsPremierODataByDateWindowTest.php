<?php

use App\Jobs\Concerns\SyncsPremierODataByDateWindow;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

class SyncsPremierODataByDateWindowTestStub
{
    use SyncsPremierODataByDateWindow;

    public function __construct()
    {
        $this->mode = 'incremental';
    }

    protected function jobName(): string
    {
        return 'test_records';
    }

    protected function endpointConfigKey(): string
    {
        return 'test_records';
    }

    protected function modelClass(): string
    {
        return stdClass::class;
    }

    protected function oDataDateColumn(): string
    {
        return 'Date';
    }

    protected function dbDateColumn(): string
    {
        return 'transaction_date';
    }

    protected function mapRowToRecord(array $r): array
    {
        return [];
    }
}

function makeSyncTables(): void
{
    $build = function (Blueprint $t) {
        $t->id();
        $t->string('payload');
        $t->date('transaction_date');
        $t->timestamps();
    };
    Schema::create('test_records', $build);
    Schema::create('test_records__staging', $build);
}

function callSwapIncremental(string $cutoff): void
{
    $job = new SyncsPremierODataByDateWindowTestStub;
    $m = new ReflectionMethod($job, 'swapIncremental');
    $m->setAccessible(true);
    $m->invoke($job, 'test_records', 'test_records__staging', 'transaction_date', $cutoff, 'TestSync');
}

it('does not collide on primary key when staging ids overlap retained live ids', function () {
    makeSyncTables();

    // Live rows older than the cutoff — they get ids 1, 2, 3.
    DB::table('test_records')->insert([
        ['payload' => 'old-1', 'transaction_date' => '2026-01-01', 'created_at' => now(), 'updated_at' => now()],
        ['payload' => 'old-2', 'transaction_date' => '2026-01-15', 'created_at' => now(), 'updated_at' => now()],
        ['payload' => 'old-3', 'transaction_date' => '2026-02-01', 'created_at' => now(), 'updated_at' => now()],
    ]);

    // Staging mimics a freshly populated sync — auto-increment restarts so these also get ids 1, 2.
    DB::table('test_records__staging')->insert([
        ['payload' => 'new-1', 'transaction_date' => '2026-05-01', 'created_at' => now(), 'updated_at' => now()],
        ['payload' => 'new-2', 'transaction_date' => '2026-05-15', 'created_at' => now(), 'updated_at' => now()],
    ]);

    expect(DB::table('test_records')->where('id', 1)->exists())->toBeTrue();
    expect(DB::table('test_records__staging')->where('id', 1)->exists())->toBeTrue();

    callSwapIncremental('2026-04-01');

    expect(DB::table('test_records')->orderBy('id')->pluck('payload')->all())
        ->toBe(['old-1', 'old-2', 'old-3', 'new-1', 'new-2']);
    expect(DB::table('test_records')->distinct()->count('id'))->toBe(5);
    expect(Schema::hasTable('test_records__staging'))->toBeFalse();
});

it('replaces only rows on or after the cutoff', function () {
    makeSyncTables();

    DB::table('test_records')->insert([
        ['payload' => 'keep-old', 'transaction_date' => '2026-03-01', 'created_at' => now(), 'updated_at' => now()],
        ['payload' => 'evict-stale', 'transaction_date' => '2026-04-10', 'created_at' => now(), 'updated_at' => now()],
    ]);

    DB::table('test_records__staging')->insert([
        ['payload' => 'fresh', 'transaction_date' => '2026-04-10', 'created_at' => now(), 'updated_at' => now()],
    ]);

    callSwapIncremental('2026-04-01');

    expect(DB::table('test_records')->orderBy('transaction_date')->pluck('payload')->all())
        ->toBe(['keep-old', 'fresh']);
});
