import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { Accept: "application/json" },
});
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("chair_token");
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("chair_token");
      window.dispatchEvent(new Event("chair:unauthorized"));
    }
    return Promise.reject(error);
  },
);
export const message = (e) =>
  Object.values(e.response?.data?.errors || {})
    .flat()
    .join(" ") ||
  e.response?.data?.message ||
  e.message ||
  "Something went wrong. Please try again.";
export const money = (v) =>
  new Intl.NumberFormat("en-ET", { maximumFractionDigits: 2 }).format(
    Number(v || 0),
  ) + " ETB";
export const cover = (shop) =>
  shop?.media?.find((m) => m.is_cover)?.file_path ||
  shop?.media?.[0]?.file_path ||
  "/images/shop-1.jpg";
export const dateInShop = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const time = (t) => t?.slice(0, 5) || "";
