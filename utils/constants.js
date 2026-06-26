// API Response templates
export const SUCCESS_RESPONSE = (data, message = 'Success') => ({
  success: true,
  message,
  data,
});

export const ERROR_RESPONSE = (message = 'Error', error = null) => ({
  success: false,
  message,
  ...(process.env.NODE_ENV === 'development' && { error }),
});

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// Request timeout
export const REQUEST_TIMEOUT = 30000; // 30 seconds

// Database
export const DB_MODELS = {
  EXAMPLE: 'Example',
  // Add your models here
};

export default {
  SUCCESS_RESPONSE,
  ERROR_RESPONSE,
  HTTP_STATUS,
  REQUEST_TIMEOUT,
  DB_MODELS,
};
