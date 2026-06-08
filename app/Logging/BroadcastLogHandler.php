<?php

namespace App\Logging;

use App\Events\LogLineAppended;
use Monolog\Formatter\LineFormatter;
use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Level;
use Monolog\LogRecord;
use Throwable;

/**
 * Monolog handler that broadcasts every log record on the `portal-logs` private channel.
 * Renders each record with Laravel's default LineFormatter so the broadcast text matches
 * exactly what gets written to laravel.log.
 *
 * The static $broadcasting guard prevents re-entry: if broadcasting itself triggers
 * another log write (Reverb client error, queue connection failure, etc.) we silently
 * skip it instead of recursing into an infinite loop.
 */
class BroadcastLogHandler extends AbstractProcessingHandler
{
    private static bool $broadcasting = false;

    public function __construct(int|string|Level $level = Level::Debug, bool $bubble = true)
    {
        parent::__construct($level, $bubble);
        $this->setFormatter(new LineFormatter(null, null, true, true));
    }

    protected function write(LogRecord $record): void
    {
        if (self::$broadcasting) {
            return;
        }

        self::$broadcasting = true;
        try {
            $formatted = (string) $record->formatted;
            event(new LogLineAppended(
                line: rtrim($formatted, "\n"),
                level: $record->level->getName(),
                channel: $record->channel,
                timestamp: $record->datetime->format('c'),
            ));
        } catch (Throwable) {
            // Swallow — broadcasting failure must never break the actual file write.
        } finally {
            self::$broadcasting = false;
        }
    }
}
