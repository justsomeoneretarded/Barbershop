import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  Clock,
  Upload,
  ArrowLeft,
  CheckCircle2,
  CalendarDays,
  ArrowUpRight,
  Copy,
} from "lucide-react";
import { api, message, money, time, cover } from "../lib/api";
import {
  useResource,
  Loading,
  ErrorBox,
  Empty,
  Status,
  Avatar,
  Field,
  Modal,
} from "../components/UI";
export function Checkout() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { data: b, loading, error, refresh } = useResource("/bookings/" + id);
  const [now, setNow] = useState(Date.now()),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState(null),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!b || b.status !== "pending_payment") return;
    const remaining = Date.parse(b.locked_until) - Date.now();
    if (remaining <= 0) return;
    const t = setTimeout(refresh, remaining + 1000);
    return () => clearTimeout(t);
  }, [b?.locked_until]);
  if (loading) return <Loading />;
  if (error)
    return (
      <main className="container">
        <ErrorBox error={error} />
      </main>
    );
  const seconds = Math.max(
      0,
      Math.ceil((Date.parse(b.locked_until) - now) / 1000),
    ),
    expired = b.status === "pending_payment" && !seconds;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const form = new FormData(e.target);
      await api.post("/bookings/" + id + "/payment", form);
      await refresh();
    } catch (e) {
      setActionError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (b.status !== "pending_payment" || expired)
    return (
      <main className="container narrow checkout-result">
        <CheckCircle2 size={42} />
        <h1>
          {b.status === "pending_approval"
            ? "Request sent. Looking sharp."
            : b.status === "confirmed"
              ? "Your chair is confirmed."
              : "Your booking"}
        </h1>
        <Status value={expired ? "expired" : b.status} />
        <p>
          {b.booking_code} · {b.shop.name}
        </p>
        <p>
          {b.booking_date} · {time(b.start_time)} with {b.barber.user.full_name}
        </p>
        <Link className="button primary" to="/bookings">
          View my bookings
          <ArrowUpRight size={17} />
        </Link>
      </main>
    );
  return (
    <main className="container checkout">
      <Link to={"/shops/" + b.shop_id} className="back-link">
        <ArrowLeft size={16} />
        Back to shop
      </Link>
      <div className="page-eyebrow">ONE STEP CLOSER TO A FRESH CUT</div>
      <div className="section-heading">
        <h1>Make it official.</h1>
        <span className={"hold-timer " + (seconds < 60 ? "urgent" : "")}>
          <Clock size={18} />
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}{" "}
          remaining
        </span>
      </div>
      <div className="booking-layout">
        <div>
          <section className="booking-section">
            <h2>
              <span>01</span>Send your deposit
            </h2>
            <div className="bank-details">
              <div className="summary-row">
                <span>Bank</span>
                <strong>{b.shop.bank_name || "Not provided"}</strong>
              </div>
              <div className="summary-row">
                <span>Account name</span>
                <strong>{b.shop.bank_account_name || "Not provided"}</strong>
              </div>
              <div className="summary-row">
                <span>Account number</span>
                <strong>
                  {b.shop.bank_account_number || "Not provided"}
                  <button
                    title="Copy account number"
                    className="icon-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          b.shop.bank_account_number,
                        );
                        setCopied(true);
                      } catch {
                        setActionError("Clipboard access is unavailable.");
                      }
                    }}
                  >
                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  </button>
                </strong>
              </div>
              <div className="summary-total">
                <span>Deposit to transfer</span>
                <strong>{money(b.deposit_amount)}</strong>
              </div>
            </div>
          </section>
          <form onSubmit={submit} className="form-stack">
            <h2>
              <span className="step-number">02</span>Submit payment receipt
            </h2>
            <Field label="Transaction reference">
              <input
                name="reference_code"
                required
                minLength={5}
                maxLength={80}
                pattern="[A-Za-z0-9-]{5,80}"
                placeholder="Bank transaction reference"
              />
            </Field>
            <label className="upload-area">
              <Upload size={28} />
              <strong>{file?.name || "Choose receipt image"}</strong>
              <span>JPG, PNG or WebP · Up to 5 MB</span>
              <input
                type="file"
                name="receipt"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(e) => setFile(e.target.files[0])}
              />
            </label>
            <ErrorBox error={actionError} />
            <button className="button primary" disabled={busy || expired}>
              {busy ? "Submitting..." : "Submit for approval"}
              <ArrowUpRight size={18} />
            </button>
          </form>
        </div>
        <aside className="booking-summary">
          <img
            className="summary-photo"
            src={cover(b.shop)}
            alt={b.shop.name}
          />
          <h2>{b.shop.name}</h2>
          <p className="muted">{b.booking_code}</p>
          <div className="summary-barber">
            <Avatar user={b.barber.user} size={42} />
            <div>
              <strong>{b.barber.user.full_name}</strong>
              <span>
                {b.booking_date} · {time(b.start_time)}
              </span>
            </div>
          </div>
          {b.items.map((i) => (
            <div className="summary-row" key={i.id}>
              <span>{i.service_name}</span>
              <strong>{money(i.price)}</strong>
            </div>
          ))}
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(b.total_price)}</strong>
          </div>
          <div className="summary-row">
            <span>Deposit now</span>
            <strong>{money(b.deposit_amount)}</strong>
          </div>
          <div className="summary-row">
            <span>At the shop</span>
            <strong>{money(b.remaining_balance)}</strong>
          </div>
        </aside>
      </div>
    </main>
  );
}
export function Bookings() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useResource(
    "/bookings?page=" + page,
  );
  const [filter, setFilter] = useState("upcoming"),
    [cancel, setCancel] = useState(null),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  const rows = data?.data.filter(
    (b) =>
      filter === "all" ||
      (filter === "upcoming"
        ? ["pending_payment", "pending_approval", "confirmed"].includes(
            b.status,
          )
        : !["pending_payment", "pending_approval", "confirmed"].includes(
            b.status,
          )),
  );
  return (
    <main className="container bookings-page">
      <div className="page-eyebrow">A LITTLE TIME FOR YOURSELF</div>
      <div className="section-heading">
        <div>
          <h1>Your time. Your chair.</h1>
          <p>Your next visit and the cuts worth coming back for.</p>
        </div>
        <Link className="button primary" to="/">
          Book a visit
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="tabs">
        {["upcoming", "past", "all"].map((x) => (
          <button
            key={x}
            className={filter === x ? "active" : ""}
            onClick={() => setFilter(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <ErrorBox error={error || actionError} />
      {loading ? (
        <Loading />
      ) : rows?.length ? (
        <div className="booking-list">
          {rows.map((b) => (
            <article className="booking-row" key={b.id}>
              <img src={cover(b.shop)} alt={b.shop.name} />
              <div className="booking-row-main">
                <div className="row-between">
                  <span className="tiny muted">{b.booking_code}</span>
                  <Status value={b.status} />
                </div>
                <h2>{b.shop.name}</h2>
                <p>{b.items.map((i) => i.service_name).join(" + ")}</p>
                <div className="booking-meta">
                  <span>
                    <CalendarDays size={15} />
                    {b.booking_date} · {time(b.start_time)}
                  </span>
                  <span>
                    <Avatar user={b.barber.user} size={23} />
                    {b.barber.user.full_name}
                  </span>
                </div>
              </div>
              <div className="booking-row-actions">
                <strong>{money(b.total_price)}</strong>
                {b.status === "pending_payment" && (
                  <Link
                    className="button primary small"
                    to={"/checkout/" + b.id}
                  >
                    Continue payment
                  </Link>
                )}
                {["pending_payment", "pending_approval", "confirmed"].includes(
                  b.status,
                ) && (
                  <button
                    className="text-button danger"
                    onClick={() => setCancel(b)}
                  >
                    Cancel booking
                  </button>
                )}
                {b.payments.some((p) => p.status === "refund_pending") && (
                  <span className="tiny muted">Refund pending</span>
                )}
                {b.payments.some((p) => p.status === "refunded") && (
                  <span className="tiny muted">Refund recorded</span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty>No {filter === "all" ? "" : filter} bookings yet.</Empty>
      )}
      {data?.last_page > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            {page} / {data.last_page}
          </span>
          <button
            disabled={page === data.last_page}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
      {cancel && (
        <Modal title="Cancel this booking?" onClose={() => setCancel(null)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api.post("/bookings/" + cancel.id + "/cancel", {
                  reason: new FormData(e.target).get("reason"),
                });
                setCancel(null);
                await refresh();
              } catch (e) {
                setActionError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              {cancel.booking_code} · {cancel.shop.name}
            </p>
            <Field label="Cancellation reason">
              <textarea name="reason" required maxLength={2000} />
            </Field>
            <button className="button danger-button" disabled={busy}>
              {busy ? "Cancelling..." : "Cancel booking"}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
