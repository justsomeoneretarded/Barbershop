<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return ['service' => 'Chair API', 'version' => '1.0.0', 'endpoints' => '/api'];
});
