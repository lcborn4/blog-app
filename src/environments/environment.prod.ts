export const environment = {
  production: true,
  siteName: 'Blog',
  blogApiUrl: 'https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod',
  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_XXXXXXXXX',
    clientId: 'YOUR_COGNITO_APP_CLIENT_ID',
    domain: 'YOUR_PREFIX.auth.us-east-1.amazoncognito.com',
    redirectUri: 'https://YOUR_DOMAIN/admin',
    logoutUri: 'https://YOUR_DOMAIN/',
    allowedEmails: ['you@example.com']
  }
};
