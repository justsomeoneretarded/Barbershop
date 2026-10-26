<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $r)
    {
        $d = $r->validate(['full_name' => 'required|string|max:100', 'email' => 'required|email|max:255|unique:users', 'phone_number' => 'nullable|string|max:30|unique:users', 'password' => 'required|string|min:10|confirmed']);
        $role = $r->validate(['role' => 'sometimes|in:customer,owner']);
        $u = User::create([...$d, 'role' => $role['role'] ?? 'customer']);

        return response()->json(['user' => $u, 'token' => $u->createToken('web', ['*'], now()->addDay())->plainTextToken], 201);
    }

    public function login(Request $r)
    {
        $d = $r->validate(['email' => 'required|email', 'password' => 'required|string']);
        $u = User::where('email', $d['email'])->first();
        abort_unless($u && $u->password && Hash::check($d['password'], $u->password), 422, 'The email or password is incorrect.');

        return ['user' => $u->load('barberProfile', 'shops'), 'token' => $u->createToken('web', ['*'], now()->addDay())->plainTextToken];
    }

    public function me(Request $r)
    {
        return $r->user()->load('barberProfile', 'shops');
    }

    public function logout(Request $r)
    {
        $r->user()->currentAccessToken()?->delete();

        return response()->noContent();
    }

    public function profile(Request $r)
    {
        $d = $r->validate(['full_name' => 'sometimes|required|string|max:100', 'phone_number' => 'nullable|string|max:30|unique:users,phone_number,'.$r->user()->id, 'avatar' => 'nullable|image|mimes:jpeg,png,webp|max:4096']);
        unset($d['avatar']);
        if ($r->hasFile('avatar')) {
            $d['avatar_path'] = '/storage/'.$r->file('avatar')->store('avatars', 'public');
        }
        $r->user()->update($d);

        return $r->user();
    }
}
