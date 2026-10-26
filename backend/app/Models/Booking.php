<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['locked_until' => 'datetime', 'approval_deadline' => 'datetime', 'total_price' => 'decimal:2', 'deposit_amount' => 'decimal:2', 'remaining_balance' => 'decimal:2'];

    protected $appends = ['booking_code'];

    public function getBookingCodeAttribute()
    {
        return 'BK-'.str_pad((string) $this->id, 6, '0', STR_PAD_LEFT);
    }

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function barber()
    {
        return $this->belongsTo(BarberProfile::class, 'barber_id');
    }

    public function items()
    {
        return $this->hasMany(BookingItem::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function events()
    {
        return $this->hasMany(BookingEvent::class);
    }
}
