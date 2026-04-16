<?php

namespace App\Enums;

enum RenderStage
{
    case Final;      // Creating/sending — resolve placeholders, stamp sender sig, hash
    case Preview;    // External signer viewing — dashed boxes, placeholder text
    case Internal;   // Internal signer viewing — yellow marker for sender_signature
    case Signed;     // Signed PDF — real recipient signature, real dates
}
