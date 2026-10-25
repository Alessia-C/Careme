export interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

// The API answers duplicate emails with the same generic 400 as other
// failures (anti-enumeration), so the UI cannot tell them apart: only the
// rate limit needs a different message.
export type SignupResult =
  { ok: true } | { ok: false; reason: 'rate-limited' | 'failed' };

export async function signup(input: SignupInput): Promise<SignupResult> {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (response.ok) {
      return { ok: true };
    }
    if (response.status === 429) {
      return { ok: false, reason: 'rate-limited' };
    }
    return { ok: false, reason: 'failed' };
  } catch {
    // fetch rejects only on network errors (offline, DNS, CORS).
    return { ok: false, reason: 'failed' };
  }
}
