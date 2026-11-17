/**
 * Copy values into environment.ts / environment.prod.ts for each deploy target.
 * Never commit real Cognito IDs, API URLs, or allowlisted emails to a public fork
 * if you want those private — use private env files or CI secrets instead.
 */
export const environment = {
  production: false,
  siteName: 'My Blog',
  blogApiUrl: 'https://abc123.execute-api.us-east-1.amazonaws.com/prod',
  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_AbCdEfGhI',
    clientId: '1a2b3c4d5e6f7g8h9i0j',
    domain: 'myblog.auth.us-east-1.amazoncognito.com',
    redirectUri: 'http://localhost:4200/admin',
    logoutUri: 'http://localhost:4200/',
    allowedEmails: ['author@example.com']
  }
};
