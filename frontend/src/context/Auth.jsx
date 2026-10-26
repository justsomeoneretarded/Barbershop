import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../lib/api";
const Context = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(!!sessionStorage.getItem("chair_token"));
  const load = async () => {
    try {
      setUser((await api.get("/auth/me")).data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (sessionStorage.getItem("chair_token")) load();
    const clear = () => setUser(null);
    window.addEventListener("chair:unauthorized", clear);
    return () => window.removeEventListener("chair:unauthorized", clear);
  }, []);
  const authenticate = async (path, data) => {
    const r = await api.post(path, data);
    sessionStorage.setItem("chair_token", r.data.token);
    setUser(r.data.user);
    return r.data.user;
  };
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      sessionStorage.removeItem("chair_token");
      setUser(null);
    }
  };
  return (
    <Context.Provider
      value={{ user, setUser, loading, load, authenticate, logout }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
