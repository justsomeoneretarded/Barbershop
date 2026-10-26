<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientNote extends Model
{
    protected $guarded = ['id'];

    public function author()
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
