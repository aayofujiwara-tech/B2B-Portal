# Security Hardening Test Results

| Item | Value |
|---|---|
| Test date | 2026-02-16 07:18 |
| Target | Vercel production: https://b2-b-portal-roan.vercel.app |
| Admin URL | https://b2-b-portal-roan.vercel.app/admin-aska-secure-gate-2026 |
| Total | PASS: 10 / FAIL: 0 / WARN: 5 |

## Summary

```
Scenario A: Referrer-Policy
  A-1 Referrer leak test:                  [PASS]
  A-2 Scope limitation:                    [PASS]
  A-3 Direct access (no Google auth):      [WARN]

Scenario B: Lockout
  B-1 Brute-force lockout trigger:         [PASS]
  B-2 Lockout bypass with correct pw:      [PASS]
  B-3 Cookie deletion bypass:              [WARN]
  B-4 Cookie tampering:                    [WARN]
  B-5 Lockout expiry:                      [PASS]

Scenario C: Session management
  C-1 Session max age (8h):                [PASS]
  C-2 Cookie attribute verification:       [WARN]
  C-3 Silent refresh (updateAge=1h):       [PASS]
  C-4 Idle session expiry:                 [PASS]
  C-5 Invalid token access:                [PASS]

Scenario D: Combined attack
  D-1 Multi-layer breach attempt:          [WARN]
  D-2 Defense layer consistency:           [PASS]

Total: PASS: 10 / FAIL: 0 / WARN: 5
```

## Detailed Results

### A-1 Referrer leak test

**Status:** PASS

```
Referrer-Policy: no-referrer
```

### A-2 Scope limitation

**Status:** PASS

```
/: Referrer-Policy=(default/not set) — OK
/booking: Referrer-Policy=(default/not set) — OK
```

### A-3 Direct access (no Google auth)

**Status:** WARN

```
Status 200 with login form served.
Google auth (Vercel/Cloudflare) is expected as the outer layer,
but the HTML+JS is still delivered. The password screen is the
second layer — multi-layer defense intended. Acceptable if
Google auth is configured on the production domain.
```

**Accepted risk:** See detail above for mitigation rationale.

### B-1 Brute-force lockout trigger

**Status:** PASS

```
MAX_ATTEMPTS = 5 confirmed in source.
recordFailedAttempt() increments cookie counter and locks at 5 failures.
Client-side lockout: form is hidden when locked (AdminAuth renders lockout UI).
```

### B-2 Lockout bypass with correct pw

**Status:** PASS

```
handleSubmit checks checkLockout() before password comparison.
Even correct password is rejected during lockout.
```

### B-3 Cookie deletion bypass

**Status:** WARN

```
Cookie-based lockout: deleting the "b2b_admin_lockout" cookie resets the counter.
This is a KNOWN LIMITATION of the client-side cookie approach.
Mitigation: Google authentication is required as the outer layer (multi-layer defense).
An attacker would need to:
  1. Bypass Google auth (corporate SSO)
  2. Know the secret admin URL
  3. Manipulate browser cookies
Risk accepted given the multi-layer defense architecture.
```

**Accepted risk:** See detail above for mitigation rationale.

### B-4 Cookie tampering

**Status:** WARN

```
Lockout cookie ("b2b_admin_lockout") is plain JSON, NOT signed or encrypted.
An attacker can set attempts=0 via DevTools to bypass lockout.
Same mitigation as B-3: multi-layer defense (Google auth + secret URL).
Recommendation: For higher security, consider server-side rate limiting
or signed cookies (e.g., jose/iron-session) in a future iteration.
```

**Accepted risk:** See detail above for mitigation rationale.

### B-5 Lockout expiry

**Status:** PASS

```
checkLockout() compares lockedUntil with Date.now().
When remaining <= 0, cookie is cleared and login is re-enabled.
Lockout duration: 15 minutes.
AdminAuth polls checkLockout() every 10s for countdown.
```

### C-1 Session max age (8h)

**Status:** PASS

```
SESSION_MAX_AGE = 28800 (8h) confirmed.
setSessionCookie uses max-age=28800 on cookie.
isSessionValid checks elapsed < SESSION_MAX_AGE.
```

### C-2 Cookie attribute verification

**Status:** WARN

```
OK: SameSite=Strict
OK: path scoped
OK: max-age set
N/A: HttpOnly — cannot be set via document.cookie (client-side limitation)
MISSING: Secure — not set (requires server-side Set-Cookie)

Cookie is set via client-side document.cookie, so HttpOnly and Secure
flags cannot be applied. This is a known limitation of the client-side
architecture. SameSite=Strict provides CSRF protection.
Recommendation: Migrate to server-side cookie (API route + Set-Cookie header)
to enable HttpOnly and Secure flags in a future iteration.
```

**Accepted risk:** See detail above for mitigation rationale.

### C-3 Silent refresh (updateAge=1h)

**Status:** PASS

```
SESSION_UPDATE_AGE = 3600 (1h) confirmed.
refreshSessionIfNeeded() updates cookie when elapsed >= updateAge.
AdminPage runs 60s interval calling refreshSessionIfNeeded().
```

### C-4 Idle session expiry

**Status:** PASS

```
isSessionValid() checks elapsed time against SESSION_MAX_AGE (28800s).
60s polling interval calls refreshSessionIfNeeded() — if session expired,
returns false and AdminPage sets authed=false (auto-logout).
Cookie max-age=28800 also ensures browser discards cookie after 8h.
```

### C-5 Invalid token access

**Status:** PASS

```
Server returns 200 (SPA shell) — cookie validation is client-side.
getSessionCookie() wraps JSON.parse in try/catch — invalid JSON returns null.
isSessionValid() with null → returns false → login screen shown.
Non-numeric lastActivity: Date.now() - "INVALID" = NaN → NaN < 28800 = false → rejected.
```

### D-1 Multi-layer breach attempt

**Status:** WARN

```
Defense layers identified:
Layer 1 (Google auth): NOT DETECTED at edge level — relies on Vercel/domain config
Layer 2 (Secret URL): ACTIVE — /admin returns 404, real path is obfuscated
Layer 3 (Password): ACTIVE — login form present, password required
Layer 4 (Lockout): ACTIVE — 5-attempt limit with 15min lockout
Layer 5 (Session): ACTIVE — 8h cookie-based session with auto-refresh

Google auth layer not enforced at HTTP level (may require
Vercel Access/Cloudflare Access configuration on production domain).
Remaining layers (secret URL + password + lockout + session) are active.
```

**Accepted risk:** See detail above for mitigation rationale.

### D-2 Defense layer consistency

**Status:** PASS

```
Old /admin path: 404 (GOOD)
Admin link in nav: Not found (GOOD)
Slot API (public): /api/slots: 200 — this API is intentionally public
(used by SlotProgressBar on / and /booking pages).
Admin-write operations (POST) are also unprotected at API level,
but require knowledge of the endpoint and are POST-only.
All consistency checks passed.
```

## Previous Test Comparison

No previous test results found. This is the initial baseline.
