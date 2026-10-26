import React from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import {
  CalendarDays,
  Users,
  ChartNoAxesCombined,
  Clock,
  Store,
  Scissors,
  UserRoundPlus,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../context/Auth";
import { Avatar } from "../components/UI";
import { Appointments, Clients, Revenue } from "./Staff";
import { Schedule, ShopEditor, Services, Team } from "./Management";
export default function Portal() {
  const { user } = useAuth(),
    owner = ["owner", "admin"].includes(user.role);
  const links = [
    ["appointments", "Appointments", CalendarDays],
    ["clients", "Clients", Users],
    ["revenue", owner ? "Shop finances" : "Earnings", ChartNoAxesCombined],
    ...(!owner
      ? [["schedule", "Working hours", Clock]]
      : [
          ["shop", "Shop profile", Store],
          ["services", "Services", Scissors],
          ["team", "Team", UserRoundPlus],
        ]),
  ];
  return (
    <div className="portal-layout">
      <aside className="sidebar">
        <div className="workspace-label">
          {owner ? "SHOP WORKSPACE" : "BARBER WORKSPACE"}
        </div>
        <div className="workspace-person">
          <Avatar user={user} size={42} />
          <div>
            <strong>{user.full_name}</strong>
            <span>{owner ? "Shop owner" : "Barber"}</span>
          </div>
        </div>
        <nav>
          {links.map(([path, label, Icon]) => (
            <NavLink key={path} to={"/portal/" + path}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="live-dot" />A good day starts here.
        </div>
      </aside>
      <main className="portal-main">
        <Routes>
          <Route index element={<Navigate to="appointments" replace />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="clients" element={<Clients />} />
          <Route path="revenue" element={<Revenue />} />
          <Route
            path="schedule"
            element={!owner ? <Schedule /> : <Navigate to="/portal" />}
          />
          <Route
            path="shop"
            element={owner ? <ShopEditor /> : <Navigate to="/portal" />}
          />
          <Route
            path="services"
            element={owner ? <Services /> : <Navigate to="/portal" />}
          />
          <Route
            path="team"
            element={owner ? <Team /> : <Navigate to="/portal" />}
          />
          <Route path="*" element={<Navigate to="/portal" />} />
        </Routes>
      </main>
    </div>
  );
}
