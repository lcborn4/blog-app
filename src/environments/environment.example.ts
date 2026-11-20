/**
 * Copy values into environment.ts / environment.prod.ts for each deploy target.
 */
export const environment = {
  production: false,
  /** true = in-memory example posts + demo admin (no API/Cognito). */
  useDemoData: false,
  siteName: 'My Blog',
  siteHomeUrl: 'https://example.com/',
  siteHomeLabel: 'My Site',
  appBasePath: '/blog',
  /**
   * Image presentation in posts.
   * - column: centered photo stack with captions (trip diary)
   * - inline: classic article flow (side-by-side ok)
   */
  imageLayout: 'column' as 'column' | 'inline',
  blogApiUrl: 'https://abc123.execute-api.us-east-1.amazonaws.com/prod',
  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_AbCdEfGhI',
    clientId: '1a2b3c4d5e6f7g8h9i0j',
    domain: 'myblog.auth.us-east-1.amazoncognito.com',
    redirectUri: 'http://localhost:4200/blog/admin',
    logoutUri: 'http://localhost:4200/blog/',
    allowedEmails: ['author@example.com']
  }
};
