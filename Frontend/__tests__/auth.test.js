import {
  clearSession,
  getToken,
  getUser,
  isAuthError,
  saveSession,
} from "../app/utils/auth";

// Builds an unsigned JWT; the frontend only reads its expiry.
const makeToken = (expiresInSeconds) => {
  const encode = (value) => btoa(JSON.stringify(value)).replace(/=+$/, "");
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ id: "1", exp })}.signature`;
};

const user = { id: "1", displayName: "Mia", username: "mia" };

beforeEach(() => {
  localStorage.clear();
});

describe("auth session", () => {
  it("returns the token and user of a valid login", () => {
    const token = makeToken(60);
    saveSession(token, user);

    expect(getToken()).toBe(token);
    expect(getUser()).toEqual({ ...user, name: "Mia" });
  });

  it("drops an expired login", () => {
    saveSession(makeToken(-60), user);

    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("drops a token that is not a JWT", () => {
    localStorage.setItem("token", "garbage");

    expect(getToken()).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("clears the session on logout", () => {
    saveSession(makeToken(60), user);
    clearSession();

    expect(getToken()).toBeNull();
  });

  it("treats 401 and 403 as an ended login", () => {
    expect(isAuthError(401)).toBe(true);
    expect(isAuthError(403)).toBe(true);
    expect(isAuthError(429)).toBe(false);
  });
});
