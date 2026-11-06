/**
 * Browser-only accounts (temporary, until the database is connected).
 *
 * Accounts and the current session live in this browser's localStorage. They do
 * not sync between browsers or devices, and anyone with access to this browser
 * profile can read or change them — this is a prototype mode, not a security
 * boundary. Passwords are never stored in plain text: they are hashed with
 * PBKDF2-SHA256 and a random per-account salt via the Web Crypto API.
 *
 * Switch back to server accounts with NEXT_PUBLIC_AUTH_MODE=server.
 */

export const AUTH_MODE: "local" | "server" = process.env.NEXT_PUBLIC_AUTH_MODE === "server" ? "server" : "local";
export const isLocalAuth = AUTH_MODE === "local";

const USERS_KEY = "aoient.local.users.v1";
const SESSION_KEY = "aoient.local.session.v1";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 210_000;

export interface LocalUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}
interface StoredUser extends LocalUser {
  salt: string;
  passwordHash: string;
}
interface StoredSession {
  userId: string;
  expiresAt: number;
}

export class LocalAuthError extends Error {
  constructor(
    public readonly code: "EMAIL_TAKEN" | "INVALID_CREDENTIALS" | "UNAVAILABLE",
    message: string,
  ) {
    super(message);
  }
}

/** Minimal Storage interface so tests can inject an in-memory store. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): KeyValueStore {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    // Access can throw (private mode, blocked site data).
  }
  throw new LocalAuthError("UNAVAILABLE", "This browser is blocking site storage, so accounts can't be saved. Allow site data for this page and try again.");
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) {
    throw new LocalAuthError(
      "UNAVAILABLE",
      "Secure password hashing isn't available on this address. Open the app over https or at http://localhost.",
    );
  }
  return s;
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await subtle().importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle().deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return toB64(new Uint8Array(bits));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const publicUser = ({ id, name, email, createdAt }: StoredUser): LocalUser => ({ id, name, email, createdAt });
const normalizeEmail = (email: string) => email.trim().toLowerCase();

function startSession(store: KeyValueStore, userId: string, now: number) {
  store.setItem(SESSION_KEY, JSON.stringify({ userId, expiresAt: now + SESSION_TTL_MS } satisfies StoredSession));
}

export async function localSignUp(
  input: { name: string; email: string; password: string },
  store: KeyValueStore = defaultStore(),
  now = Date.now(),
): Promise<LocalUser> {
  const users = readJson<StoredUser[]>(store, USERS_KEY, []);
  const email = normalizeEmail(input.email);
  if (users.some((u) => u.email === email)) {
    throw new LocalAuthError("EMAIL_TAKEN", "An account with this email already exists in this browser. Sign in instead.");
  }
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const user: StoredUser = {
    id: globalThis.crypto.randomUUID(),
    name: input.name.trim(),
    email,
    createdAt: new Date(now).toISOString(),
    salt: toB64(salt),
    passwordHash: await hashPassword(input.password, salt),
  };
  store.setItem(USERS_KEY, JSON.stringify([...users, user]));
  startSession(store, user.id, now);
  return publicUser(user);
}

export async function localSignIn(
  input: { email: string; password: string },
  store: KeyValueStore = defaultStore(),
  now = Date.now(),
): Promise<LocalUser> {
  const users = readJson<StoredUser[]>(store, USERS_KEY, []);
  const user = users.find((u) => u.email === normalizeEmail(input.email));
  // Hash even when the user is unknown so timing doesn't reveal which emails exist.
  const hash = await hashPassword(input.password, user ? fromB64(user.salt) : new Uint8Array(16));
  if (!user || !constantTimeEqual(hash, user.passwordHash)) {
    throw new LocalAuthError("INVALID_CREDENTIALS", "Incorrect email or password.");
  }
  startSession(store, user.id, now);
  return publicUser(user);
}

export function localSignOut(store: KeyValueStore = defaultStore()): void {
  store.removeItem(SESSION_KEY);
}

/** Returns the signed-in user, or null when there is no valid, unexpired session. */
export function getLocalSessionUser(store: KeyValueStore = defaultStore(), now = Date.now()): LocalUser | null {
  const session = readJson<StoredSession | null>(store, SESSION_KEY, null);
  if (!session || typeof session.expiresAt !== "number" || session.expiresAt <= now) {
    if (session) store.removeItem(SESSION_KEY);
    return null;
  }
  const user = readJson<StoredUser[]>(store, USERS_KEY, []).find((u) => u.id === session.userId);
  return user ? publicUser(user) : null;
}
