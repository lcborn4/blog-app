export const environment = {
  production: false,
  siteName: 'Blog',
  /** Link back to the main personal/portfolio site */
  siteHomeUrl: 'http://localhost:4200/',
  siteHomeLabel: 'Logan Born',
  appBasePath: '/blog',
  blogApiUrl: 'https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod',
  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_XXXXXXXXX',
    clientId: 'YOUR_COGNITO_APP_CLIENT_ID',
    domain: 'YOUR_PREFIX.auth.us-east-1.amazoncognito.com',
    redirectUri: 'http://localhost:4200/blog/admin',
    logoutUri: 'http://localhost:4200/blog/',
    allowedEmails: ['you@example.com']
  }
};
