<?php

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/tasks.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        //
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (QueryException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            if (in_array($e->getCode(), ['23505', '23P01'])) {
                return response()->json(['message' => 'This reference or appointment is already in use. Please refresh and try again.'], 409);
            }
        });
    })->create();
