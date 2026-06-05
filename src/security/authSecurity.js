/**
 * authSecurity.js
 * Client-side security utilities for FinGuard Admin Portal.
 *
 * NOTE: This app uses Firebase Authentication + Firestore for its backend.
 * Firebase itself protects against SQL injection (NoSQL queries use the SDK,
 * not raw SQL strings). These utilities add an additional hardening layer on
 * the client side: input sanitisation, brute-force/rate-limit protection,
 * and idle-session management.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum consecutive failed login attempts before the form is locked. */
export const MAX_LOGIN_ATTEMPTS = 5;

/** Lock duration in milliseconds (15 minutes). */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Idle session timeout in milliseconds (30 minutes). */
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Absolute session cap — force logout after this duration (8 hours). */
export const SESSION_MAX_DURATION_MS = 8 * 60 * 60 * 1000;

// localStorage keys
const ATTEMPTS_KEY = 'fg_login_attempts';
const LOCKOUT_UNTIL_KEY = 'fg_lockout_until';
const SESSION_START_KEY = 'fg_session_start';
const SESSION_LAST_ACTIVE_KEY = 'fg_session_last_active';


// ─── Input Sanitisation ───────────────────────────────────────────────────────

/**
 * Sanitises a plain text string against common injection / XSS vectors.
 * - Trims whitespace
 * - Strips null bytes, control characters, and HTML special chars
 * - Enforces a maximum length
 *
 * @param {string} value  Raw input from the user.
 * @param {number} [maxLen=320]  Maximum allowed length.
 * @returns {string}  Sanitised string.
 */
export function sanitiseInput(value, maxLen = 320) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .slice(0, maxLen)
    // Strip null bytes and C0/C1 control characters (except \t, \n, \r)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Strip HTML tags and common injection delimiters
    .replace(/[<>"'`]/g, '');
}

/**
 * Validates an e-mail address format.
 * Uses the same RFC-5321 subset that Firebase Auth accepts.
 *
 * @param {string} email
 * @returns {{ ok: boolean, message: string }}
 */
export function validateEmail(email) {
  if (!email) return { ok: false, message: 'Email address is required.' };

  const cleaned = sanitiseInput(email, 320);

  // Must not be empty after sanitation
  if (!cleaned) return { ok: false, message: 'Email address contains invalid characters.' };

  // Basic RFC-compliant email pattern
  const pattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!pattern.test(cleaned)) return { ok: false, message: 'Please enter a valid email address.' };

  if (cleaned.length > 320) return { ok: false, message: 'Email address is too long.' };

  return { ok: true, message: '' };
}

/**
 * Validates a password for the login form (not for creation — just presence & length).
 *
 * @param {string} password
 * @returns {{ ok: boolean, message: string }}
 */
export function validatePassword(password) {
  if (!password) return { ok: false, message: 'Password is required.' };
  if (password.length < 6)  return { ok: false, message: 'Password must be at least 6 characters.' };
  if (password.length > 512) return { ok: false, message: 'Password is too long.' };
  return { ok: true, message: '' };
}


// ─── Brute-Force / Rate Limiting ─────────────────────────────────────────────

/**
 * Returns the current brute-force state stored in localStorage.
 * @returns {{ attempts: number, lockedUntil: number }}
 */
function getBruteForceState() {
  const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10);
  const lockedUntil = parseInt(localStorage.getItem(LOCKOUT_UNTIL_KEY) || '0', 10);
  return { attempts, lockedUntil };
}

/**
 * Checks whether the form is currently locked out.
 * Automatically clears the lock once it has expired.
 *
 * @returns {{ locked: boolean, remainingMs: number }}
 */
export function checkLockout() {
  const { attempts, lockedUntil } = getBruteForceState();
  const now = Date.now();

  if (lockedUntil && now < lockedUntil) {
    return { locked: true, remainingMs: lockedUntil - now };
  }

  // Lock expired — clear it
  if (lockedUntil && now >= lockedUntil) {
    clearLockout();
  }

  return { locked: false, remainingMs: 0 };
}

/**
 * Records a failed login attempt and locks the form if the threshold is hit.
 * @returns {{ locked: boolean, attemptsLeft: number }}
 */
export function recordFailedAttempt() {
  const { attempts } = getBruteForceState();
  const newAttempts = attempts + 1;
  localStorage.setItem(ATTEMPTS_KEY, String(newAttempts));

  if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
    const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
    localStorage.setItem(LOCKOUT_UNTIL_KEY, String(lockUntil));
    return { locked: true, attemptsLeft: 0 };
  }

  return { locked: false, attemptsLeft: MAX_LOGIN_ATTEMPTS - newAttempts };
}

/** Resets the brute-force counter after a successful login. */
export function clearLockout() {
  localStorage.removeItem(ATTEMPTS_KEY);
  localStorage.removeItem(LOCKOUT_UNTIL_KEY);
}

/**
 * Returns a human-readable remaining lockout string, e.g. "14 minutes 23 seconds".
 * @param {number} remainingMs
 * @returns {string}
 */
export function formatLockoutRemaining(remainingMs) {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds}s`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}


// ─── Session Management ───────────────────────────────────────────────────────

/** Starts a new authenticated session, recording start & last-active timestamps. */
export function startSession() {
  const now = Date.now();
  localStorage.setItem(SESSION_START_KEY, String(now));
  localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
}

/** Updates the last-active timestamp (call on user interaction). */
export function touchSession() {
  localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(Date.now()));
}

/** Clears all session data from localStorage. */
export function clearSession() {
  localStorage.removeItem(SESSION_START_KEY);
  localStorage.removeItem(SESSION_LAST_ACTIVE_KEY);
}

/**
 * Checks whether the current session is still valid.
 *
 * @returns {{ valid: boolean, reason: 'idle'|'expired'|null }}
 */
export function isSessionValid() {
  const start = parseInt(localStorage.getItem(SESSION_START_KEY) || '0', 10);
  const lastActive = parseInt(localStorage.getItem(SESSION_LAST_ACTIVE_KEY) || '0', 10);
  const now = Date.now();

  if (!start || !lastActive) return { valid: false, reason: 'idle' };

  if (now - start > SESSION_MAX_DURATION_MS) return { valid: false, reason: 'expired' };
  if (now - lastActive > SESSION_IDLE_TIMEOUT_MS) return { valid: false, reason: 'idle' };

  return { valid: true, reason: null };
}
