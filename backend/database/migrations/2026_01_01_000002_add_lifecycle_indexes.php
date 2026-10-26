<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("CREATE INDEX expiring_holds ON bookings (locked_until) WHERE status = 'pending_payment'");
        DB::statement("CREATE INDEX expiring_approvals ON bookings (approval_deadline) WHERE status = 'pending_approval'");
        DB::statement('CREATE INDEX customer_history ON bookings (customer_id, booking_date DESC)');
        DB::statement('CREATE INDEX shop_history ON bookings (shop_id, booking_date DESC)');
        DB::statement('CREATE INDEX private_client_notes ON client_notes (author_id, customer_id, shop_id)');
    }

    public function down(): void
    {
        foreach (['expiring_holds', 'expiring_approvals', 'customer_history', 'shop_history', 'private_client_notes'] as $index) {
            DB::statement("DROP INDEX IF EXISTS {$index}");
        }
    }
};
