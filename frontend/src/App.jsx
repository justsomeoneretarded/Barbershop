import React, { useState, lazy, Suspense } from "react";
import {
  Routes,
  Route,
  NavLink,
  Link,
  useNavigate,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  Scissors,
  MapPin,
  ChevronDown,
  ArrowUpRight,
  LogOut,
  UserRound,
  CalendarDays,
  Compass,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "./context/Auth";
import { Avatar, Modal, ErrorBox, Field, Loading } from "./components/UI";
import { api, message } from "./lib/api";
import Discovery from "./pages/Discovery";
import Shop from "./pages/Shop";
import { Checkout, Bookings } from "./pages/Bookings";
const Portal = lazy(() => import("./pages/Portal"));
export function AuthModal({ onClose }) {
  const { authenticate } = useAuth(),
    navigate = useNavigate();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const u = await authenticate(
        register ? "/auth/register" : "/auth/login",
        data,
      );
      onClose();
      if (u.role !== "customer") navigate("/portal");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        register ? "Your next great cut starts here" : "Good to see you again"
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <ErrorBox error={error} />
        {register && (
          <Field label="Account type">
            <select name="role" defaultValue="customer">
              <option value="customer">Customer</option>
              <option value="owner">Shop owner</option>
            </select>
          </Field>
        )}
        {register && (
          <Field label="Full name">
            <input name="full_name" required autoComplete="name" />
          </Field>
        )}
        <Field label="Email address">
          <input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            minLength={register ? 10 : 1}
            required
            autoComplete={register ? "new-password" : "current-password"}
          />
        </Field>
        {register && (
          <Field label="Confirm password">
            <input
              name="password_confirmation"
              type="password"
              minLength={10}
              required
              autoComplete="new-password"
            />
          </Field>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Please wait..." : register ? "Create account" : "Sign in"}
          <ArrowUpRight size={18} />
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "New to Chair? Create an account"}
        </button>
      </form>
    </Modal>
  );
}
function Profile({ onClose }) {
  const { user, setUser } = useAuth();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      setUser((await api.post("/profile", new FormData(e.target))).data);
      setSaved(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Your profile" onClose={onClose}>
      <form onSubmit={save} className="form-stack">
        <Avatar user={user} size={80} />
        <ErrorBox error={error} />
        {saved && (
          <p className="success" role="status">
            Profile updated.
          </p>
        )}
        <Field label="Profile photo">
          <input
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp"
          />
        </Field>
        <Field label="Full name">
          <input name="full_name" defaultValue={user.full_name} required />
        </Field>
        <Field label="Phone number">
          <input name="phone_number" defaultValue={user.phone_number || ""} />
        </Field>
        <button className="button primary" disabled={busy}>
          {busy ? "Saving..." : "Save profile"}
        </button>
      </form>
    </Modal>
  );
}
function RequireAuth({ children, staff = false }) {
  const { user, loading } = useAuth();
  const [auth, setAuth] = useState(false);
  if (loading) return <Loading />;
  if (!user)
    return (
      <main className="container auth-required">
        <UserRound size={32} />
        <h1>A chair with your name on it.</h1>
        <button className="button primary" onClick={() => setAuth(true)}>
          Sign in
        </button>
        {auth && <AuthModal onClose={() => setAuth(false)} />}
      </main>
    );
  if (staff && !["barber", "owner", "admin"].includes(user.role))
    return <Navigate to="/" />;
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
function Invite() {
  const token = useLocation().pathname.split("/").pop();
  const { authenticate } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  return (
    <main className="container narrow">
      <h1>Join the team</h1>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await authenticate("/invites/accept", {
              token,
              ...Object.fromEntries(new FormData(e.target)),
            });
            navigate("/portal");
          } catch (e) {
            setError(message(e));
          }
        }}
      >
        <ErrorBox error={error} />
        <Field label="Choose a password">
          <input name="password" type="password" minLength={10} required />
        </Field>
        <Field label="Confirm password">
          <input
            name="password_confirmation"
            type="password"
            minLength={10}
            required
          />
        </Field>
        <button className="button primary">Accept invitation</button>
      </form>
    </main>
  );
}
export default function App() {
  const { user, logout } = useAuth();
  const [auth, setAuth] = useState(false),
    [profile, setProfile] = useState(false),
    [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const portal = location.pathname.startsWith("/portal");
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">
            <span className="brand-symbol">
              <Scissors size={25} />
            </span>
            chair<span className="brand-dot">.</span>
          </Link>
          <nav className="desktop-nav">
            <NavLink to="/" end>
              <Compass size={17} />
              Discover
            </NavLink>
            <NavLink to="/bookings">
              <CalendarDays size={17} />
              My bookings
            </NavLink>
            {user && user.role !== "customer" && (
              <NavLink to="/portal">
                Workspace
                <ArrowUpRight size={15} />
              </NavLink>
            )}
          </nav>
          <div className="header-right">
            <span className="location">
              <MapPin size={16} />
              Addis Ababa
            </span>
            {user ? (
              <>
                <button
                  className="profile-button"
                  onClick={() => setProfile(true)}
                  title="Edit profile"
                >
                  <Avatar user={user} size={34} />
                  <span>{user.full_name.split(" ")[0]}</span>
                </button>
                <button
                  className="icon-button logout"
                  title="Sign out"
                  onClick={async () => {
                    await logout();
                    navigate("/");
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button
                className="button small sign-in"
                onClick={() => setAuth(true)}
              >
                Sign in
                <ArrowUpRight size={16} />
              </button>
            )}
            <button
              className="icon-button mobile-menu"
              title={menu ? "Close navigation" : "Open navigation"}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav" onClick={() => setMenu(false)}>
            <Link to="/">Discover</Link>
            <Link to="/bookings">My bookings</Link>
            {user && user.role !== "customer" && (
              <Link to="/portal">Workspace</Link>
            )}
            {user && (
              <button
                onClick={async () => {
                  await logout();
                  navigate("/");
                }}
              >
                Sign out
              </button>
            )}
          </nav>
        )}
      </header>
      <Routes>
        <Route path="/" element={<Discovery />} />
        <Route
          path="/shops/:id"
          element={<Shop openAuth={() => setAuth(true)} />}
        />
        <Route
          path="/checkout/:id"
          element={
            <RequireAuth>
              <Checkout />
            </RequireAuth>
          }
        />
        <Route
          path="/bookings"
          element={
            <RequireAuth>
              <Bookings />
            </RequireAuth>
          }
        />
        <Route
          path="/portal/*"
          element={
            <RequireAuth staff>
              <Portal />
            </RequireAuth>
          }
        />
        <Route path="/invite/:token" element={<Invite />} />
        <Route
          path="*"
          element={
            <main className="container">
              <h1>Page not found</h1>
              <Link to="/">Back to discovery</Link>
            </main>
          }
        />
      </Routes>
      {!portal && (
        <footer className="footer container">
          <span className="footer-brand">
            <Scissors size={17} /> Good hair. Good company.
          </span>
          <span>
            Addis Ababa, Ethiopia <span className="footer-separator">/</span>{" "}
            Chair © {new Date().getFullYear()}
          </span>
        </footer>
      )}
      {auth && <AuthModal onClose={() => setAuth(false)} />}{" "}
      {profile && <Profile onClose={() => setProfile(false)} />}
    </>
  );
}
