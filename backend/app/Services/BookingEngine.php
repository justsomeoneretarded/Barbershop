<?php

namespace App\Services;

use App\Models\BarberProfile;
use App\Models\Booking;
use App\Models\ShopService;
use App\Models\User;
use Carbon\CarbonImmutable as C;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class BookingEngine
{
    public function reconcile(): int
    {
        $count = 0;
        Booking::where(fn ($q) => $q->where(fn ($x) => $x->where('status', 'pending_payment')->where('locked_until', '<=', now()))->orWhere(fn ($x) => $x->where('status', 'pending_approval')->where('approval_deadline', '<=', now())))->orderBy('id')->each(function ($b) use (&$count) {
            DB::transaction(function () use ($b, &$count) {
                $b = Booking::lockForUpdate()->find($b->id);
                if (($b->status === 'pending_payment' && $b->locked_until?->isPast()) || ($b->status === 'pending_approval' && $b->approval_deadline?->isPast())) {
                    $this->release($b, 'expired', null);
                    $count++;
                }
            });
        });

        return $count;
    }

    public function services(BarberProfile $b, array $ids)
    {
        abort_unless($b->status === 'active' && $b->shop?->status === 'active', 422, 'Barber is unavailable.');
        $services = ShopService::whereIn('id', $ids)->where('shop_id', $b->shop_id)->where('is_active', true)->get();
        abort_unless($services->count() === count(array_unique($ids)) && $b->services()->whereIn('shop_services.id', $ids)->count() === $services->count(), 422, 'Choose services offered by this barber.');

        return $services;
    }

    public function slots(BarberProfile $b, string $date, array $ids): array
    {
        $services = $this->services($b, $ids);
        $day = C::parse($date, $b->shop->timezone);
        $now = C::now($b->shop->timezone);
        abort_if($day->startOfDay()->lt($now->startOfDay()) || $day->gt($now->addDays(90)), 422, 'Choose a date within the next 90 days.');
        $s = $b->schedules()->where('day_of_week', $day->dayOfWeek)->first();
        if (! $s || $s->is_day_off || DB::table('barber_time_off')->where('barber_id', $b->id)->where('date', $date)->exists()) {
            return [];
        }
        $duration = $services->sum('duration_minutes') + $services->sum('buffer_minutes');
        $start = C::parse("$date {$s->start_time}", $b->shop->timezone);
        $close = C::parse("$date {$s->end_time}", $b->shop->timezone);
        $busy = Booking::where('barber_id', $b->id)->whereDate('booking_date', $date)->whereIn('status', ['pending_payment', 'pending_approval', 'confirmed'])->get();
        $slots = [];
        for ($t = $start; $t->addMinutes($duration)->lte($close); $t = $t->addMinutes($s->slot_interval_minutes)) {
            $end = $t->addMinutes($duration);
            if ($t->lte($now->addMinutes(config('booking.minimum_notice_minutes')))) {
                continue;
            }
            if ($s->break_start && $t->format('H:i:s') < $s->break_end && $end->format('H:i:s') > $s->break_start) {
                continue;
            }
            if ($busy->contains(fn ($x) => $t->format('H:i:s') < $x->end_time && $end->format('H:i:s') > $x->start_time)) {
                continue;
            }
            $slots[] = ['start_time' => $t->format('H:i'), 'end_time' => $end->format('H:i'), 'duration_minutes' => $duration];
        }

        return $slots;
    }

    public function hold(User $u, array $d): Booking
    {
        abort_unless($u->role === 'customer', 403);
        $this->reconcile();
        $b = BarberProfile::with('shop')->findOrFail($d['barber_id']);

        return Cache::lock('booking:barber:'.$b->id, 15)->block(5, function () use ($u, $d, $b) {
            return DB::transaction(function () use ($u, $d, $b) {
                User::whereKey($u->id)->lockForUpdate()->first();
                abort_if(Booking::where('customer_id', $u->id)->where('status', 'pending_payment')->count() >= config('booking.maximum_active_holds'), 429, 'Finish or cancel an existing checkout before reserving another chair.');
                // Serialize holds per barber; the exclusion constraint independently rejects overlap.
                BarberProfile::whereKey($b->id)->lockForUpdate()->first();
                $slot = collect($this->slots($b, $d['booking_date'], $d['service_ids']))->firstWhere('start_time', $d['start_time']);
                abort_unless($slot, 409, 'This appointment is no longer available.');
                $services = $this->services($b, $d['service_ids']);
                $cents = $services->sum(fn ($s) => (int) round((float) $s->price * 100));
                $deposit = (int) round($cents / 2);
                $booking = Booking::create(['customer_id' => $u->id, 'shop_id' => $b->shop_id, 'barber_id' => $b->id, 'booking_date' => $d['booking_date'], 'start_time' => $slot['start_time'], 'end_time' => $slot['end_time'], 'total_price' => $cents / 100, 'deposit_amount' => $deposit / 100, 'remaining_balance' => ($cents - $deposit) / 100, 'status' => 'pending_payment', 'locked_until' => now()->addMinutes(10), 'customer_notes' => $d['customer_notes'] ?? null]);
                foreach ($services as $s) {
                    $booking->items()->create(['service_id' => $s->id, 'service_name' => $s->name, 'price' => $s->price, 'duration_minutes' => $s->duration_minutes, 'buffer_minutes' => $s->buffer_minutes]);
                }
                Cache::put('hold:'.$booking->id, ['barber_id' => $b->id, 'start' => $slot['start_time'], 'end' => $slot['end_time']], now()->addMinutes(10));
                $this->event($booking, 'hold_created', $u->id);

                return $booking->load('items', 'shop', 'barber.user');
            });
        });
    }

    public function release(Booking $b, string $status, ?int $actor, string $reason = ''): void
    {
        $b->update(['status' => $status, 'locked_until' => null]);
        $b->payments()->whereIn('status', ['holding', 'verified'])->where('type', 'deposit')->update(['status' => 'refund_pending', 'rejection_reason' => $reason ?: $status, 'updated_at' => now()]);
        Cache::forget('hold:'.$b->id);
        $this->event($b, $status, $actor, ['reason' => $reason]);
    }

    public function event(Booking $b, string $event, ?int $actor, array $details = []): void
    {
        $b->events()->create(['event' => $event, 'actor_id' => $actor, 'details' => $details]);
    }
}
