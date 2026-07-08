const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

export const authApi = {
  signup: (body) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify(body) }),

  login: (body) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  logout: () => request("/auth/logout", { method: "POST" }),

  getProfile: () => request("/auth/profile"),
};

export const cloudApi = {
  getResources: () => request("/resources"),
  getCostSummary: () => request("/costs/summary"),
  getRecommendations: () => request("/recommendations"),
  getNotifications: () => request("/notifications"),
  markNotificationRead: (id) =>
    request(`/notifications/${id}`, { method: "PATCH" }),
};
