<?php

namespace App\Enums;

enum SwmsVersionStatus: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Superseded = 'superseded';
    case Archived = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Active => 'Active',
            self::Superseded => 'Superseded',
            self::Archived => 'Archived',
        };
    }
}
