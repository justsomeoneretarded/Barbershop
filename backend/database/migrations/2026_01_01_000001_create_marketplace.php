<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->renameColumn('name', 'full_name');
            $t->string('email')->nullable()->change();
            $t->string('password')->nullable()->change();
            $t->string('phone_number')->nullable()->unique();
            $t->string('google_id')->nullable()->unique();
            $t->enum('role', ['customer', 'barber', 'owner', 'admin'])->default('customer');
            $t->string('avatar_path')->nullable();
        });
        Schema::create('personal_access_tokens', function (Blueprint $t) {
            $t->id();
            $t->morphs('tokenable');
            $t->string('name');
            $t->string('token', 64)->unique();
            $t->text('abilities')->nullable();
            $t->timestamp('last_used_at')->nullable();
            $t->timestamp('expires_at')->nullable()->index();
            $t->timestamps();
        });
        Schema::create('shops', function (Blueprint $t) {
            $t->id();
            $t->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $t->string('name');
            $t->string('slug')->unique();
            $t->text('description')->nullable();
            $t->string('address_line');
            $t->string('city')->default('Addis Ababa');
            $t->string('timezone')->default('Africa/Addis_Ababa');
            $t->decimal('latitude', 10, 8);
            $t->decimal('longitude', 11, 8);
            $t->string('bank_name')->nullable();
            $t->string('bank_account_name')->nullable();
            $t->string('bank_account_number')->nullable();
            $t->enum('status', ['active', 'inactive'])->default('active');
            $t->timestamps();
        });
        Schema::create('shop_services', function (Blueprint $t) {
            $t->id();
            $t->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->text('description')->nullable();
            $t->decimal('price', 10, 2);
            $t->integer('duration_minutes');
            $t->integer('buffer_minutes')->default(5);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });
        Schema::create('barber_profiles', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $t->foreignId('shop_id')->nullable()->constrained()->nullOnDelete();
            $t->enum('status', ['pending_approval', 'active', 'inactive'])->default('pending_approval');
            $t->string('invite_token')->nullable()->unique();
            $t->timestamp('invite_expires_at')->nullable();
            $t->text('bio')->nullable();
            $t->integer('experience_years')->default(1);
            $t->timestamps();
        });
        Schema::create('barber_service', function (Blueprint $t) {
            $t->foreignId('barber_id')->constrained('barber_profiles')->cascadeOnDelete();
            $t->foreignId('service_id')->constrained('shop_services')->cascadeOnDelete();
            $t->primary(['barber_id', 'service_id']);
        });
        Schema::create('barber_schedules', function (Blueprint $t) {
            $t->id();
            $t->foreignId('barber_id')->constrained('barber_profiles')->cascadeOnDelete();
            $t->integer('day_of_week');
            $t->time('start_time');
            $t->time('end_time');
            $t->integer('slot_interval_minutes')->default(30);
            $t->time('break_start')->nullable();
            $t->time('break_end')->nullable();
            $t->boolean('is_day_off')->default(false);
            $t->unique(['barber_id', 'day_of_week']);
        });
        Schema::create('barber_time_off', function (Blueprint $t) {
            $t->id();
            $t->foreignId('barber_id')->constrained('barber_profiles')->cascadeOnDelete();
            $t->date('date');
            $t->string('reason')->nullable();
            $t->unique(['barber_id', 'date']);
            $t->timestamps();
        });
        Schema::create('bookings', function (Blueprint $t) {
            $t->id();
            $t->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $t->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $t->foreignId('barber_id')->constrained('barber_profiles')->restrictOnDelete();
            $t->date('booking_date');
            $t->time('start_time');
            $t->time('end_time');
            $t->decimal('total_price', 10, 2);
            $t->decimal('deposit_amount', 10, 2);
            $t->decimal('remaining_balance', 10, 2);
            $t->enum('status', ['pending_payment', 'pending_approval', 'confirmed', 'rejected', 'expired', 'cancelled', 'completed', 'no_show'])->default('pending_payment');
            $t->timestampTz('locked_until')->nullable();
            $t->timestampTz('approval_deadline')->nullable();
            $t->text('customer_notes')->nullable();
            $t->text('barber_notes')->nullable();
            $t->timestamps();
            $t->index(['barber_id', 'booking_date', 'status']);
        });
        Schema::create('booking_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $t->foreignId('service_id')->constrained('shop_services')->restrictOnDelete();
            $t->string('service_name');
            $t->decimal('price', 10, 2);
            $t->integer('duration_minutes');
            $t->integer('buffer_minutes');
        });
        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $t->decimal('amount_paid', 10, 2);
            $t->string('currency', 3)->default('ETB');
            $t->enum('type', ['deposit', 'balance'])->default('deposit');
            $t->enum('method', ['bank_transfer', 'cash'])->default('bank_transfer');
            $t->string('reference_code')->unique();
            $t->string('receipt_image_path')->nullable();
            $t->enum('status', ['holding', 'verified', 'rejected', 'refund_pending', 'refunded', 'forfeited'])->default('holding');
            $t->text('rejection_reason')->nullable();
            $t->timestampTz('refunded_at')->nullable();
            $t->jsonb('refund_transaction_details')->nullable();
            $t->timestamps();
        });
        Schema::create('shop_media', function (Blueprint $t) {
            $t->id();
            $t->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $t->enum('media_type', ['image', 'video']);
            $t->string('file_path');
            $t->boolean('is_cover')->default(false);
            $t->timestamps();
        });
        Schema::create('client_notes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $t->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $t->foreignId('author_id')->constrained('users')->restrictOnDelete();
            $t->text('body');
            $t->timestamps();
        });
        Schema::create('booking_events', function (Blueprint $t) {
            $t->id();
            $t->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $t->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('event');
            $t->jsonb('details')->nullable();
            $t->timestampTz('created_at')->useCurrent();
        });
        DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');
        DB::statement("ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (barber_id WITH =, tsrange(booking_date + start_time, booking_date + end_time, '[)') WITH &&) WHERE (status IN ('pending_payment','pending_approval','confirmed'))");
        foreach ([
            'shop_services' => ['price >= 0', 'duration_minutes > 0', 'buffer_minutes >= 0'], 'barber_profiles' => ['experience_years >= 0'],
            'shops' => ['latitude BETWEEN -90 AND 90', 'longitude BETWEEN -180 AND 180'],
            'barber_schedules' => ['day_of_week BETWEEN 0 AND 6', 'slot_interval_minutes > 0', 'end_time > start_time', '(break_start IS NULL AND break_end IS NULL) OR (break_start IS NOT NULL AND break_end IS NOT NULL AND break_start >= start_time AND break_end <= end_time AND break_start < break_end)'],
            'bookings' => ['end_time > start_time', 'total_price >= 0', 'deposit_amount = round(total_price * 0.5, 2)', 'remaining_balance = total_price - deposit_amount'],
            'payments' => ['amount_paid > 0'],
        ] as $table => $checks) {
            foreach ($checks as $i => $check) {
                DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$table}_check_{$i} CHECK ({$check})");
            }
        }
        DB::statement('CREATE UNIQUE INDEX one_shop_cover ON shop_media (shop_id) WHERE is_cover');
        DB::statement("CREATE UNIQUE INDEX one_deposit_per_booking ON payments (booking_id) WHERE type = 'deposit' AND status IN ('holding','verified','refund_pending','refunded','forfeited')");
    }

    public function down(): void
    {
        foreach (['booking_events', 'client_notes', 'shop_media', 'payments', 'booking_items', 'bookings', 'barber_time_off', 'barber_schedules', 'barber_service', 'barber_profiles', 'shop_services', 'shops', 'personal_access_tokens'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('users', function (Blueprint $t) {
            $t->renameColumn('full_name', 'name');
            $t->dropColumn(['phone_number', 'google_id', 'role', 'avatar_path']);
        });
    }
};
