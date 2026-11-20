export const environment = {
  production: true,
  useDemoData: false,
  siteName: 'Blog',
  siteHomeUrl: '',
  siteHomeLabel: '',
  appBasePath: '/blog',
  /** column = trip photo diary; inline = classic article */
  imageLayout: 'inline' as 'column' | 'inline',
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
