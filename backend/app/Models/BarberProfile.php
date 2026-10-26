<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BarberProfile extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['invite_token'];

    protected $casts = ['invite_expires_at' => 'datetime'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function services()
    {
        return $this->belongsToMany(ShopService::class, 'barber_service', 'barber_id', 'service_id');
    }

    public function schedules()
    {
        return $this->hasMany(BarberSchedule::class, 'barber_id');
    }
}
