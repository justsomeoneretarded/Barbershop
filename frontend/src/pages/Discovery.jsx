import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  MapPin,
  ArrowUpRight,
  Scissors,
  SlidersHorizontal,
  Navigation,
  Clock,
  ArrowRight,
  Check,
  Brush,
  Sparkles,
  Droplets,
  Heart,
} from "lucide-react";
import { api, message, cover, money } from "../lib/api";
import { Avatar, ErrorBox, Loading, Empty } from "../components/UI";
const categories = [
  ["All services", Scissors],
  ["Haircut", Scissors],
  ["Beard Trim", Brush],
  ["Wash", Droplets],
  ["Coloring", Sparkles],
];
export default function Discovery() {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("All services"),
    [radius, setRadius] = useState(15),
    [coords, setCoords] = useState({ lat: 9.005401, lng: 38.7799 }),
    [locationLabel, setLocationLabel] = useState("Bole, Addis Ababa"),
    [error, setError] = useState(""),
    [shops, setShops] = useState(null),
    [page, setPage] = useState(1),
    [meta, setMeta] = useState({}),
    [busy, setBusy] = useState(false),
    [favorites, setFavorites] = useState(() =>
      JSON.parse(localStorage.getItem("chair_favorites") || "[]"),
    ),
    [onlyFavorites, setOnlyFavorites] = useState(false);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    api
      .get("/shops", {
        params: {
          q: search,
          service: category === "All services" ? "" : category,
          ...coords,
          radius,
          page,
        },
      })
      .then((r) => {
        if (alive) {
          setShops(r.data.data);
          setMeta(r.data);
          setError("");
        }
      })
      .catch((e) => alive && setError(message(e)))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [search, category, radius, coords, page]);
  const locate = () => {
    if (!navigator.geolocation) {
      setError("Location is unavailable in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocationLabel("Your location");
        setPage(1);
      },
      () =>
        setError("Location access is unavailable. Showing shops near Bole."),
    );
  };
  const toggle = (id) => {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("chair_favorites", JSON.stringify(next));
  };
  const visible = shops?.filter(
    (s) => !onlyFavorites || favorites.includes(s.id),
  );
  return (
    <main className="container discover">
      <div className="page-eyebrow">
        <span className="live-dot" /> YOUR NEIGHBORHOOD, WELL GROOMED
      </div>
      <div className="discovery-heading">
        <div>
          <h1>
            Find your next <span>great cut.</span>
          </h1>
          <p>Good barbers. Great spaces. A chair just for you.</p>
        </div>
        <div className="city-stamp">
          <span>9.0054° N / 38.7799° E</span>
          <strong>Made for Addis.</strong>
        </div>
      </div>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
          setPage(1);
        }}
      >
        <div className="search-input">
          <Search size={21} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shops, haircuts, beard trims..."
            aria-label="Search shops and services"
          />
        </div>
        <button
          type="button"
          className="search-location"
          title="Use my current location"
          onClick={locate}
        >
          <MapPin size={19} />
          <span>{locationLabel}</span>
          <Navigation size={15} />
        </button>
        <button className="button primary">
          Find a chair
          <ArrowRight size={18} />
        </button>
      </form>
      <div className="discovery-toolbar">
        <div className="category-tabs">
          {categories.map(([name, Icon]) => (
            <button
              key={name}
              className={category === name ? "active" : ""}
              onClick={() => {
                setCategory(name);
                setPage(1);
              }}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </div>
        <label className="radius">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Search radius"
            value={radius}
            onChange={(e) => {
              setRadius(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={5}>Within 5 km</option>
            <option value={15}>Within 15 km</option>
            <option value={30}>Within 30 km</option>
          </select>
        </label>
      </div>
      <section>
        <div className="section-heading">
          <div>
            <h2>Good places. Close to you.</h2>
            <p>
              {meta.total ?? 0} barbershops around {locationLabel.toLowerCase()}
            </p>
          </div>
          <button
            className={
              "text-button favorite-filter " + (onlyFavorites ? "selected" : "")
            }
            onClick={() => setOnlyFavorites(!onlyFavorites)}
          >
            <Heart size={16} fill={onlyFavorites ? "currentColor" : "none"} />
            {onlyFavorites ? "Saved shops" : "Your favorites"}
          </button>
        </div>
        <ErrorBox error={error} />
        {busy ? (
          <Loading />
        ) : visible?.length ? (
          <div className="shop-grid">
            {visible.map((shop, i) => (
              <article className="shop-card" key={shop.id}>
                <div className="shop-photo-wrap">
                  <Link to={"/shops/" + shop.id}>
                    <img
                      className="shop-photo"
                      src={cover(shop)}
                      alt={shop.name + " barbershop"}
                      loading={i ? "lazy" : "eager"}
                    />
                  </Link>
                  <span className="photo-label">
                    <span className="live-dot" />
                    Taking appointments
                  </span>
                  <button
                    className={
                      "save-button " +
                      (favorites.includes(shop.id) ? "saved" : "")
                    }
                    title={
                      favorites.includes(shop.id)
                        ? "Remove from favorites"
                        : "Save shop"
                    }
                    onClick={() => toggle(shop.id)}
                  >
                    <Heart
                      size={18}
                      fill={
                        favorites.includes(shop.id) ? "currentColor" : "none"
                      }
                    />
                  </button>
                </div>
                <div className="shop-card-body">
                  <div className="shop-name-row">
                    <Link to={"/shops/" + shop.id}>
                      <h3>{shop.name}</h3>
                    </Link>
                    <span className="distance">
                      <MapPin size={13} />
                      {Number(shop.distance_km || 0).toFixed(1)} km
                    </span>
                  </div>
                  <p className="shop-address">{shop.address_line}</p>
                  <div className="service-tags">
                    {shop.services.slice(0, 3).map((s) => (
                      <span key={s.id}>{s.name}</span>
                    ))}
                  </div>
                  <div className="shop-card-bottom">
                    <div>
                      <span className="muted tiny">Services from</span>
                      <strong>
                        {money(
                          Math.min(
                            ...shop.services.map((s) => Number(s.price)),
                          ),
                        )}
                      </strong>
                    </div>
                    <Link className="book-link" to={"/shops/" + shop.id}>
                      Book a visit
                      <ArrowUpRight size={18} />
                    </Link>
                  </div>
                  <div className="barbers-strip">
                    <div className="avatar-stack">
                      {shop.barbers.slice(0, 3).map((b) => (
                        <Avatar key={b.id} user={b.user} size={27} />
                      ))}
                    </div>
                    <span>{shop.barbers.length} barbers to make it yours</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          !error && (
            <Empty>
              {onlyFavorites
                ? "No saved shops in this area."
                : "No shops match your search."}
            </Empty>
          )
        )}
        {meta.last_page > 1 && (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              {page} / {meta.last_page}
            </span>
            <button
              disabled={page === meta.last_page}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </section>
      <section className="barber-feature">
        <div>
          <span className="eyebrow">THE PEOPLE BEHIND THE CUT</span>
          <h2>
            A familiar face.
            <br /> A fresh perspective.
          </h2>
          <p>Find a barber you'll come back to.</p>
        </div>
        <div className="featured-barbers">
          {shops
            ?.flatMap((s) => s.barbers.map((b) => ({ ...b, shop: s })))
            .slice(0, 3)
            .map((b) => (
              <Link
                to={"/shops/" + b.shop.id}
                key={b.id}
                className="featured-barber"
              >
                <Avatar user={b.user} size={75} />
                <strong>{b.user.full_name}</strong>
                <span>{b.shop.name}</span>
                <span className="barber-experience">
                  {b.experience_years} years of craft
                  <ArrowUpRight size={14} />
                </span>
              </Link>
            ))}
        </div>
      </section>
    </main>
  );
}
