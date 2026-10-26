<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\ClientNote;
use App\Models\User;
use App\Support\Access;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    private function bookings(Request $r)
    {
        $u = $r->user();
        abort_unless(in_array($u->role, ['barber', 'owner', 'admin']), 403);
        $q = Booking::query();
        $r->validate(['shop_id' => 'nullable|integer|exists:shops,id']);
        if ($r->filled('shop_id')) {
            Access::staffShop($u, $r->integer('shop_id'));
            $q->where('shop_id', $r->integer('shop_id'));
        }
        if ($u->role === 'barber') {
            $q->whereHas('barber', fn ($b) => $b->where('user_id', $u->id));
        }
        if ($u->role === 'owner') {
            $q->whereHas('shop', fn ($s) => $s->where('owner_id', $u->id));
        }

        return $q;
    }

    public function clients(Request $r)
    {
        $r->validate(['q' => 'nullable|string|max:100']);
        $bookings = $this->bookings($r)->with('items', 'barber.user:id,full_name,avatar_path')->get()->groupBy('customer_id');
        $users = User::whereIn('id', $bookings->keys())->when($r->filled('q'), fn ($q) => $q->where('full_name', 'ilike', '%'.$r->input('q').'%'))->get();

        return $users->map(function ($u) use ($r, $bookings) {
            $history = $bookings[$u->id];
            $done = $history->where('status', 'completed');
            $u->setAttribute('visits', $done->count());
            $u->setAttribute('lifetime_spend', round($done->sum('total_price'), 2));
            $u->setAttribute('favorite_barber', $done->groupBy('barber_id')->sortByDesc(fn ($x) => $x->count())->first()?->first()?->barber?->user?->full_name);
            $u->setAttribute('history', $history);
            $u->setAttribute('notes', ClientNote::where('customer_id', $u->id)->where('author_id', $r->user()->id)->when($r->filled('shop_id'), fn ($q) => $q->where('shop_id', $r->integer('shop_id')))->with('author:id,full_name')->latest()->get());

            return $u;
        });
    }

    public function note(Request $r, User $customer)
    {
        $d = $r->validate(['shop_id' => 'required|integer', 'body' => 'required|string|max:5000']);
        Access::staffShop($r->user(), $d['shop_id']);
        abort_unless($this->bookings($r)->where('customer_id', $customer->id)->where('shop_id', $d['shop_id'])->exists(), 403);

        return ClientNote::create([...$d, 'customer_id' => $customer->id, 'author_id' => $r->user()->id]);
    }

    public function revenue(Request $r)
    {
        $d = $r->validate(['from' => 'required|date_format:Y-m-d', 'to' => 'required|date_format:Y-m-d|after_or_equal:from']);
        $bookings = $this->bookings($r)->whereBetween('booking_date', [$d['from'], $d['to']])->with('payments', 'items', 'barber.user:id,full_name')->get();
        $done = $bookings->where('status', 'completed');
        $payments = $bookings->flatMap->payments;
        $verified = $payments->where('status', 'verified');
        $daily = $done->groupBy('booking_date')->sortKeys()->map(fn ($x, $date) => ['date' => $date, 'revenue' => round($x->sum('total_price'), 2), 'visits' => $x->count()])->values();

        return ['gross_revenue' => round($done->sum('total_price'), 2), 'deposits_collected' => round($verified->where('type', 'deposit')->sum('amount_paid'), 2), 'cash_collected' => round($verified->where('type', 'balance')->sum('amount_paid'), 2),
            'balances_due' => round($bookings->where('status', 'confirmed')->sum('remaining_balance'), 2), 'average_ticket' => round($done->avg('total_price') ?? 0, 2), 'completed_visits' => $done->count(),
            'refunds' => round($payments->where('status', 'refunded')->sum('amount_paid'), 2), 'refunds_pending' => round($payments->where('status', 'refund_pending')->sum('amount_paid'), 2),
            'cancelled_value' => round($bookings->whereIn('status', ['cancelled', 'rejected', 'expired'])->sum('total_price'), 2), 'daily' => $daily,
            'barbers' => $done->groupBy('barber_id')->map(fn ($x) => ['name' => $x->first()->barber->user->full_name, 'visits' => $x->count(), 'revenue' => round($x->sum('total_price'), 2)])->values(),
            'services' => $done->flatMap->items->groupBy('service_id')->map(fn ($x) => ['name' => $x->first()->service_name, 'count' => $x->count(), 'revenue' => round($x->sum('price'), 2)])->sortByDesc('count')->values(),
            'refund_queue' => $payments->where('status', 'refund_pending')->values()];
    }
}
