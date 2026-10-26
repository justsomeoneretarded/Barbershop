import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Scissors,
  ArrowRight,
  Check,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "../context/Auth";
import { api, message, cover, money, dateInShop } from "../lib/api";
import {
  Avatar,
  Loading,
  ErrorBox,
  Empty,
  useResource,
  Field,
} from "../components/UI";
export default function Shop({ openAuth }) {
  const { id } = useParams(),
    navigate = useNavigate(),
    { user } = useAuth();
  const { data: shop, loading, error } = useResource("/shops/" + id);
  const [selected, setSelected] = useState([]),
    [barber, setBarber] = useState(null),
    [date, setDate] = useState(dateInShop(new Date(Date.now() + 86400000))),
    [slots, setSlots] = useState([]),
    [slot, setSlot] = useState(""),
    [slotLoading, setSlotLoading] = useState(false),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false),
    [notes, setNotes] = useState("");
  useEffect(() => {
    if (shop?.barbers.length && !barber) setBarber(shop.barbers[0]);
  }, [shop]);
  useEffect(() => {
    setSlot("");
    setSlots([]);
    if (!barber || !selected.length) return;
    let alive = true;
    setSlotLoading(true);
    api
      .get("/barbers/" + barber.id + "/slots", {
        params: { date, service_ids: selected },
      })
      .then((r) => {
        if (alive) {
          setSlots(r.data.slots);
          setActionError("");
        }
      })
      .catch((e) => alive && setActionError(message(e)))
      .finally(() => alive && setSlotLoading(false));
    return () => {
      alive = false;
    };
  }, [barber, date, selected]);
  if (loading) return <Loading />;
  if (error)
    return (
      <main className="container">
        <ErrorBox error={error} />
      </main>
    );
  const services = shop.services.filter((s) => selected.includes(s.id)),
    total = services.reduce((n, s) => n + Number(s.price), 0),
    duration = services.reduce(
      (n, s) => n + s.duration_minutes + s.buffer_minutes,
      0,
    );
  async function hold() {
    if (!user) {
      openAuth();
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const r = await api.post("/bookings", {
        barber_id: barber.id,
        booking_date: date,
        start_time: slot,
        service_ids: selected,
        customer_notes: notes,
      });
      navigate("/checkout/" + r.data.id);
    } catch (e) {
      setActionError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container shop-detail">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} />
        All barbershops
      </Link>
      <div className="shop-banner">
        <img src={cover(shop)} alt={shop.name} />
        <div>
          <span className="eyebrow">YOUR NEXT FAVORITE CHAIR</span>
          <h1>{shop.name}</h1>
          <p>
            <MapPin size={16} />
            {shop.address_line}, {shop.city}
          </p>
        </div>
      </div>
      <div className="booking-layout">
        <div className="booking-main">
          <p className="shop-description">{shop.description}</p>
          <section className="booking-section">
            <h2>
              <span>01</span>Make it your own
            </h2>
            <div className="service-list">
              {shop.services.map((s) => (
                <label
                  key={s.id}
                  className={
                    "service-option " +
                    (selected.includes(s.id) ? "chosen" : "")
                  }
                >
                  <input
                    type="checkbox"
                    disabled={
                      !!barber &&
                      !barber.services.some((service) => service.id === s.id)
                    }
                    checked={selected.includes(s.id)}
                    onChange={() =>
                      setSelected(
                        selected.includes(s.id)
                          ? selected.filter((x) => x !== s.id)
                          : [...selected, s.id],
                      )
                    }
                  />
                  <div>
                    <strong>{s.name}</strong>
                    <span>
                      {s.duration_minutes} min · {s.buffer_minutes} min buffer
                    </span>
                  </div>
                  <strong>{money(s.price)}</strong>
                </label>
              ))}
            </div>
          </section>
          <section className="booking-section">
            <h2>
              <span>02</span>Choose your barber
            </h2>
            <div className="barber-options">
              {shop.barbers.map((b) => (
                <label
                  key={b.id}
                  className={
                    "barber-option " + (barber?.id === b.id ? "chosen" : "")
                  }
                >
                  <input
                    type="radio"
                    name="barber"
                    checked={barber?.id === b.id}
                    onChange={() => {
                      setBarber(b);
                      setSelected(
                        selected.filter((id) =>
                          b.services.some((s) => s.id === id),
                        ),
                      );
                    }}
                  />
                  <Avatar user={b.user} size={55} />
                  <strong>{b.user.full_name}</strong>
                  <span>{b.experience_years} years experience</span>
                </label>
              ))}
            </div>
            {barber && <p className="muted">{barber.bio}</p>}
          </section>
          <section className="booking-section">
            <h2>
              <span>03</span>A little time for you
            </h2>
            <Field label={"Appointment date · " + shop.timezone}>
              <input
                type="date"
                value={date}
                min={dateInShop()}
                max={dateInShop(new Date(Date.now() + 90 * 86400000))}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            {!selected.length ? (
              <Empty>Select a service to see available appointments.</Empty>
            ) : slotLoading ? (
              <Loading />
            ) : slots.length ? (
              <div className="slot-grid">
                {slots.map((s) => (
                  <button
                    key={s.start_time}
                    onClick={() => setSlot(s.start_time)}
                    className={slot === s.start_time ? "active" : ""}
                  >
                    {s.start_time}
                  </button>
                ))}
              </div>
            ) : (
              <Empty>No appointments available for this day.</Empty>
            )}
          </section>
          <Field label="Anything your barber should know?">
            <textarea
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Your preferred style, or a special request"
              rows={3}
            />
          </Field>
        </div>
        <aside className="booking-summary">
          <h2>Your visit</h2>
          <p className="muted">{shop.name}</p>
          {services.map((s) => (
            <div className="summary-row" key={s.id}>
              <span>{s.name}</span>
              <strong>{money(s.price)}</strong>
            </div>
          ))}
          <div className="summary-row">
            <span>
              <Clock size={15} />
              Time reserved
            </span>
            <strong>{duration} min</strong>
          </div>
          {barber && (
            <div className="summary-barber">
              <Avatar user={barber.user} size={36} />
              <div>
                <strong>{barber.user.full_name}</strong>
                <span>
                  {date}
                  {slot ? " · " + slot : ""}
                </span>
              </div>
            </div>
          )}
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="summary-row">
            <span>50% deposit</span>
            <strong>{money(Math.round(total * 50) / 100)}</strong>
          </div>
          <ErrorBox error={actionError} />
          <button
            className="button primary full"
            disabled={
              !selected.length ||
              !slot ||
              busy ||
              (user && user.role !== "customer")
            }
            onClick={hold}
          >
            {busy ? "Reserving..." : "Reserve this chair"}
            <ArrowRight size={18} />
          </button>
          <p className="summary-footnote">
            10-minute reservation · Pay 50% to request approval
          </p>
        </aside>
      </div>
    </main>
  );
}
