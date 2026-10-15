import axios from "axios";
import { getToken, handleExpiredSession, isAuthError } from "./auth";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Send the login token with every request, when there is one.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A rejected token means the login is over. Requests without a token (like
// a wrong password on /login) are left to the caller.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      isAuthError(error.response?.status) &&
      error.config?.headers?.Authorization
    ) {
      handleExpiredSession();
    }
    return Promise.reject(error);
  },
);

export default api;
