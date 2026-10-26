<?php

use App\Services\BookingEngine;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('bookings:reconcile', function (BookingEngine $e) {
    $this->info($e->reconcile().' requests expired.');
});
Schedule::command('bookings:reconcile')->everyMinute()->withoutOverlapping();
Schedule::command('sanctum:prune-expired --hours=24')->daily();
