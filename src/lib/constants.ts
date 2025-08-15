// Application constants and configuration

export const APP_CONFIG = {
  // Feature flags
  FEATURES: {
    OFFLINE_MODE: true,
    ANALYTICS: true,
    NOTIFICATIONS: true,
  },
  
  // Limits and constraints
  LIMITS: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_DESCRIPTION_LENGTH: 1000,
    MAX_NAME_LENGTH: 255,
    MAX_ITEMS_PER_PAGE: 100,
  },
  
  // Cache settings
  CACHE: {
    DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
    USER_DATA_TTL: 10 * 60 * 1000, // 10 minutes
    ORGANIZATIONS_TTL: 15 * 60 * 1000, // 15 minutes
  },
  
  // UI settings
  UI: {
    DEBOUNCE_DELAY: 300,
    TOAST_DURATION: 5000,
    PAGINATION_SIZES: [10, 25, 50, 100],
  },
} as const;

export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  ACCOUNTS: '/api/accounts',
  PRODUCTS: '/api/products',
  REPORTS: '/api/reports',
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  NOT_FOUND: 'The requested resource was not found.',
} as const;