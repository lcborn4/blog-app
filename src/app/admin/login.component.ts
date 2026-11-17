import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  standalone: true,
  selector: 'app-admin-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-[60vh] flex items-center justify-center px-4">
      <div class="w-full max-w-md text-center space-y-6">
        <h1 class="text-3xl font-semibold tracking-tight">Blog Admin</h1>
        <p class="text-gray-600">Sign in with Google. Access is limited to allowlisted emails.</p>

        @if (error()) {
          <p class="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {{ error() }}
          </p>
        }

        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-md bg-black text-white px-5 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:cursor-wait disabled:opacity-80"
          [disabled]="loading()"
          (click)="signIn()"
        >
          @if (loading()) {
            <span
              class="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
              aria-hidden="true"
            ></span>
            Redirecting to Google…
          } @else if (wrongAccount()) {
            Try a different Google account
          } @else {
            Sign in with Google
          }
        </button>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly error = signal<string | null>(null);
  readonly wrongAccount = signal(false);
  readonly loading = signal(false);

  ngOnInit(): void {
    const err =
      this.route.snapshot.queryParamMap.get('error') || this.auth.consumeLoginError();
    if (err === 'email_not_allowlisted') {
      this.wrongAccount.set(true);
      this.error.set('That Google account is not allowlisted for admin access. Choose a different account.');
    } else if (err) {
      this.error.set(`Sign-in failed (${err}).`);
    }
  }

  signIn(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    void this.auth.beginGoogleLogin('/admin').catch(() => {
      this.loading.set(false);
      this.error.set('Could not start Google sign-in. Try again.');
    });
  }
}
