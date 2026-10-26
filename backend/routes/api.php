<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\DiscoveryController;
use App\Http\Controllers\ManagementController;
use App\Http\Controllers\ReportsController;
use App\Http\Middleware\ActiveBarber;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:api')->group(function () {
    Route::get('shops', [DiscoveryController::class, 'index']);
    Route::get('shops/{shop}', [DiscoveryController::class, 'show']);
    Route::get('barbers/{barber}/slots', [DiscoveryController::class, 'slots']);
    Route::middleware('throttle:auth')->group(function () {
        Route::post('auth/login', [AuthController::class, 'login']);
        Route::post('auth/register', [AuthController::class, 'register']);
        Route::post('invites/accept', [ManagementController::class, 'acceptInvite']);
    });
    Route::middleware(['auth:sanctum', ActiveBarber::class])->group(function () {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('profile', [AuthController::class, 'profile']);
        Route::get('bookings', [BookingController::class, 'index']);
        Route::post('bookings', [BookingController::class, 'store']);
        Route::get('bookings/{booking}', [BookingController::class, 'show']);
        Route::post('bookings/{booking}/payment', [BookingController::class, 'payment']);
        Route::post('bookings/{booking}/decision', [BookingController::class, 'decide']);
        Route::post('bookings/{booking}/cancel', [BookingController::class, 'cancel']);
        Route::post('bookings/{booking}/complete', [BookingController::class, 'complete']);
        Route::get('payments/{payment}/receipt', [BookingController::class, 'receipt']);
        Route::post('payments/{payment}/refund', [BookingController::class, 'refund']);
        Route::get('manage/shops', [ManagementController::class, 'shops']);
        Route::post('manage/shops', [ManagementController::class, 'saveShop']);
        Route::put('manage/shops/{shop}', [ManagementController::class, 'saveShop']);
        Route::post('manage/shops/{shop}/services', [ManagementController::class, 'service']);
        Route::put('manage/shops/{shop}/services/{service}', [ManagementController::class, 'service']);
        Route::post('manage/shops/{shop}/media', [ManagementController::class, 'media']);
        Route::delete('manage/media/{media}', [ManagementController::class, 'deleteMedia']);
        Route::get('manage/shops/{shop}/team', [ManagementController::class, 'team']);
        Route::post('manage/shops/{shop}/invite', [ManagementController::class, 'invite']);
        Route::put('manage/barbers/{barber}', [ManagementController::class, 'barber']);
        Route::match(['get', 'put'], 'manage/barbers/{barber}/schedules', [ManagementController::class, 'schedules']);
        Route::match(['get', 'post'], 'manage/barbers/{barber}/time-off', [ManagementController::class, 'timeOff']);
        Route::get('clients', [ReportsController::class, 'clients']);
        Route::post('clients/{customer}/notes', [ReportsController::class, 'note']);
        Route::get('reports/revenue', [ReportsController::class, 'revenue']);
    });
});
