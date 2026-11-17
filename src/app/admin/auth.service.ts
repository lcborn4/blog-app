import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

const STORAGE_KEY = 'blog-app.auth';
const PKCE_VERIFIER_KEY = 'blog-app.pkce';
const PKCE_STATE_KEY = 'blog-app.oauth_state';
const LOGIN_ERROR_KEY = 'blog-app.login_error';

interface StoredAuth {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email: string;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function parseJwt(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(normalized)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(json);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly email = signal<string | null>(null);
  readonly isAuthenticated = signal(false);

  constructor() {
    this.hydrate();
  }

  getIdToken(): string | null {
    const stored = this.readStore();
    if (!stored) return null;
    if (Date.now() >= stored.expiresAt - 30_000) {
      this.clear();
      return null;
    }
    return stored.idToken;
  }

  private redirectUri(): string {
    // Must match the page origin exactly (localhost ≠ 127.0.0.1) or PKCE sessionStorage is lost.
    return `${window.location.origin}/admin`;
  }

  private logoutUri(): string {
    return `${window.location.origin}/`;
  }

  async beginGoogleLogin(returnPath = '/admin'): Promise<void> {
    const verifier = this.randomString(64);
    const challenge = await this.pkceChallenge(verifier);
    const state = this.randomString(24);
    const redirectUri = this.redirectUri();

    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    sessionStorage.setItem(
      PKCE_STATE_KEY,
      JSON.stringify({ state, returnPath, redirectUri })
    );

    const params = new URLSearchParams({
      client_id: environment.cognito.clientId,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: redirectUri,
      identity_provider: 'Google',
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
      // Always show Google's account picker so a wrong allowlisted attempt can switch accounts.
      prompt: 'select_account'
    });

    window.location.href = `https://${environment.cognito.domain}/oauth2/authorize?${params}`;
  }

  /** Clear Cognito/Google session, then land on the login page (optional error). */
  clearFederatedSession(error?: string): void {
    this.clear();
    // Cognito logout_uri must match an allowlisted URL exactly (no query string).
    if (error) {
      sessionStorage.setItem(LOGIN_ERROR_KEY, error);
    }
    const params = new URLSearchParams({
      client_id: environment.cognito.clientId,
      logout_uri: `${window.location.origin}/admin/login`
    });
    window.location.href = `https://${environment.cognito.domain}/logout?${params}`;
  }

  consumeLoginError(): string | null {
    const error = sessionStorage.getItem(LOGIN_ERROR_KEY);
    if (error) sessionStorage.removeItem(LOGIN_ERROR_KEY);
    return error;
  }

  async handleRedirectCallback(): Promise<{ ok: boolean; error?: string; returnPath?: string }> {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return { ok: false, error };
    }
    if (!code || !state) {
      return { ok: false, error: 'missing_code' };
    }

    const saved = sessionStorage.getItem(PKCE_STATE_KEY);
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
    if (!saved || !verifier) {
      return { ok: false, error: 'missing_pkce' };
    }

    const {
      state: expectedState,
      returnPath,
      redirectUri: savedRedirectUri
    } = JSON.parse(saved) as {
      state: string;
      returnPath: string;
      redirectUri?: string;
    };
    if (state !== expectedState) {
      return { ok: false, error: 'state_mismatch' };
    }

    const redirectUri = savedRedirectUri || this.redirectUri();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: environment.cognito.clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier
    });

    const tokenRes = await fetch(`https://${environment.cognito.domain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return { ok: false, error: `token_exchange_failed:${text}` };
    }

    const tokens = (await tokenRes.json()) as {
      id_token: string;
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const claims = parseJwt(tokens.id_token);
    const email = String(claims['email'] || '').toLowerCase();
    const verified =
      claims['email_verified'] === true || String(claims['email_verified']) === 'true';

    if (!email || !environment.cognito.allowedEmails.includes(email)) {
      this.clear();
      return { ok: false, error: 'email_not_allowlisted' };
    }
    if (!verified) {
      this.clear();
      return { ok: false, error: 'email_not_verified' };
    }

    const stored: StoredAuth = {
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      email
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(PKCE_STATE_KEY);
    this.email.set(email);
    this.isAuthenticated.set(true);

    // Clean query params from URL
    window.history.replaceState({}, document.title, url.pathname);

    return { ok: true, returnPath: returnPath || '/admin' };
  }

  logout(): void {
    this.clear();
    const params = new URLSearchParams({
      client_id: environment.cognito.clientId,
      logout_uri: this.logoutUri()
    });
    window.location.href = `https://${environment.cognito.domain}/logout?${params}`;
  }

  private hydrate(): void {
    const stored = this.readStore();
    if (!stored) {
      this.isAuthenticated.set(false);
      this.email.set(null);
      return;
    }
    if (Date.now() >= stored.expiresAt - 30_000) {
      this.clear();
      return;
    }
    this.email.set(stored.email);
    this.isAuthenticated.set(true);
  }

  private readStore(): StoredAuth | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredAuth;
    } catch {
      return null;
    }
  }

  private clear(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    this.email.set(null);
    this.isAuthenticated.set(false);
  }

  private randomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, (v) => chars[v % chars.length]).join('');
  }

  private async pkceChallenge(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(digest);
  }
}
