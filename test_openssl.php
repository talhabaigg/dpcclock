<?php

$key = openssl_pkey_new([
    'curve_name' => 'prime256v1',
    'private_key_type' => OPENSSL_KEYTYPE_EC,
]);

if ($key) {
    echo "Key created successfully\n";
} else {
    echo "Failed to create key\n";
    while ($msg = openssl_error_string()) {
        echo "Error: $msg\n";
    }
}

// Check available curves
echo "\nAvailable EC curves:\n";
print_r(openssl_get_curve_names());
