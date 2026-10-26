<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ActiveBarber
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        abort_if($user->role === 'barber' && $user->barberProfile?->status !== 'active', 403, 'Your barber account is not active. Contact your shop owner.');

        return $next($request);
    }
}
