<?php

namespace Database\Seeders;

use App\Models\BarberProfile;
use App\Models\Booking;
use App\Models\Shop;
use App\Models\User;
use Carbon\CarbonImmutable as C;
use Illuminate\Database\Seeder;

class MarketplaceSeeder extends Seeder
{
    public function run(): void
    {
        $owner = User::create(['full_name' => 'Dawit Alemayehu', 'email' => 'owner@chair.test', 'password' => 'ChairDemo2026!', 'role' => 'owner', 'avatar_path' => '/images/owner.jpg']);
        $customers = collect([['Abel Tesfaye', 'customer@chair.test', 'customer-1.jpg'], ['Mekdes Getachew', 'mekdes@chair.test', 'customer-2.jpg'], ['Yonas Bekele', 'yonas@chair.test', 'customer-3.jpg'], ['Sara Tadesse', 'sara@chair.test', 'customer-4.jpg']])->map(fn ($x, $index) => User::create(['full_name' => $x[0], 'email' => $x[1], 'password' => 'ChairDemo2026!', 'role' => 'customer', 'phone_number' => '+25191100000'.$index, 'avatar_path' => '/images/'.$x[2]]));
        $shops = [
            ['The Modern Gentleman', 'the-modern-gentleman', 'Bole, near Edna Mall', 'Precision cuts, considered details, and a little time for yourself. Your neighborhood chair in the heart of Bole.', 9.005401, 38.779900, 'shop-1.jpg'],
            ['Crown & Comb', 'crown-and-comb', 'Kazanchis, near the UNECA', 'Classic craft meets a fresh perspective. Cuts, shaves, and good company.', 9.014300, 38.766200, 'shop-2.jpg'],
            ['District Barber Studio', 'district-barber-studio', 'Sarbet, African Avenue', 'A small studio with a big love for detail. Find your next signature look.', 8.992000, 38.743100, 'shop-3.jpg'],
        ];
        foreach ($shops as $i => $x) {
            $shop = Shop::create(['owner_id' => $owner->id, 'name' => $x[0], 'slug' => $x[1], 'address_line' => $x[2], 'description' => $x[3], 'latitude' => $x[4], 'longitude' => $x[5], 'bank_name' => 'Commercial Bank of Ethiopia', 'bank_account_name' => $x[0], 'bank_account_number' => '1000000000000', 'status' => 'active']);
            $shop->media()->create(['media_type' => 'image', 'file_path' => '/images/'.$x[6], 'is_cover' => true]);
            $services = collect([['Haircut', 350 + $i * 50, 30, 5], ['Beard Trim', 200, 20, 5], ['Haircut & Beard', 500 + $i * 50, 50, 10], ['Wash & Style', 250, 25, 5], ['Hair Coloring', 900, 80, 10]])->map(fn ($s) => $shop->services()->create(['name' => $s[0], 'price' => $s[1], 'duration_minutes' => $s[2], 'buffer_minutes' => $s[3], 'description' => 'A considered finish, tailored to you.']));
            foreach ([['Nahom Girma', 'barber-1.jpg'], ['Samuel Desta', 'barber-2.jpg']] as $j => $person) {
                $u = User::create(['full_name' => $i === 0 ? $person[0] : ['Henok Assefa', 'Robel Kebede', 'Elias Mengistu', 'Biniam Teshome'][($i - 1) * 2 + $j], 'email' => $i === 0 && $j === 0 ? 'barber@chair.test' : "barber{$i}{$j}@chair.test", 'password' => 'ChairDemo2026!', 'role' => 'barber', 'avatar_path' => '/images/'.$person[1]]);
                $p = BarberProfile::create(['user_id' => $u->id, 'shop_id' => $shop->id, 'status' => 'active', 'experience_years' => 5 + $j, 'bio' => 'Specializing in clean fades, textured cuts, and classic grooming.']);
                $p->services()->sync($services->pluck('id'));
                foreach (range(0, 6) as $day) {
                    $p->schedules()->create(['day_of_week' => $day, 'start_time' => '09:00', 'end_time' => '19:00', 'slot_interval_minutes' => 30, 'break_start' => '13:00', 'break_end' => '14:00', 'is_day_off' => false]);
                }
                if ($i !== 0) {
                    continue;
                }
                foreach (range(1, 18) as $n) {
                    $s = $services[($n + $j) % $services->count()];
                    $c = $customers[$n % 4];
                    $total = (float) $s->price;
                    $date = C::now('Africa/Addis_Ababa')->subDays($n)->format('Y-m-d');
                    $start = $j ? '15:00' : '10:00';
                    $end = C::parse("$date $start")->addMinutes($s->duration_minutes + $s->buffer_minutes)->format('H:i');
                    $bk = Booking::create(['customer_id' => $c->id, 'shop_id' => $shop->id, 'barber_id' => $p->id, 'booking_date' => $date, 'start_time' => $start, 'end_time' => $end, 'total_price' => $total, 'deposit_amount' => round($total / 2, 2), 'remaining_balance' => $total - round($total / 2, 2), 'status' => 'completed']);
                    $bk->items()->create(['service_id' => $s->id, 'service_name' => $s->name, 'price' => $s->price, 'duration_minutes' => $s->duration_minutes, 'buffer_minutes' => $s->buffer_minutes]);
                    foreach (['deposit', 'balance'] as $type) {
                        $bk->payments()->create(['amount_paid' => $total / 2, 'type' => $type, 'method' => $type === 'deposit' ? 'bank_transfer' : 'cash', 'reference_code' => "SEED-{$bk->id}-{$type}", 'status' => 'verified']);
                    }
                }
            }
        }
    }
}
