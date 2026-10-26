import React, { useState } from "react";
import {
  Eye,
  Check,
  X,
  Search,
  ArrowUpRight,
  Plus,
  CalendarDays,
  Wallet,
  Users,
  TrendingUp,
  ReceiptText,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { api, message, money, time, dateInShop } from "../lib/api";
import { useAuth } from "../context/Auth";
import {
  Avatar,
  ErrorBox,
  Loading,
  Empty,
  Modal,
  Receipt,
  Status,
  Field,
  useResource,
} from "../components/UI";
export function Appointments() {
  const [page, setPage] = useState(1),
    [filter, setFilter] = useState("pending_approval"),
    [receipt, setReceipt] = useState(null),
    [decision, setDecision] = useState(null),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  const { data, loading, error, refresh } = useResource(
    "/bookings?page=" + page + (filter === "all" ? "" : "&status=" + filter),
  );
  async function act(e) {
    e.preventDefault();
    setBusy(true);
    setActionError("");
    try {
      const d = Object.fromEntries(new FormData(e.target));
      if (decision.action === "complete")
        await api.post("/bookings/" + decision.b.id + "/complete");
      else
        await api.post("/bookings/" + decision.b.id + "/decision", {
          decision: decision.action,
          reason: d.reason,
        });
      setDecision(null);
      await refresh();
    } catch (e) {
      setActionError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-eyebrow">THE DAY, AT A GLANCE</div>
      <div className="section-heading">
        <div>
          <h1>Appointments</h1>
          <p>A fresh cut starts with a good plan.</p>
        </div>
        <span className="date-label">
          <CalendarDays size={17} />
          {dateInShop()}
        </span>
      </div>
      <div className="tabs">
        {[
          ["pending_approval", "Requests"],
          ["confirmed", "Confirmed"],
          ["completed", "Completed"],
          ["all", "All bookings"],
        ].map(([s, label]) => (
          <button
            key={s}
            className={s === filter ? "active" : ""}
            onClick={() => {
              setFilter(s);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorBox error={error || (!decision && actionError)} />
      {loading ? (
        <Loading />
      ) : !data?.data.length ? (
        <Empty>No appointments in this view.</Empty>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Appointment</th>
                <th>Service</th>
                <th>Deposit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar user={b.customer} />
                      <div>
                        <strong>{b.customer.full_name}</strong>
                        <span>{b.booking_code}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>
                      {b.booking_date} · {time(b.start_time)}
                    </strong>
                    <span className="cell-sub">{b.barber.user.full_name}</span>
                  </td>
                  <td>
                    {b.items.map((i) => i.service_name).join(" + ")}
                    {b.customer_notes && (
                      <span className="cell-sub">{b.customer_notes}</span>
                    )}
                  </td>
                  <td>
                    <strong>{money(b.deposit_amount)}</strong>
                    <span className="cell-sub">
                      {b.payments.find((p) => p.type === "deposit")?.status ||
                        "Not submitted"}
                    </span>
                  </td>
                  <td>
                    <Status value={b.status} />
                  </td>
                  <td>
                    <div className="row-actions">
                      {b.payments
                        .filter(
                          (p) =>
                            p.method === "bank_transfer" &&
                            !p.reference_code.startsWith("SEED-"),
                        )
                        .map((p) => (
                          <button
                            key={p.id}
                            className="icon-button"
                            title="View receipt"
                            onClick={() => setReceipt(p)}
                          >
                            <Eye size={18} />
                          </button>
                        ))}
                      {b.status === "pending_approval" && (
                        <>
                          <button
                            className="icon-button approve"
                            title="Approve booking and verify deposit"
                            onClick={() => {
                              setActionError("");
                              setDecision({ b, action: "approve" });
                            }}
                          >
                            <Check size={18} />
                          </button>
                          <button
                            className="icon-button danger"
                            title="Reject booking"
                            onClick={() => {
                              setActionError("");
                              setDecision({ b, action: "reject" });
                            }}
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}
                      {b.status === "confirmed" && (
                        <button
                          className="button small"
                          onClick={() => {
                            setActionError("");
                            setDecision({ b, action: "complete" });
                          }}
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      {receipt && (
        <Receipt payment={receipt} onClose={() => setReceipt(null)} />
      )}
      {decision && (
        <Modal
          title={
            decision.action === "complete"
              ? "Complete visit & record cash"
              : decision.action === "approve"
                ? "Approve this appointment?"
                : "Reject this appointment?"
          }
          onClose={() => setDecision(null)}
        >
          <form className="form-stack" onSubmit={act}>
            <div className="person-cell">
              <Avatar user={decision.b.customer} />
              <strong>
                {decision.b.customer.full_name} · {decision.b.booking_code}
              </strong>
            </div>
            {decision.action === "approve" && (
              <p>
                Confirm that {money(decision.b.deposit_amount)} has arrived in
                the shop bank account.
              </p>
            )}
            {decision.action === "complete" && (
              <p>
                Cash collected at the shop:{" "}
                <strong>{money(decision.b.remaining_balance)}</strong>
              </p>
            )}
            {decision.action === "reject" && (
              <>
                <p>The deposit will enter the refund queue.</p>
                <Field label="Reason">
                  <textarea name="reason" required maxLength={2000} />
                </Field>
              </>
            )}
            <ErrorBox error={actionError} />
            <button className="button primary" disabled={busy}>
              {busy ? "Saving..." : "Confirm"}
              <Check size={17} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function OwnerShopFilter({ value, onChange }) {
  const { data, error } = useResource("/manage/shops");
  return (
    <div className="owner-shop-filter">
      <ErrorBox error={error} />
      <Field label="Shop">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All my shops</option>
          {data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
export function Clients() {
  const { user } = useAuth();
  const [shopId, setShopId] = useState("");
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState("");
  const {
    data,
    loading,
    error: loadError,
    refresh,
  } = useResource(
    "/clients?q=" + encodeURIComponent(query) + "&shop_id=" + shopId,
  );
  const current = data?.find((c) => c.id === selected?.id) || selected;
  async function note(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/clients/" + current.id + "/notes", {
        body,
        shop_id: current.history[0].shop_id,
      });
      setBody("");
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-eyebrow">GOOD CUTS. LASTING CONNECTIONS.</div>
      {user.role === "owner" && (
        <OwnerShopFilter value={shopId} onChange={setShopId} />
      )}
      <div className="section-heading">
        <div>
          <h1>Your clients</h1>
          <p>Familiar faces, remembered details.</p>
        </div>
        <span className="count-label">{data?.length || 0} clients</span>
      </div>
      <div className="inline-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients"
          aria-label="Search clients"
        />
      </div>
      <ErrorBox error={loadError} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty>No clients found.</Empty>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Visits</th>
                <th>Lifetime spend</th>
                <th>Favorite barber</th>
                <th>Last appointment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar user={c} />
                      <div>
                        <strong>{c.full_name}</strong>
                        <span>{c.phone_number || c.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>{c.visits}</td>
                  <td>
                    <strong>{money(c.lifetime_spend)}</strong>
                  </td>
                  <td>{c.favorite_barber || "—"}</td>
                  <td>
                    {
                      [...c.history].sort((a, b) =>
                        b.booking_date.localeCompare(a.booking_date),
                      )[0]?.booking_date
                    }
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      title={"View " + c.full_name}
                      onClick={() => {
                        setSelected(c);
                        setError("");
                        setBody("");
                      }}
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {current && (
        <Modal title="Client details" wide onClose={() => setSelected(null)}>
          <div className="client-heading">
            <Avatar user={current} size={70} />
            <div>
              <h2>{current.full_name}</h2>
              <p>
                {current.email} · {current.phone_number || "No phone number"}
              </p>
            </div>
          </div>
          <div className="client-stats">
            <div>
              <span>Completed visits</span>
              <strong>{current.visits}</strong>
            </div>
            <div>
              <span>Lifetime spend</span>
              <strong>{money(current.lifetime_spend)}</strong>
            </div>
          </div>
          <h3>Private notes</h3>
          <div className="notes-list">
            {current.notes.map((n) => (
              <p key={n.id}>
                {n.body}
                <span>
                  {new Date(n.created_at).toLocaleDateString()} ·{" "}
                  {n.author.full_name}
                </span>
              </p>
            ))}
          </div>
          <form className="form-stack" onSubmit={note}>
            <Field label="Haircut & styling preferences">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={5000}
                required
                rows={3}
              />
            </Field>
            <ErrorBox error={error} />
            <button className="button primary" disabled={busy}>
              {busy ? "Saving..." : "Save private note"}
              <Plus size={17} />
            </button>
          </form>
          <h3 className="mt">Visit history</h3>
          {current.history.map((b) => (
            <div key={b.id} className="history-row">
              <div>
                <strong>
                  {b.items.map((i) => i.service_name).join(" + ")}
                </strong>
                <span>
                  {b.booking_date} · {b.barber.user.full_name}
                </span>
              </div>
              <Status value={b.status} />
              <strong>{money(b.total_price)}</strong>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}
export function Revenue() {
  const { user } = useAuth();
  const [shopId, setShopId] = useState("");
  const today = dateInShop(),
    [range, setRange] = useState("month"),
    [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today),
    [refund, setRefund] = useState(null),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  const {
    data: d,
    loading,
    error,
    refresh,
  } = useResource(
    "/reports/revenue?from=" + from + "&to=" + to + "&shop_id=" + shopId,
  );
  function choose(v) {
    setRange(v);
    const date = new Date();
    if (v === "day") setFrom(today);
    else if (v === "week")
      setFrom(dateInShop(new Date(date.getTime() - 6 * 86400000)));
    else if (v === "month") setFrom(today.slice(0, 7) + "-01");
    setTo(today);
  }
  async function record(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(
        "/payments/" + refund.id + "/refund",
        Object.fromEntries(new FormData(e.target)),
      );
      setRefund(null);
      await refresh();
    } catch (e) {
      setActionError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-eyebrow">YOUR CRAFT, IN NUMBERS</div>
      {user.role === "owner" && (
        <OwnerShopFilter value={shopId} onChange={setShopId} />
      )}
      <div className="section-heading">
        <div>
          <h1>{user.role === "barber" ? "Your earnings" : "Shop finances"}</h1>
          <p>A clear view of the business behind the chair.</p>
        </div>
        <label className="range-select">
          <CalendarDays size={17} />
          <select value={range} onChange={(e) => choose(e.target.value)}>
            <option value="day">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
      </div>
      {range === "custom" && (
        <div className="date-range">
          <Field label="From">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={to}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from}
            />
          </Field>
        </div>
      )}
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : (
        d && (
          <>
            <div className="metrics">
              {[
                [Wallet, "Completed visit revenue", d.gross_revenue],
                [ReceiptText, "Verified deposits", d.deposits_collected],
                [TrendingUp, "Cash balances due", d.balances_due],
                [Users, "Average ticket", d.average_ticket],
              ].map(([Icon, label, value]) => (
                <div className="metric" key={label}>
                  <div>
                    <span>{label}</span>
                    <Icon size={18} />
                  </div>
                  <strong>{money(value)}</strong>
                </div>
              ))}
            </div>
            <section className="report-section">
              <div className="section-heading">
                <h2>Revenue over time</h2>
                <span className="muted tiny">
                  {d.completed_visits} completed visits
                </span>
              </div>
              {d.daily.length ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={d.daily}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e8ebe9"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(s) => s.slice(5)}
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip formatter={(v) => money(v)} />
                      <Area
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="revenue"
                        stroke="#197a56"
                        fill="#e4f2e9"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty>No completed visits in this date range.</Empty>
              )}
            </section>
            <div className="report-columns">
              <section className="report-section">
                <h2>By barber</h2>
                {d.barbers.length ? (
                  <div className="chart small-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={d.barbers}
                        layout="vertical"
                        margin={{ left: 10, right: 20 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          tick={{ fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip formatter={(v) => money(v)} />
                        <Bar
                          dataKey="revenue"
                          fill="#197a56"
                          barSize={18}
                          radius={[0, 3, 3, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty>No barber revenue yet.</Empty>
                )}
              </section>
              <section className="report-section">
                <h2>Top services</h2>
                {d.services.length ? (
                  d.services.map((s, i) => (
                    <div className="rank-row" key={s.name}>
                      <span className="rank">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{s.name}</strong>
                        <span>{s.count} services</span>
                      </div>
                      <strong>{money(s.revenue)}</strong>
                    </div>
                  ))
                ) : (
                  <Empty>No services in this period.</Empty>
                )}
              </section>
            </div>
            <section className="report-section">
              <h2>Collection & adjustments</h2>
              <div className="adjustments">
                <div>
                  <span>Cash collected</span>
                  <strong>{money(d.cash_collected)}</strong>
                </div>
                <div>
                  <span>Refunds recorded</span>
                  <strong>{money(d.refunds)}</strong>
                </div>
                <div>
                  <span>Refunds pending</span>
                  <strong>{money(d.refunds_pending)}</strong>
                </div>
                <div>
                  <span>Cancelled / rejected / expired value</span>
                  <strong>{money(d.cancelled_value)}</strong>
                </div>
              </div>
            </section>
            {user.role !== "barber" && (
              <section className="report-section">
                <h2>Refund queue</h2>
                {d.refund_queue.length ? (
                  d.refund_queue.map((p) => (
                    <div className="history-row" key={p.id}>
                      <div>
                        <strong>{p.reference_code}</strong>
                        <span>
                          Booking #{p.booking_id} · {p.rejection_reason}
                        </span>
                      </div>
                      <strong>{money(p.amount_paid)}</strong>
                      <button
                        className="button small"
                        onClick={() => {
                          setRefund(p);
                          setActionError("");
                        }}
                      >
                        Record refund
                      </button>
                    </div>
                  ))
                ) : (
                  <Empty>No refunds awaiting action.</Empty>
                )}
              </section>
            )}
          </>
        )
      )}
      {refund && (
        <Modal title="Record completed refund" onClose={() => setRefund(null)}>
          <form className="form-stack" onSubmit={record}>
            <p>
              {money(refund.amount_paid)} · {refund.reference_code}
            </p>
            <Field label="Refund transaction reference">
              <input name="transaction_reference" required maxLength={100} />
            </Field>
            <Field label="Notes">
              <textarea name="notes" maxLength={2000} />
            </Field>
            <ErrorBox error={actionError} />
            <button className="button primary" disabled={busy}>
              {busy ? "Recording..." : "Record refund"}
              <Check size={17} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
