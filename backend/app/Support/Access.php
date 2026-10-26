<?php

namespace App\Support;

use App\Models\Booking;
use App\Models\Shop;
use App\Models\User;

class Access
{
    public static function shop(User $u, Shop $s): void
    {
        abort_unless($u->role === 'admin' || ($u->role === 'owner' && $s->owner_id === $u->id), 403);
    }

    public static function booking(User $u, Booking $b, bool $staff = false): void
    {
        $owner = $u->role === 'owner' && $b->shop->owner_id === $u->id;
        $barber = $u->role === 'barber' && $b->barber->user_id === $u->id;
        abort_unless($u->role === 'admin' || $owner || $barber || (! $staff && $b->customer_id === $u->id), 403);
    }

    public static function staffShop(User $u, int $id): void
    {
        abort_unless($u->role === 'admin' || ($u->role === 'owner' && $u->shops()->whereKey($id)->exists()) || ($u->role === 'barber' && $u->barberProfile?->shop_id === $id), 403);
    }
}
