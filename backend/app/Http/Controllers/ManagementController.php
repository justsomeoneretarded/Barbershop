<?php

namespace App\Http\Controllers;

use App\Models\BarberProfile;
use App\Models\Shop;
use App\Models\ShopMedia;
use App\Models\ShopService;
use App\Models\User;
use App\Support\Access;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ManagementController extends Controller
{
    public function shops(Request $r)
    {
        return $r->user()->shops()->with('media', 'services', 'barbers.user:id,full_name,avatar_path', 'barbers.services')->get()->makeVisible(['bank_name', 'bank_account_name', 'bank_account_number']);
    }

    public function saveShop(Request $r, ?Shop $shop = null)
    {
        if ($shop?->exists) {
            Access::shop($r->user(), $shop);
        } else {
            abort_unless(in_array($r->user()->role, ['owner', 'admin']), 403);
        }
        $d = $r->validate(['name' => 'required|string|max:100', 'description' => 'nullable|string|max:5000', 'address_line' => 'required|string|max:255', 'city' => 'required|string|max:100', 'timezone' => 'required|timezone', 'latitude' => 'required|numeric|between:-90,90', 'longitude' => 'required|numeric|between:-180,180', 'bank_name' => 'nullable|string|max:100', 'bank_account_name' => 'nullable|string|max:100', 'bank_account_number' => 'nullable|string|max:100', 'status' => 'required|in:active,inactive']);
        if (! $shop?->exists) {
            $shop = new Shop(['owner_id' => $r->user()->id, 'slug' => Str::slug($d['name']).'-'.Str::lower(Str::random(6))]);
        }
        $shop->fill($d)->save();

        return $shop->makeVisible(['bank_name', 'bank_account_name', 'bank_account_number']);
    }

    public function service(Request $r, Shop $shop, ?ShopService $service = null)
    {
        Access::shop($r->user(), $shop);
        abort_if($service?->exists && $service->shop_id !== $shop->id, 404);
        $d = $r->validate(['name' => 'required|string|max:100', 'description' => 'nullable|string|max:1000', 'price' => 'required|numeric|min:1|max:999999.99|decimal:0,2', 'duration_minutes' => 'required|integer|min:5|max:480', 'buffer_minutes' => 'required|integer|min:0|max:120', 'is_active' => 'required|boolean']);
        if ($service?->exists) {
            $service->update($d);

            return $service;
        }

        return $shop->services()->create($d);
    }

    public function media(Request $r, Shop $shop)
    {
        Access::shop($r->user(), $shop);
        $r->validate(['file' => 'required|file|mimes:jpg,jpeg,png,webp,mp4,webm|max:20480', 'is_cover' => 'required|boolean']);

        return DB::transaction(function () use ($r, $shop) {
            Shop::whereKey($shop->id)->lockForUpdate()->first();
            if ($r->boolean('is_cover')) {
                $shop->media()->update(['is_cover' => false]);
            }
            $video = str_starts_with($r->file('file')->getMimeType(), 'video/');
            abort_if($video && $r->boolean('is_cover'), 422, 'Use an image for the cover.');

            return $shop->media()->create(['file_path' => '/storage/'.$r->file('file')->store('shops', 'public'), 'media_type' => $video ? 'video' : 'image', 'is_cover' => $r->boolean('is_cover')]);
        });
    }

    public function deleteMedia(Request $r, ShopMedia $media)
    {
        Access::shop($r->user(), Shop::findOrFail($media->shop_id));
        $media->delete();

        return response()->noContent();
    }

    public function invite(Request $r, Shop $shop)
    {
        Access::shop($r->user(), $shop);
        $d = $r->validate(['email' => 'required|email|max:255', 'full_name' => 'required|string|max:100']);
        $token = Str::random(64);
        $p = DB::transaction(function () use ($d, $shop, $token) {
            $u = User::firstOrCreate(['email' => $d['email']], ['full_name' => $d['full_name'], 'role' => 'barber']);
            abort_unless($u->role === 'barber', 422, 'This account has another role.');
            abort_if((bool) $u->password, 409, 'This barber already has an account. Manage their existing team membership.');
            $p = BarberProfile::firstOrNew(['user_id' => $u->id]);
            abort_if($p->exists && $p->shop_id && $p->shop_id !== $shop->id, 409, 'Barber already belongs to another shop.');
            $p->fill(['shop_id' => $shop->id, 'status' => 'pending_approval', 'invite_token' => hash('sha256', $token), 'invite_expires_at' => now()->addDays(7)])->save();

            return $p;
        });

        return ['barber' => $p->load('user:id,full_name,avatar_path'), 'invite_url' => rtrim(explode(',', env('FRONTEND_URL'))[0], '/').'/invite/'.$token];
    }

    public function acceptInvite(Request $r)
    {
        $d = $r->validate(['token' => 'required|string|size:64', 'password' => 'required|string|min:10|confirmed']);

        return DB::transaction(function () use ($d) {
            $p = BarberProfile::where('invite_token', hash('sha256', $d['token']))->lockForUpdate()->firstOrFail();
            abort_unless($p->invite_expires_at?->isFuture(), 410, 'Invitation expired.');
            $p->user->update(['password' => $d['password']]);
            $p->update(['status' => 'active', 'invite_token' => null, 'invite_expires_at' => null]);
            foreach (range(0, 6) as $day) {
                $p->schedules()->firstOrCreate(['day_of_week' => $day], ['start_time' => '09:00', 'end_time' => '18:00', 'break_start' => '13:00', 'break_end' => '14:00', 'is_day_off' => $day === 0]);
            }
            $p->services()->sync($p->shop->services()->where('is_active', true)->pluck('id'));

            return ['user' => $p->user->load('barberProfile', 'shops'), 'token' => $p->user->createToken('web', ['*'], now()->addDay())->plainTextToken];
        });
    }

    public function team(Request $r, Shop $shop)
    {
        Access::staffShop($r->user(), $shop->id);

        return $shop->barbers()->with('user:id,full_name,avatar_path', 'services', 'schedules')->get();
    }

    public function barber(Request $r, BarberProfile $barber)
    {
        Access::shop($r->user(), $barber->shop);
        $d = $r->validate(['status' => 'required|in:active,inactive,pending_approval', 'service_ids' => 'required|array', 'service_ids.*' => 'integer|distinct']);
        abort_unless($barber->shop->services()->whereIn('id', $d['service_ids'])->count() === count($d['service_ids']), 422);
        $barber->update(['status' => $d['status']]);
        $barber->services()->sync($d['service_ids']);

        return $barber->load('services');
    }

    public function schedules(Request $r, BarberProfile $barber)
    {
        abort_unless($r->user()->id === $barber->user_id || $r->user()->role === 'admin' || ($r->user()->role === 'owner' && $barber->shop->owner_id === $r->user()->id), 403);
        if ($r->isMethod('get')) {
            return $barber->schedules;
        }
        $d = $r->validate(['days' => 'required|array|size:7', 'days.*.day_of_week' => 'required|integer|between:0,6|distinct', 'days.*.start_time' => 'required|date_format:H:i', 'days.*.end_time' => 'required|date_format:H:i', 'days.*.slot_interval_minutes' => 'required|integer|min:5|max:120', 'days.*.break_start' => 'nullable|date_format:H:i', 'days.*.break_end' => 'nullable|date_format:H:i', 'days.*.is_day_off' => 'required|boolean']);
        foreach ($d['days'] as $s) {
            abort_unless($s['end_time'] > $s['start_time'], 422, 'Closing time must follow opening time.');
            $a = $s['break_start'] ?? null;
            $z = $s['break_end'] ?? null;
            abort_unless((! $a && ! $z) || ($a && $z && $a >= $s['start_time'] && $z <= $s['end_time'] && $z > $a), 422, 'Break must fit within the working day.');
        }
        DB::transaction(function () use ($d, $barber) {
            foreach ($d['days'] as $s) {
                $barber->schedules()->updateOrCreate(['day_of_week' => $s['day_of_week']], $s);
            }
        });

        return $barber->fresh()->schedules;
    }

    public function timeOff(Request $r, BarberProfile $barber)
    {
        abort_unless($r->user()->id === $barber->user_id || ($r->user()->role === 'owner' && $barber->shop->owner_id === $r->user()->id), 403);
        if ($r->isMethod('get')) {
            return DB::table('barber_time_off')->where('barber_id', $barber->id)->orderBy('date')->get();
        }
        $d = $r->validate(['date' => 'required|date_format:Y-m-d', 'reason' => 'nullable|string|max:200', 'remove' => 'sometimes|boolean']);
        if ($r->boolean('remove')) {
            DB::table('barber_time_off')->where('barber_id', $barber->id)->where('date', $d['date'])->delete();
        } else {
            DB::table('barber_time_off')->updateOrInsert(['barber_id' => $barber->id, 'date' => $d['date']], ['reason' => $d['reason'] ?? null, 'created_at' => now(), 'updated_at' => now()]);
        }

        return ['saved' => true];
    }
}
