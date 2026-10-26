<?php

namespace Tests\Feature;

use App\Models\BarberProfile;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Shop;
use App\Models\ShopService;
use App\Models\User;
use App\Services\BookingEngine;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookingLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;

    private User $owner;

    private User $barberUser;

    private Shop $shop;

    private BarberProfile $barber;

    private ShopService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->setDate(2026, 11, 2)->setTime(5, 0));
        $this->owner = User::factory()->create(['role' => 'owner']);
        $this->customer = User::factory()->create(['role' => 'customer']);
        $this->barberUser = User::factory()->create(['role' => 'barber']);
        $this->shop = Shop::create(['owner_id' => $this->owner->id, 'name' => 'Test Shop', 'slug' => 'test-shop', 'address_line' => 'Bole', 'latitude' => 9.0054, 'longitude' => 38.7799, 'bank_account_number' => 'private-account', 'status' => 'active']);
        $this->service = $this->shop->services()->create(['name' => 'Haircut', 'price' => '350.01', 'duration_minutes' => 30, 'buffer_minutes' => 5]);
        $this->barber = BarberProfile::create(['user_id' => $this->barberUser->id, 'shop_id' => $this->shop->id, 'status' => 'active']);
        $this->barber->services()->attach($this->service);
        foreach (range(0, 6) as $day) {
            $this->barber->schedules()->create(['day_of_week' => $day, 'start_time' => '09:00', 'end_time' => '18:00', 'break_start' => '13:00', 'break_end' => '14:00', 'slot_interval_minutes' => 30]);
        }
        Storage::fake('local');
    }

    private function hold(string $start = '10:00'): Booking
    {
        return app(BookingEngine::class)->hold($this->customer, ['barber_id' => $this->barber->id, 'service_ids' => [$this->service->id], 'booking_date' => '2026-11-03', 'start_time' => $start]);
    }

    private function submit(Booking $b, string $reference = 'BANK-12345')
    {
        Sanctum::actingAs($this->customer);
        $image = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=');

        return $this->post('/api/bookings/'.$b->id.'/payment', ['reference_code' => $reference, 'receipt' => UploadedFile::fake()->createWithContent('receipt.png', $image)], ['Accept' => 'application/json']);
    }

    public function test_half_deposit_rounds_and_snapshots_services(): void
    {
        $b = $this->hold();
        $this->assertSame('175.01', $b->deposit_amount);
        $this->assertSame('175.00', $b->remaining_balance);
        $this->assertSame('10:35:00', $b->fresh()->end_time);
        $this->service->update(['price' => 999, 'name' => 'Renamed']);
        $this->assertSame('Haircut', $b->items->first()->service_name);
        $this->assertSame('350.01', $b->total_price);
        $this->assertSame('BK-'.str_pad($b->id, 6, '0', STR_PAD_LEFT), $b->booking_code);
        $this->assertTrue(Cache::has('hold:'.$b->id));
    }

    public function test_overlapping_slot_is_unavailable_including_buffer(): void
    {
        $this->hold();
        $slots = app(BookingEngine::class)->slots($this->barber, '2026-11-03', [$this->service->id]);
        $this->assertNotContains('10:00', array_column($slots, 'start_time'));
        $this->assertNotContains('10:30', array_column($slots, 'start_time'));
        $this->assertContains('11:00', array_column($slots, 'start_time'));
    }

    public function test_database_excludes_overlaps_even_without_redis(): void
    {
        $b = $this->hold();
        $this->expectException(QueryException::class);
        $copy = $b->replicate();
        $copy->start_time = '10:15';
        $copy->end_time = '10:50';
        $copy->save();
    }

    public function test_slots_respect_breaks_and_closing_time(): void
    {
        $slots = app(BookingEngine::class)->slots($this->barber, '2026-11-03', [$this->service->id]);
        $times = array_column($slots, 'start_time');
        $this->assertNotContains('12:30', $times);
        $this->assertNotContains('13:00', $times);
        $this->assertNotContains('17:30', $times);
        $this->assertContains('14:00', $times);
    }

    public function test_expired_hold_releases_slot_and_is_idempotent(): void
    {
        $b = $this->hold();
        $this->travel(11)->minutes();
        $e = app(BookingEngine::class);
        $this->assertSame(1, $e->reconcile());
        $this->assertSame(0, $e->reconcile());
        $this->assertSame('expired', $b->fresh()->status);
        $this->assertFalse(Cache::has('hold:'.$b->id));
        $this->hold();
    }

    public function test_payment_submission_keeps_slot_after_checkout_ttl(): void
    {
        $b = $this->hold();
        $this->submit($b)->assertOk()->assertJsonPath('status', 'pending_approval');
        $this->travel(11)->minutes();
        app(BookingEngine::class)->reconcile();
        $this->assertSame('pending_approval', $b->fresh()->status);
        $this->assertNotContains('10:00', array_column(app(BookingEngine::class)->slots($this->barber, '2026-11-03', [$this->service->id]), 'start_time'));
    }

    public function test_late_receipt_is_rejected(): void
    {
        $b = $this->hold();
        $this->travel(11)->minutes();
        $this->submit($b)->assertStatus(409);
        $this->assertSame(0, Payment::count());
    }

    public function test_reference_is_normalized_and_unique(): void
    {
        $b = $this->hold();
        $this->submit($b, 'bank-12345')->assertOk();
        $next = $this->hold('11:00');
        $this->submit($next, 'BANK-12345')->assertUnprocessable();
        $this->assertSame('BANK-12345', Payment::first()->reference_code);
    }

    public function test_approval_verifies_deposit_and_is_not_repeatable(): void
    {
        $b = $this->hold();
        $this->submit($b)->assertOk();
        Sanctum::actingAs($this->barberUser);
        $this->postJson('/api/bookings/'.$b->id.'/decision', ['decision' => 'approve'])->assertOk()->assertJsonPath('status', 'confirmed');
        $this->assertSame('verified', Payment::first()->status);
        $this->postJson('/api/bookings/'.$b->id.'/decision', ['decision' => 'approve'])->assertStatus(409);
    }

    public function test_rejection_queues_refund_without_claiming_money_returned(): void
    {
        $b = $this->hold();
        $this->submit($b)->assertOk();
        Sanctum::actingAs($this->barberUser);
        $this->postJson('/api/bookings/'.$b->id.'/decision', ['decision' => 'reject', 'reason' => 'Unavailable'])->assertOk()->assertJsonPath('status', 'rejected');
        $p = Payment::first();
        $this->assertSame('refund_pending', $p->status);
        $this->assertNull($p->refunded_at);
        Sanctum::actingAs($this->owner);
        $this->postJson('/api/payments/'.$p->id.'/refund', ['transaction_reference' => 'RETURN-001'])->assertOk()->assertJsonPath('status', 'refunded');
        $this->assertSame(1, $b->events()->where('event', 'refund_recorded')->count());
    }

    public function test_approval_expiry_queues_refund_once(): void
    {
        $b = $this->hold();
        $this->submit($b)->assertOk();
        $this->travel(121)->minutes();
        $e = app(BookingEngine::class);
        $this->assertSame(1, $e->reconcile());
        $this->assertSame(0, $e->reconcile());
        $this->assertSame('expired', $b->fresh()->status);
        $this->assertSame('refund_pending', Payment::first()->status);
    }

    public function test_other_customers_cannot_view_booking_or_receipt(): void
    {
        $b = $this->hold();
        $this->submit($b)->assertOk();
        Sanctum::actingAs(User::factory()->create(['role' => 'customer']));
        $this->getJson('/api/bookings/'.$b->id)->assertForbidden();
        $this->getJson('/api/payments/'.Payment::first()->id.'/receipt')->assertForbidden();
        $this->getJson('/api/clients')->assertForbidden();
    }

    public function test_unassigned_barber_cannot_approve(): void
    {
        $b = $this->hold();
        $this->submit($b)->assertOk();
        Sanctum::actingAs(User::factory()->create(['role' => 'barber']));
        $this->postJson('/api/bookings/'.$b->id.'/decision', ['decision' => 'approve'])->assertForbidden();
    }

    public function test_cannot_book_service_from_another_shop(): void
    {
        $other = ShopService::create(['shop_id' => $this->shop->id, 'name' => 'Unassigned', 'price' => 100, 'duration_minutes' => 20, 'buffer_minutes' => 5]);
        Sanctum::actingAs($this->customer);
        $this->postJson('/api/bookings', ['barber_id' => $this->barber->id, 'service_ids' => [$other->id], 'booking_date' => '2026-11-03', 'start_time' => '10:00'])->assertUnprocessable();
    }

    public function test_public_discovery_hides_bank_details_and_sorts_by_distance(): void
    {
        $this->getJson('/api/shops?lat=9.0054&lng=38.7799&radius=15')->assertOk()->assertJsonPath('data.0.id', $this->shop->id)->assertJsonMissing(['bank_account_number' => 'private-account']);
    }

    public function test_time_off_removes_availability(): void
    {
        DB::table('barber_time_off')->insert(['barber_id' => $this->barber->id, 'date' => '2026-11-03']);
        $this->assertSame([], app(BookingEngine::class)->slots($this->barber, '2026-11-03', [$this->service->id]));
    }

    public function test_crm_notes_are_private_to_the_author(): void
    {
        $this->hold();
        Sanctum::actingAs($this->barberUser);
        $this->postJson('/api/clients/'.$this->customer->id.'/notes', ['shop_id' => $this->shop->id, 'body' => 'Private haircut preference'])->assertCreated();
        $this->getJson('/api/clients')->assertOk()->assertJsonPath('0.notes.0.body', 'Private haircut preference')->assertJsonPath('0.visits', 0);
        Sanctum::actingAs($this->owner);
        $this->getJson('/api/clients')->assertOk()->assertJsonPath('0.notes', []);
    }

    public function test_registration_allows_owners_but_never_administrators(): void
    {
        $data = ['full_name' => 'New Owner', 'email' => 'new-owner@example.test', 'password' => 'StrongPassword123!', 'password_confirmation' => 'StrongPassword123!'];
        $this->postJson('/api/auth/register', [...$data, 'role' => 'admin'])->assertUnprocessable();
        $this->postJson('/api/auth/register', [...$data, 'role' => 'owner'])->assertCreated()->assertJsonPath('user.role', 'owner');
    }

    public function test_invitation_cannot_reset_existing_barber_credentials(): void
    {
        Sanctum::actingAs($this->owner);
        $this->postJson('/api/manage/shops/'.$this->shop->id.'/invite', ['full_name' => 'Existing Barber', 'email' => $this->barberUser->email])->assertStatus(409);
    }

    public function test_more_than_three_simultaneous_holds_are_rejected(): void
    {
        $this->hold('10:00');
        $this->hold('11:00');
        $this->hold('14:00');
        Sanctum::actingAs($this->customer);
        $this->postJson('/api/bookings', ['barber_id' => $this->barber->id, 'service_ids' => [$this->service->id], 'booking_date' => '2026-11-03', 'start_time' => '15:00'])->assertStatus(429);
    }

    public function test_minimum_notice_leaves_time_for_payment_and_approval(): void
    {
        $times = array_column(app(BookingEngine::class)->slots($this->barber, '2026-11-02', [$this->service->id]), 'start_time');
        $this->assertNotContains('10:00', $times);
        $this->assertContains('10:30', $times);
    }

    public function test_inactive_barber_cannot_access_client_records(): void
    {
        $this->hold();
        $this->barber->update(['status' => 'inactive']);
        Sanctum::actingAs($this->barberUser);
        $this->getJson('/api/clients')->assertForbidden();
    }

    public function test_invitation_is_single_use_and_initializes_barber_profile(): void
    {
        Sanctum::actingAs($this->owner);
        $response = $this->postJson('/api/manage/shops/'.$this->shop->id.'/invite', ['full_name' => 'New Barber', 'email' => 'new-barber@example.test'])->assertOk();
        $token = basename($response->json('invite_url'));
        $payload = ['token' => $token, 'password' => 'NewBarberPass123!', 'password_confirmation' => 'NewBarberPass123!'];
        $this->postJson('/api/invites/accept', $payload)->assertOk()->assertJsonPath('user.barber_profile.status', 'active');
        $this->postJson('/api/invites/accept', $payload)->assertNotFound();
        $profile = User::where('email', 'new-barber@example.test')->first()->barberProfile;
        $this->assertSame(7, $profile->schedules()->count());
        $this->assertSame(1, $profile->services()->count());
    }

    public function test_cash_completion_records_balance_once(): void
    {
        $b = $this->hold();
        $this->submit($b)->assertOk();
        Sanctum::actingAs($this->barberUser);
        $this->postJson('/api/bookings/'.$b->id.'/decision', ['decision' => 'approve'])->assertOk();
        $this->travelTo(now()->setDate(2026, 11, 3)->setTime(9, 0));
        $this->postJson('/api/bookings/'.$b->id.'/complete')->assertOk()->assertJsonPath('status', 'completed');
        $this->postJson('/api/bookings/'.$b->id.'/complete')->assertStatus(409);
        $this->assertSame(1, $b->payments()->where('type', 'balance')->count());
        $this->getJson('/api/reports/revenue?from=2026-11-01&to=2026-11-30')->assertOk()->assertJsonPath('gross_revenue',350.01)->assertJsonPath('balances_due',0);
    }
}
