export const environment = {
  production: false,
  siteName: 'Blog',
  blogApiUrl: 'https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod',
  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_XXXXXXXXX',
    clientId: 'YOUR_COGNITO_APP_CLIENT_ID',
    domain: 'YOUR_PREFIX.auth.us-east-1.amazoncognito.com',
    redirectUri: 'http://localhost:4200/admin',
    logoutUri: 'http://localhost:4200/',
    allowedEmails: ['you@example.com']
  }
};
