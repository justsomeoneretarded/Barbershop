<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Payment;
use App\Services\BookingEngine;
use App\Support\Access;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BookingController extends Controller
{
    public function index(Request $r, BookingEngine $e)
    {
        $e->reconcile();
        $u = $r->user();
        $q = Booking::with(['shop', 'barber.user:id,full_name,avatar_path', 'customer:id,full_name,avatar_path', 'items', 'payments'])->latest('booking_date')->orderBy('start_time');
        if ($u->role === 'customer') {
            $q->where('customer_id', $u->id);
        } elseif ($u->role === 'barber') {
            $q->whereHas('barber', fn ($q) => $q->where('user_id', $u->id));
        } elseif ($u->role === 'owner') {
            $q->whereHas('shop', fn ($q) => $q->where('owner_id', $u->id));
        }
        if ($r->filled('status')) {
            $q->where('status', $r->string('status')->toString());
        }

        return $q->paginate(50);
    }

    public function store(Request $r, BookingEngine $e)
    {
        $d = $r->validate(['barber_id' => 'required|integer|exists:barber_profiles,id', 'booking_date' => 'required|date_format:Y-m-d', 'start_time' => 'required|date_format:H:i', 'service_ids' => 'required|array|min:1|max:10', 'service_ids.*' => 'required|integer|distinct', 'customer_notes' => 'nullable|string|max:2000']);

        return response()->json($e->hold($r->user(), $d), 201);
    }

    public function show(Request $r, Booking $booking, BookingEngine $e)
    {
        $e->reconcile();
        $booking->refresh();
        Access::booking($r->user(), $booking);
        $booking->load('shop', 'barber.user:id,full_name,avatar_path', 'customer:id,full_name,avatar_path', 'items', 'payments', 'events');
        if ($booking->status === 'pending_payment') {
            $booking->shop->makeVisible(['bank_name', 'bank_account_name', 'bank_account_number']);
        }

        return $booking;
    }

    public function payment(Request $r, Booking $booking, BookingEngine $e)
    {
        abort_unless($booking->customer_id === $r->user()->id, 403);
        $r->merge(['reference_code' => strtoupper(trim((string) $r->input('reference_code')))]);
        $d = $r->validate(['reference_code' => 'required|string|regex:/^[A-Z0-9-]{5,80}$/|unique:payments', 'receipt' => 'required|image|mimes:jpeg,png,webp|max:5120']);
        $path = $r->file('receipt')->store('receipts', 'local');
        try {
            $result = DB::transaction(function () use ($r, $booking, $d, $path, $e) {
                $b = Booking::lockForUpdate()->findOrFail($booking->id);
                abort_unless($b->status === 'pending_payment' && $b->locked_until?->isFuture(), 409, 'The hold has expired or payment was already submitted.');
                $p = $b->payments()->create(['amount_paid' => $b->deposit_amount, 'reference_code' => $d['reference_code'], 'receipt_image_path' => $path, 'status' => 'holding']);
                $b->update(['status' => 'pending_approval', 'locked_until' => null, 'approval_deadline' => now()->addHours(2)]);
                Cache::forget('hold:'.$b->id);
                $e->event($b, 'payment_submitted', $r->user()->id, ['payment_id' => $p->id]);

                return $b->load('payments');
            });
        } catch (\Throwable $error) {
            Storage::disk('local')->delete($path);
            throw $error;
        }

        return $result;
    }

    public function decide(Request $r, Booking $booking, BookingEngine $e)
    {
        Access::booking($r->user(), $booking, true);
        $d = $r->validate(['decision' => 'required|in:approve,reject', 'reason' => 'required_if:decision,reject|nullable|string|max:2000']);

        return DB::transaction(function () use ($booking, $r, $d, $e) {
            $b = Booking::lockForUpdate()->findOrFail($booking->id);
            abort_unless($b->status === 'pending_approval' && $b->approval_deadline?->isFuture(), 409, 'This request is no longer awaiting approval.');
            if ($d['decision'] === 'approve') {
                $b->update(['status' => 'confirmed']);
                $b->payments()->where('status', 'holding')->update(['status' => 'verified', 'updated_at' => now()]);
                $e->event($b, 'confirmed', $r->user()->id);
            } else {
                $e->release($b, 'rejected', $r->user()->id, $d['reason']);
            }

            return $b->load('payments');
        });
    }

    public function cancel(Request $r, Booking $booking, BookingEngine $e)
    {
        Access::booking($r->user(), $booking);
        $d = $r->validate(['reason' => 'required|string|max:2000']);

        return DB::transaction(function () use ($booking, $r, $d, $e) {
            $b = Booking::lockForUpdate()->findOrFail($booking->id);
            abort_unless(in_array($b->status, ['pending_payment', 'pending_approval', 'confirmed']), 409, 'This booking cannot be cancelled.');
            $e->release($b, 'cancelled', $r->user()->id, $d['reason']);

            return $b;
        });
    }

    public function complete(Request $r, Booking $booking, BookingEngine $e)
    {
        Access::booking($r->user(), $booking, true);

        return DB::transaction(function () use ($booking, $r, $e) {
            $b = Booking::lockForUpdate()->findOrFail($booking->id);
            abort_unless($b->status === 'confirmed', 409, 'Only a confirmed booking can be completed.');
            $start = CarbonImmutable::parse($b->booking_date.' '.$b->start_time, $b->shop->timezone);
            abort_if($start->isFuture(), 422, 'The appointment has not started yet.');
            $b->payments()->create(['amount_paid' => $b->remaining_balance, 'type' => 'balance', 'method' => 'cash', 'reference_code' => 'CASH-'.Str::uuid(), 'status' => 'verified']);
            $b->update(['status' => 'completed']);
            $e->event($b, 'completed_cash_collected', $r->user()->id);

            return $b->load('payments');
        });
    }

    public function receipt(Request $r, Payment $payment)
    {
        Access::booking($r->user(), $payment->booking);
        abort_unless($payment->receipt_image_path && Storage::disk('local')->exists($payment->receipt_image_path), 404);

        return response()->file(Storage::disk('local')->path($payment->receipt_image_path), ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function refund(Request $r, Payment $payment, BookingEngine $e)
    {
        Access::shop($r->user(), $payment->booking->shop);
        $d = $r->validate(['transaction_reference' => 'required|string|max:100', 'notes' => 'nullable|string|max:2000']);

        return DB::transaction(function () use ($r, $payment, $d, $e) {
            $p = Payment::lockForUpdate()->findOrFail($payment->id);
            abort_unless($p->status === 'refund_pending', 409);
            $p->update(['status' => 'refunded', 'refunded_at' => now(), 'refund_transaction_details' => $d]);
            $e->event($p->booking, 'refund_recorded', $r->user()->id, ['payment_id' => $p->id, ...$d]);

            return $p;
        });
    }
}
