<?php

namespace App\Http\Controllers;

use App\Models\BarberProfile;
use App\Models\Shop;
use App\Services\BookingEngine;
use Illuminate\Http\Request;

class DiscoveryController extends Controller
{
    public function index(Request $r)
    {
        $d = $r->validate(['lat' => 'nullable|numeric|between:-90,90|required_with:lng', 'lng' => 'nullable|numeric|between:-180,180|required_with:lat', 'radius' => 'nullable|numeric|min:1|max:100', 'q' => 'nullable|string|max:100', 'service' => 'nullable|string|max:100']);
        $q = Shop::where('status', 'active')->with(['media', 'services' => fn ($s) => $s->where('is_active', true), 'barbers' => fn ($b) => $b->where('status', 'active')->with('user:id,full_name,avatar_path')]);
        if ($r->filled('q')) {
            $q->where(fn ($x) => $x->where('name', 'ilike', '%'.$d['q'].'%')->orWhere('address_line', 'ilike', '%'.$d['q'].'%')->orWhereHas('services', fn ($s) => $s->where('name', 'ilike', '%'.$d['q'].'%')->where('is_active', true)));
        }
        if ($r->filled('service')) {
            $q->whereHas('services', fn ($s) => $s->where('name', 'ilike', '%'.$d['service'].'%')->where('is_active', true));
        }
        if (isset($d['lat'],$d['lng'])) {
            $distance = '(6371 * 2 * asin(sqrt(least(1.0, greatest(0.0, power(sin(radians(latitude - ?) / 2),2) + cos(radians(?)) * cos(radians(latitude)) * power(sin(radians(longitude - ?) / 2),2))))))';
            $args = [$d['lat'], $d['lat'], $d['lng']];
            $q->select('shops.*')->selectRaw("$distance as distance_km", $args)->whereRaw("$distance <= ?", [...$args, $d['radius'] ?? 15])->orderBy('distance_km');
        } else {
            $q->orderBy('id');
        }

        return $q->paginate(12);
    }

    public function show(Shop $shop)
    {
        abort_unless($shop->status === 'active', 404);

        return $shop->load(['media', 'services' => fn ($q) => $q->where('is_active', true), 'barbers' => fn ($q) => $q->where('status', 'active')->with(['user:id,full_name,avatar_path', 'services', 'schedules'])]);
    }

    public function slots(Request $r, BarberProfile $barber, BookingEngine $engine)
    {
        $d = $r->validate(['date' => 'required|date_format:Y-m-d', 'service_ids' => 'required|array|min:1|max:10', 'service_ids.*' => 'integer|distinct']);
        $engine->reconcile();

        return ['slots' => $engine->slots($barber, $d['date'], $d['service_ids'])];
    }
}
