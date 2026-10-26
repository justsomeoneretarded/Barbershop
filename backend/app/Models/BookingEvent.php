<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingEvent extends Model
{
    protected $guarded = ['id'];

    public $timestamps = false;

    protected $casts = ['details' => 'array'];
}
