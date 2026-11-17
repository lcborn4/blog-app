import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Handle OAuth redirect if present
  const url = new URL(window.location.href);
  if (url.searchParams.has('code') || url.searchParams.has('error')) {
    const result = await auth.handleRedirectCallback();
    if (!result.ok) {
      // Wrong Google account sticks in Cognito/Google — clear it so the next try can pick another.
      if (result.error === 'email_not_allowlisted') {
        auth.clearFederatedSession('email_not_allowlisted');
        return false;
      }
      return router.createUrlTree(['/admin/login'], {
        queryParams: { error: result.error || 'login_failed' }
      });
    }
    return true;
  }

  if (auth.isAuthenticated() && auth.getIdToken()) {
    return true;
  }

  return router.createUrlTree(['/admin/login']);
};
