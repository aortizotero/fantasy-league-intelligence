// Cloudflare Turnstile — bot filtering on the League ID form (server.js's
// GET /api/league/:leagueId). Verify-once-remember-via-cookie, not
// verify-on-every-request: Turnstile tokens are single-use and expire in
// ~5 minutes, but app.js re-fetches this same endpoint automatically on
// every EN/ES toggle (window.onLangChange) — a fresh token on every one of
// those would mean re-solving the widget just to switch languages. A
// short-lived, HMAC-signed, httpOnly cookie set after the first successful
// verify covers every later request in the browsing session for free —
// browsers attach cookies to same-origin fetch() calls automatically, no
// frontend token-refresh logic needed.
//
// No new npm dependency: res.cookie() is built into Express, and this only
// ever needs to read one fixed-name cookie, so a two-line manual parse
// stands in for cookie-parser. Signing reuses TURNSTILE_SECRET_KEY itself
// as the HMAC key rather than introducing a second secret.

import crypto from "node:crypto";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const COOKIE_NAME = "fli_turnstile";
const COOKIE_TTL_MS = 60 * 60 * 1000; // 1h — long enough a normal browsing session never re-prompts, short enough a stale pass doesn't linger for days

function sign(value) {
  return crypto.createHmac("sha256", process.env.TURNSTILE_SECRET_KEY).update(value).digest("hex");
}

function makeCookieValue() {
  const expires = Date.now() + COOKIE_TTL_MS;
  return `${expires}.${sign(String(expires))}`;
}

function isCookieValid(raw) {
  if (!raw) return false;
  const [expires, sig] = raw.split(".");
  if (!expires || !sig) return false;
  if (sig !== sign(expires)) return false;
  return Number(expires) > Date.now();
}

function readCookie(req) {
  const header = req.headers.cookie || "";
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : null;
}

// Returns true if the request should proceed. Not configured (no local
// Cloudflare setup) degrades to a no-op, same convention as lib/claude.js
// when ANTHROPIC_API_KEY is missing.
export async function checkTurnstile(req, res) {
  if (!process.env.TURNSTILE_SECRET_KEY) return true;

  if (isCookieValid(readCookie(req))) return true;

  const token = req.get("X-Turnstile-Token");
  if (!token) return false;

  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
  if (req.ip) body.set("remoteip", req.ip);

  let verified = false;
  try {
    const verifyRes = await fetch(VERIFY_URL, { method: "POST", body });
    const data = await verifyRes.json();
    verified = !!data.success;
  } catch {
    verified = false;
  }

  if (verified) {
    // secure gated on NODE_ENV rather than always-on, so it still works over
    // plain http://localhost in local dev — production (behind Coolify/
    // Let's Encrypt) always sets it, so the cookie never goes out in the
    // clear on a real deployment.
    res.cookie(COOKIE_NAME, makeCookieValue(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_TTL_MS,
    });
  }
  return verified;
}
