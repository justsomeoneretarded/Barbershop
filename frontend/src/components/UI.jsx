import React, { useEffect, useState, useRef, useCallback } from "react";
import { X, Loader2, UserRound, AlertCircle } from "lucide-react";
import { api, message } from "../lib/api";
export function Avatar({ user, size = 40 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [user?.avatar_path]);
  return user?.avatar_path && !failed ? (
    <img
      className="avatar"
      style={{ width: size, height: size }}
      src={user.avatar_path}
      alt={user.full_name || "Profile"}
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className="avatar avatar-fallback"
      style={{ width: size, height: size }}
    >
      <UserRound size={size / 2} />
    </span>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const dialog = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const old = document.body.style.overflow;
    const opener = document.activeElement;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector("button")?.focus();
    const close = (e) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab") return;
      const controls = [
        ...dialog.current.querySelectorAll(
          "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
        ),
      ].filter((el) => el.getClientRects().length);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", close);
      opener?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" title="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function ErrorBox({ error }) {
  return error ? (
    <div role="alert" className="error">
      <AlertCircle size={18} />
      {error}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading">
      <Loader2 className="spin" size={24} /> Loading...
    </div>
  );
}
export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
export function Status({ value }) {
  return (
    <span className={"status " + value}>{value?.replaceAll("_", " ")}</span>
  );
}
export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function useResource(path, deps = []) {
  const sequence = useRef(0);
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setError("");
    try {
      const response = await api.get(path);
      if (request === sequence.current) setData(response.data);
    } catch (e) {
      if (request === sequence.current) setError(message(e));
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setLoading(true);
    refresh();
    return () => {
      sequence.current++;
    };
  }, [path, ...deps]);
  return { data, setData, error, loading, refresh };
}
export function Receipt({ payment, onClose }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let objectUrl;
    api
      .get("/payments/" + payment.id + "/receipt", { responseType: "blob" })
      .then((r) => {
        objectUrl = URL.createObjectURL(r.data);
        setUrl(objectUrl);
      })
      .catch((e) => setError(message(e)));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payment.id]);
  return (
    <Modal title={"Receipt · " + payment.reference_code} onClose={onClose}>
      <ErrorBox error={error} />
      {url ? (
        <img
          className="receipt-image"
          src={url}
          alt="Customer payment receipt"
        />
      ) : (
        !error && <Loading />
      )}
    </Modal>
  );
}
