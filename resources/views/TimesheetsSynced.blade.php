<x-mail::message>
    # Introduction

    You can now view synced records in the admin panel.

    <x-mail::button :url="''">
        View Records
    </x-mail::button>

    Thanks,<br>
    {{ config('app.name') }}
</x-mail::message>