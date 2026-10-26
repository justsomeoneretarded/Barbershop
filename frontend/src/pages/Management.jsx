import React, { useEffect, useState } from "react";
import {
  Plus,
  Save,
  Upload,
  Trash2,
  Copy,
  Check,
  Clock,
  CalendarDays,
  Scissors,
  UserRoundPlus,
  Link as LinkIcon,
} from "lucide-react";
import { api, message, money, time } from "../lib/api";
import { useAuth } from "../context/Auth";
import {
  useResource,
  Avatar,
  Loading,
  ErrorBox,
  Empty,
  Field,
  Modal,
  Status,
} from "../components/UI";
function useShops() {
  const r = useResource("/manage/shops");
  const [id, setId] = useState("");
  useEffect(() => {
    if (r.data?.length && !id) setId(String(r.data[0].id));
  }, [r.data]);
  return { ...r, shop: r.data?.find((s) => String(s.id) === id), id, setId };
}
function ShopPicker({ data, id, setId }) {
  return data?.length > 1 ? (
    <label className="shop-picker">
      <span>Shop</span>
      <select value={id} onChange={(e) => setId(e.target.value)}>
        {data.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  ) : null;
}
export function ShopEditor() {
  const { data, shop, id, setId, loading, error, refresh } = useShops();
  const [actionError, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [creating, setCreating] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = Object.fromEntries(new FormData(e.target));
      const response =
        creating || !shop
          ? await api.post("/manage/shops", d)
          : await api.put("/manage/shops/" + shop.id, d);
      await refresh();
      setId(String(response.data.id));
      setCreating(false);
      setSaved(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function media(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(
        "/manage/shops/" + shop.id + "/media",
        new FormData(e.target),
      );
      e.target.reset();
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const item = creating ? null : shop;
  return (
    <>
      <div className="page-eyebrow">YOUR SPACE, YOUR STORY</div>
      <div className="section-heading">
        <div>
          <h1>Shop profile</h1>
          <p>The details that make your shop yours.</p>
        </div>
        <button
          className="button small"
          onClick={() => {
            setCreating(true);
            setSaved(false);
          }}
        >
          <Plus size={16} />
          Add shop
        </button>
      </div>
      <ShopPicker
        data={data}
        id={id}
        setId={(v) => {
          setId(v);
          setCreating(false);
        }}
      />
      <ErrorBox error={error || actionError} />
      {saved && (
        <p className="success" role="status">
          Shop profile saved.
        </p>
      )}
      {loading ? (
        <Loading />
      ) : (
        <>
          <form
            key={creating ? "new" : shop?.id}
            className="form-grid"
            onSubmit={save}
          >
            <Field label="Shop name">
              <input
                name="name"
                defaultValue={item?.name}
                required
                maxLength={100}
              />
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={item?.status || "active"}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <label className="field span-2">
              <span>Description</span>
              <textarea
                name="description"
                defaultValue={item?.description}
                rows={3}
                maxLength={5000}
              />
            </label>
            <Field label="Address">
              <input
                name="address_line"
                defaultValue={item?.address_line}
                required
              />
            </Field>
            <Field label="City">
              <input
                name="city"
                defaultValue={item?.city || "Addis Ababa"}
                required
              />
            </Field>
            <Field label="Latitude">
              <input
                name="latitude"
                type="number"
                step="0.00000001"
                min={-90}
                max={90}
                defaultValue={item?.latitude || 9.0054}
                required
              />
            </Field>
            <Field label="Longitude">
              <input
                name="longitude"
                type="number"
                step="0.00000001"
                min={-180}
                max={180}
                defaultValue={item?.longitude || 38.7799}
                required
              />
            </Field>
            <Field label="Timezone">
              <input
                name="timezone"
                defaultValue={item?.timezone || "Africa/Addis_Ababa"}
                required
              />
            </Field>
            <Field label="Bank">
              <input name="bank_name" defaultValue={item?.bank_name} />
            </Field>
            <Field label="Account name">
              <input
                name="bank_account_name"
                defaultValue={item?.bank_account_name}
              />
            </Field>
            <Field label="Account number">
              <input
                name="bank_account_number"
                defaultValue={item?.bank_account_number}
              />
            </Field>
            <div className="span-2">
              <button className="button primary" disabled={busy}>
                <Save size={17} />
                {busy ? "Saving..." : "Save shop"}
              </button>
            </div>
          </form>
          {shop && !creating && (
            <section className="report-section">
              <h2>Shop media</h2>
              <div className="media-grid">
                {shop.media.map((m) => (
                  <div key={m.id}>
                    {m.media_type === "video" ? (
                      <video controls src={m.file_path} />
                    ) : (
                      <img src={m.file_path} alt={shop.name} />
                    )}
                    <div className="row-between">
                      <span>{m.is_cover ? "Cover image" : m.media_type}</span>
                      <button
                        className="icon-button danger"
                        title="Delete media"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api.delete("/manage/media/" + m.id);
                            await refresh();
                          } catch (e) {
                            setError(message(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <form className="media-form" onSubmit={media}>
                <Field label="Image or video">
                  <input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                    required
                  />
                </Field>
                <Field label="Use as">
                  <select name="is_cover">
                    <option value="0">Gallery media</option>
                    <option value="1">Cover image</option>
                  </select>
                </Field>
                <button className="button primary" disabled={busy}>
                  <Upload size={17} />
                  Upload
                </button>
              </form>
            </section>
          )}
        </>
      )}
    </>
  );
}
export function Services() {
  const { data, shop, id, setId, loading, error, refresh } = useShops();
  const [editing, setEditing] = useState(null),
    [actionError, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = Object.fromEntries(new FormData(e.target));
      d.is_active = d.is_active === "true";
      if (editing.id)
        await api.put("/manage/shops/" + id + "/services/" + editing.id, d);
      else await api.post("/manage/shops/" + id + "/services", d);
      setEditing(null);
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-eyebrow">THE CRAFT ON YOUR MENU</div>
      <div className="section-heading">
        <div>
          <h1>Service catalog</h1>
          <p>Every service, priced and timed with care.</p>
        </div>
        <button
          className="button primary"
          disabled={!shop}
          onClick={() => {
            setError("");
            setEditing({});
          }}
        >
          <Plus size={17} />
          Add service
        </button>
      </div>
      <ShopPicker data={data} id={id} setId={setId} />
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : shop ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Price</th>
                <th>Duration</th>
                <th>Buffer</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shop.services.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <span className="cell-sub">{s.description}</span>
                  </td>
                  <td>{money(s.price)}</td>
                  <td>{s.duration_minutes} min</td>
                  <td>{s.buffer_minutes} min</td>
                  <td>
                    <Status value={s.is_active ? "active" : "inactive"} />
                  </td>
                  <td>
                    <button
                      className="button small"
                      onClick={() => {
                        setEditing(s);
                        setError("");
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Create a shop to add services.</Empty>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit service" : "Add service"}
          onClose={() => setEditing(null)}
        >
          <form className="form-stack" onSubmit={save}>
            <ErrorBox error={actionError} />
            <Field label="Service name">
              <input
                name="name"
                defaultValue={editing.name}
                maxLength={100}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                defaultValue={editing.description}
                maxLength={1000}
              />
            </Field>
            <div className="form-grid">
              <Field label="Price (ETB)">
                <input
                  type="number"
                  name="price"
                  min={1}
                  max={999999.99}
                  step="0.01"
                  defaultValue={editing.price}
                  required
                />
              </Field>
              <Field label="Duration (minutes)">
                <input
                  type="number"
                  name="duration_minutes"
                  min={5}
                  max={480}
                  step={1}
                  defaultValue={editing.duration_minutes || 30}
                  required
                />
              </Field>
              <Field label="Buffer (minutes)">
                <input
                  type="number"
                  name="buffer_minutes"
                  min={0}
                  max={120}
                  step={1}
                  defaultValue={editing.buffer_minutes ?? 5}
                  required
                />
              </Field>
              <Field label="Status">
                <select
                  name="is_active"
                  defaultValue={String(editing.is_active ?? true)}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </Field>
            </div>
            <button className="button primary" disabled={busy}>
              <Save size={17} />
              {busy ? "Saving..." : "Save service"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Team() {
  const { data, shop, id, setId, loading, error, refresh } = useShops();
  const [inviting, setInviting] = useState(false),
    [invite, setInvite] = useState(""),
    [editing, setEditing] = useState(null),
    [actionError, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post(
        "/manage/shops/" + id + "/invite",
        Object.fromEntries(new FormData(e.target)),
      );
      setInvite(r.data.invite_url);
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const form = new FormData(e.target);
      await api.put("/manage/barbers/" + editing.id, {
        status: form.get("status"),
        service_ids: form.getAll("service_ids").map(Number),
      });
      setEditing(null);
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-eyebrow">THE PEOPLE BEHIND THE CHAIR</div>
      <div className="section-heading">
        <div>
          <h1>Your team</h1>
          <p>Individual craft. A shared standard.</p>
        </div>
        <button
          className="button primary"
          disabled={!shop}
          onClick={() => {
            setInviting(true);
            setInvite("");
            setError("");
          }}
        >
          <UserRoundPlus size={17} />
          Invite barber
        </button>
      </div>
      <ShopPicker data={data} id={id} setId={setId} />
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : shop?.barbers.length ? (
        <div className="team-grid">
          {shop.barbers.map((p) => (
            <article className="team-member" key={p.id}>
              <Avatar user={p.user} size={86} />
              <h2>{p.user.full_name}</h2>
              <Status value={p.status} />
              <p>{p.experience_years} years experience</p>
              <button
                className="button small"
                onClick={() => {
                  setEditing(p);
                  setError("");
                }}
              >
                Manage barber
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty>Invite your first barber.</Empty>
      )}
      {inviting && (
        <Modal title="Invite a barber" onClose={() => setInviting(false)}>
          {invite ? (
            <div className="form-stack">
              <p className="success">Invitation ready. Valid for 7 days.</p>
              <Field label="Invitation link">
                <input value={invite} readOnly />
              </Field>
              <button
                className="button primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invite);
                    setCopied(true);
                  } catch {
                    setError("Clipboard access is unavailable.");
                  }
                }}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}Copy
                invitation
              </button>
              <ErrorBox error={actionError} />
            </div>
          ) : (
            <form className="form-stack" onSubmit={send}>
              <ErrorBox error={actionError} />
              <Field label="Full name">
                <input name="full_name" required maxLength={100} />
              </Field>
              <Field label="Email address">
                <input name="email" type="email" required />
              </Field>
              <button className="button primary" disabled={busy}>
                <LinkIcon size={17} />
                {busy ? "Creating..." : "Generate invite link"}
              </button>
            </form>
          )}
        </Modal>
      )}
      {editing && (
        <Modal
          title={"Manage " + editing.user.full_name}
          onClose={() => setEditing(null)}
        >
          <form className="form-stack" onSubmit={save}>
            <ErrorBox error={actionError} />
            <Field label="Status">
              <select name="status" defaultValue={editing.status}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending_approval">Pending approval</option>
              </select>
            </Field>
            <fieldset className="checkbox-list">
              <legend>Assigned services</legend>
              {shop.services.map((s) => (
                <label key={s.id}>
                  <input
                    name="service_ids"
                    type="checkbox"
                    value={s.id}
                    defaultChecked={editing.services?.some(
                      (x) => x.id === s.id,
                    )}
                  />
                  {s.name}
                </label>
              ))}
            </fieldset>
            <button className="button primary" disabled={busy}>
              <Save size={17} />
              {busy ? "Saving..." : "Save barber"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
const names = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function Schedule() {
  const { user } = useAuth(),
    barber = user.barber_profile;
  const { data, loading, error } = useResource(
    "/manage/barbers/" + barber?.id + "/schedules",
  );
  const off = useResource("/manage/barbers/" + barber?.id + "/time-off");
  const [days, setDays] = useState([]),
    [actionError, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data)
      setDays(
        data
          .map((d) => ({
            ...d,
            start_time: time(d.start_time),
            end_time: time(d.end_time),
            break_start: time(d.break_start),
            break_end: time(d.break_end),
          }))
          .sort((a, b) => a.day_of_week - b.day_of_week),
      );
  }, [data]);
  const change = (i, key, value) => {
    setSaved(false);
    setDays(days.map((d, n) => (i === n ? { ...d, [key]: value } : d)));
  };
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put("/manage/barbers/" + barber.id + "/schedules", {
        days: days.map((d) => ({
          ...d,
          break_start: d.break_start || null,
          break_end: d.break_end || null,
        })),
      });
      setSaved(true);
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-eyebrow">MAKE ROOM FOR YOUR DAY</div>
      <div className="section-heading">
        <div>
          <h1>Working hours</h1>
          <p>Your week, with a little breathing room.</p>
        </div>
      </div>
      <ErrorBox error={error || actionError} />
      {saved && (
        <p className="success" role="status">
          Working hours saved.
        </p>
      )}
      {loading ? (
        <Loading />
      ) : (
        <form onSubmit={save}>
          <div className="table-scroll">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Day off</th>
                  <th>Opens</th>
                  <th>Closes</th>
                  <th>Break starts</th>
                  <th>Break ends</th>
                  <th>Interval</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => (
                  <tr key={d.day_of_week}>
                    <td>
                      <strong>{names[d.day_of_week]}</strong>
                    </td>
                    <td>
                      <input
                        aria-label={names[i] + " day off"}
                        type="checkbox"
                        checked={d.is_day_off}
                        onChange={(e) =>
                          change(i, "is_day_off", e.target.checked)
                        }
                      />
                    </td>
                    {["start_time", "end_time", "break_start", "break_end"].map(
                      (k) => (
                        <td key={k}>
                          <input
                            aria-label={names[i] + " " + k.replaceAll("_", " ")}
                            type="time"
                            value={d[k]}
                            disabled={d.is_day_off}
                            required={k === "start_time" || k === "end_time"}
                            onChange={(e) => change(i, k, e.target.value)}
                          />
                        </td>
                      ),
                    )}
                    <td>
                      <input
                        aria-label={names[i] + " slot interval"}
                        type="number"
                        min={5}
                        max={120}
                        value={d.slot_interval_minutes}
                        disabled={d.is_day_off}
                        onChange={(e) =>
                          change(
                            i,
                            "slot_interval_minutes",
                            Number(e.target.value),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="button primary mt" disabled={busy}>
            <Save size={17} />
            {busy ? "Saving..." : "Save working hours"}
          </button>
        </form>
      )}
      <section className="report-section">
        <h2>Days away</h2>
        <ErrorBox error={off.error} />
        {off.data?.map((d) => (
          <div key={d.id} className="history-row">
            <strong>{d.date}</strong>
            <span>{d.reason}</span>
            <button
              className="icon-button danger"
              title="Remove day off"
              onClick={async () => {
                try {
                  await api.post("/manage/barbers/" + barber.id + "/time-off", {
                    date: d.date,
                    remove: true,
                  });
                  await off.refresh();
                } catch (e) {
                  setError(message(e));
                }
              }}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <form
          className="media-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.post(
                "/manage/barbers/" + barber.id + "/time-off",
                Object.fromEntries(new FormData(e.target)),
              );
              e.target.reset();
              await off.refresh();
            } catch (e) {
              setError(message(e));
            }
          }}
        >
          <Field label="Date">
            <input name="date" type="date" required />
          </Field>
          <Field label="Reason">
            <input name="reason" maxLength={200} />
          </Field>
          <button className="button" type="submit">
            <Plus size={17} />
            Add day off
          </button>
        </form>
      </section>
    </>
  );
}
