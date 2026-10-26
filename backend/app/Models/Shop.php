<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Shop extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['bank_name', 'bank_account_name', 'bank_account_number'];

    public function services()
    {
        return $this->hasMany(ShopService::class);
    }

    public function barbers()
    {
        return $this->hasMany(BarberProfile::class);
    }

    public function media()
    {
        return $this->hasMany(ShopMedia::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }
}
