const productionRequired = [
  'MONGO_URI',
  'JWT_SECRET',
  'CLIENT_URL',
  'SERVER_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'COOKIE_NAME',
] as const;

const googleVariables = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
] as const;

const missing = (keys: readonly string[]) =>
  keys.filter((key) => !process.env[key]?.trim());

export const validateEnvironment = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const missingRequired = missing(productionRequired);

  if (isProduction && missingRequired.length) {
    throw new Error(
      `Missing required production environment variables: ${missingRequired.join(', ')}`,
    );
  }

  if (!isProduction) {
    const missingGoogle = missing(googleVariables);
    if (missingGoogle.length) {
      console.warn(
        `Google OAuth redirect login is not fully configured: ${missingGoogle.join(', ')}`,
      );
    }
  }

  if (isProduction && process.env.DEV_AUTH_ENABLED === 'true') {
    console.warn('DEV_AUTH_ENABLED is ignored in production');
  }
};

