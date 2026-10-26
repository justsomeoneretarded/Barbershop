<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShopMedia extends Model
{
    protected $guarded = ['id'];

    protected $table = 'shop_media';

    protected $casts = ['is_cover' => 'boolean'];
}
