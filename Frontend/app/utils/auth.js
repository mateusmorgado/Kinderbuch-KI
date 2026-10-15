import { jwtDecode } from "jwt-decode";

// The login lives in localStorage: `token` is the JWT from the backend and
// `user` holds the name shown in the UI. There is no refresh token, so once
// the JWT expires the user has to log in again.

const TOKEN_KEY = "token";
const USER_KEY = "user";

const isExpired = (token) => {
  try {
    const { exp } = jwtDecode(token);
    return !exp || exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function saveSession(accessToken, user) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      id: user.id,
      name: user.displayName,
      displayName: user.displayName,
      username: user.username,
    }),
  );
}

// Returns the stored token, or null when there is none or it has expired.
// An expired login is removed so every page treats the user as logged out.
export function getToken() {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isExpired(token)) {
    clearSession();
    return null;
  }
  return token;
}

export function getUser() {
  if (!getToken()) return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
}

// True when the backend rejected the token (expired, revoked or forged).
export const isAuthError = (status) => status === 401 || status === 403;

// Ends a login the backend no longer accepts and sends the user to log in.
export function handleExpiredSession() {
  clearSession();
  // A full page load also drops any cached data of the old login. This runs
  // outside React (e.g. in the axios interceptor), so there is no router.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login");
}
