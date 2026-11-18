export const environment = {
  production: true,
  siteName: 'Blog',
  siteHomeUrl: 'https://loganborn.com/',
  siteHomeLabel: 'Logan Born',
  appBasePath: '/blog',
  blogApiUrl: 'https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod',
  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_XXXXXXXXX',
    clientId: 'YOUR_COGNITO_APP_CLIENT_ID',
    domain: 'YOUR_PREFIX.auth.us-east-1.amazoncognito.com',
    redirectUri: 'https://YOUR_DOMAIN/blog/admin',
    logoutUri: 'https://YOUR_DOMAIN/blog/',
    allowedEmails: ['you@example.com']
  }
};
