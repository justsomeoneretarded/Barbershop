<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BarberSchedule extends Model
{
    protected $guarded = ['id'];

    public $timestamps = false;

    protected $casts = ['is_day_off' => 'boolean'];
}
