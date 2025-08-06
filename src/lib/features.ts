// Feature Definitions for SAAS Platform
export interface FeatureLimit {
  max?: number; // Maximum allowed (undefined = unlimited)
  enabled: boolean;
}

export interface FeatureLimits {
  // Core Features
  appointments: FeatureLimit;
  clients: FeatureLimit;
  staff: FeatureLimit;
  services: FeatureLimit;
  
  // Inventory & Products
  inventory: FeatureLimit;
  inventory_adjustments: FeatureLimit;
  suppliers: FeatureLimit;
  
  // Financial Features
  expenses: FeatureLimit;
  purchases: FeatureLimit;
  accounting: FeatureLimit;
  pos: FeatureLimit;
  invoices: FeatureLimit;
  
  // Advanced Features
  job_cards: FeatureLimit;
  reports: FeatureLimit;
  advanced_reports: FeatureLimit;
  analytics: FeatureLimit;
  
  // Integration Features
  integrations: FeatureLimit;
  api_access: FeatureLimit;
  webhooks: FeatureLimit;
  
  // Customization Features
  white_label: FeatureLimit;
  custom_branding: FeatureLimit;
  custom_domains: FeatureLimit;
  
  // Communication Features
  sms_notifications: FeatureLimit;
  email_marketing: FeatureLimit;
  whatsapp_integration: FeatureLimit;
  
  // Organizational Limits
  max_users: FeatureLimit;
  max_locations: FeatureLimit;
  max_storage_gb: FeatureLimit;
  
  // Support Features
  priority_support: FeatureLimit;
  phone_support: FeatureLimit;
  dedicated_manager: FeatureLimit;
}

// Plan-specific feature configurations
export const PLAN_FEATURES: Record<string, FeatureLimits> = {
  starter: {
    // Core Features
    appointments: { enabled: true, max: 500 }, // 500 appointments per month
    clients: { enabled: true, max: 100 },
    staff: { enabled: true, max: 5 },
    services: { enabled: true, max: 20 },
    
    // Inventory & Products
    inventory: { enabled: false },
    inventory_adjustments: { enabled: false },
    suppliers: { enabled: false },
    
    // Financial Features
    expenses: { enabled: false },
    purchases: { enabled: false },
    accounting: { enabled: false },
    pos: { enabled: false },
    invoices: { enabled: true, max: 100 }, // Basic invoicing
    
    // Advanced Features
    job_cards: { enabled: false },
    reports: { enabled: true }, // Basic reports only
    advanced_reports: { enabled: false },
    analytics: { enabled: false },
    
    // Integration Features
    integrations: { enabled: false },
    api_access: { enabled: false },
    webhooks: { enabled: false },
    
    // Customization Features
    white_label: { enabled: false },
    custom_branding: { enabled: false },
    custom_domains: { enabled: false },
    
    // Communication Features
    sms_notifications: { enabled: false },
    email_marketing: { enabled: false },
    whatsapp_integration: { enabled: false },
    
    // Organizational Limits
    max_users: { enabled: true, max: 5 },
    max_locations: { enabled: true, max: 1 },
    max_storage_gb: { enabled: true, max: 1 },
    
    // Support Features
    priority_support: { enabled: false },
    phone_support: { enabled: false },
    dedicated_manager: { enabled: false },
  },
  
  professional: {
    // Core Features
    appointments: { enabled: true, max: 2000 }, // 2000 appointments per month
    clients: { enabled: true, max: 1000 },
    staff: { enabled: true, max: 25 },
    services: { enabled: true }, // Unlimited
    
    // Inventory & Products
    inventory: { enabled: true },
    inventory_adjustments: { enabled: true },
    suppliers: { enabled: true, max: 50 },
    
    // Financial Features
    expenses: { enabled: true },
    purchases: { enabled: true },
    accounting: { enabled: true },
    pos: { enabled: true },
    invoices: { enabled: true, max: 1000 },
    
    // Advanced Features
    job_cards: { enabled: true },
    reports: { enabled: true },
    advanced_reports: { enabled: true },
    analytics: { enabled: true },
    
    // Integration Features
    integrations: { enabled: true, max: 5 },
    api_access: { enabled: false },
    webhooks: { enabled: false },
    
    // Customization Features
    white_label: { enabled: false },
    custom_branding: { enabled: true },
    custom_domains: { enabled: false },
    
    // Communication Features
    sms_notifications: { enabled: true, max: 500 }, // 500 SMS per month
    email_marketing: { enabled: true, max: 1000 }, // 1000 emails per month
    whatsapp_integration: { enabled: true },
    
    // Organizational Limits
    max_users: { enabled: true, max: 25 },
    max_locations: { enabled: true, max: 3 },
    max_storage_gb: { enabled: true, max: 10 },
    
    // Support Features
    priority_support: { enabled: true },
    phone_support: { enabled: false },
    dedicated_manager: { enabled: false },
  },
  
  enterprise: {
    // Core Features
    appointments: { enabled: true }, // Unlimited
    clients: { enabled: true }, // Unlimited
    staff: { enabled: true, max: 100 },
    services: { enabled: true }, // Unlimited
    
    // Inventory & Products
    inventory: { enabled: true },
    inventory_adjustments: { enabled: true },
    suppliers: { enabled: true }, // Unlimited
    
    // Financial Features
    expenses: { enabled: true },
    purchases: { enabled: true },
    accounting: { enabled: true },
    pos: { enabled: true },
    invoices: { enabled: true }, // Unlimited
    
    // Advanced Features
    job_cards: { enabled: true },
    reports: { enabled: true },
    advanced_reports: { enabled: true },
    analytics: { enabled: true },
    
    // Integration Features
    integrations: { enabled: true }, // Unlimited
    api_access: { enabled: true },
    webhooks: { enabled: true },
    
    // Customization Features
    white_label: { enabled: true },
    custom_branding: { enabled: true },
    custom_domains: { enabled: true },
    
    // Communication Features
    sms_notifications: { enabled: true }, // Unlimited
    email_marketing: { enabled: true }, // Unlimited
    whatsapp_integration: { enabled: true },
    
    // Organizational Limits
    max_users: { enabled: true, max: 100 },
    max_locations: { enabled: true, max: 10 },
    max_storage_gb: { enabled: true, max: 100 },
    
    // Support Features
    priority_support: { enabled: true },
    phone_support: { enabled: true },
    dedicated_manager: { enabled: true },
  },
};

// Feature categories for UI organization
export const FEATURE_CATEGORIES = {
  core: {
    label: 'Core Features',
    features: ['appointments', 'clients', 'staff', 'services'],
  },
  inventory: {
    label: 'Inventory Management',
    features: ['inventory', 'inventory_adjustments', 'suppliers'],
  },
  financial: {
    label: 'Financial Management',
    features: ['expenses', 'purchases', 'accounting', 'pos', 'invoices'],
  },
  advanced: {
    label: 'Advanced Features',
    features: ['job_cards', 'reports', 'advanced_reports', 'analytics'],
  },
  integrations: {
    label: 'Integrations & API',
    features: ['integrations', 'api_access', 'webhooks'],
  },
  customization: {
    label: 'Customization',
    features: ['white_label', 'custom_branding', 'custom_domains'],
  },
  communication: {
    label: 'Communication',
    features: ['sms_notifications', 'email_marketing', 'whatsapp_integration'],
  },
  limits: {
    label: 'Organizational Limits',
    features: ['max_users', 'max_locations', 'max_storage_gb'],
  },
  support: {
    label: 'Support',
    features: ['priority_support', 'phone_support', 'dedicated_manager'],
  },
};

// Feature labels for display
export const FEATURE_LABELS: Record<string, string> = {
  // Core Features
  appointments: 'Appointment Management',
  clients: 'Client Management',
  staff: 'Staff Management',
  services: 'Service Management',
  
  // Inventory & Products
  inventory: 'Inventory Management',
  inventory_adjustments: 'Inventory Adjustments',
  suppliers: 'Supplier Management',
  
  // Financial Features
  expenses: 'Expense Tracking',
  purchases: 'Purchase Management',
  accounting: 'Chart of Accounts',
  pos: 'Point of Sale',
  invoices: 'Invoice Management',
  
  // Advanced Features
  job_cards: 'Job Card Workflow',
  reports: 'Basic Reports',
  advanced_reports: 'Advanced Analytics',
  analytics: 'Business Intelligence',
  
  // Integration Features
  integrations: 'Third-party Integrations',
  api_access: 'REST API Access',
  webhooks: 'Webhook Support',
  
  // Customization Features
  white_label: 'White Label Branding',
  custom_branding: 'Custom Branding',
  custom_domains: 'Custom Domain Names',
  
  // Communication Features
  sms_notifications: 'SMS Notifications',
  email_marketing: 'Email Marketing',
  whatsapp_integration: 'WhatsApp Integration',
  
  // Organizational Limits
  max_users: 'Team Members',
  max_locations: 'Business Locations',
  max_storage_gb: 'File Storage',
  
  // Support Features
  priority_support: 'Priority Email Support',
  phone_support: 'Phone Support',
  dedicated_manager: 'Dedicated Account Manager',
};

// Feature descriptions for tooltips and help text
export const FEATURE_DESCRIPTIONS: Record<string, string> = {
  appointments: 'Manage client appointments with calendar integration and automated reminders',
  clients: 'Comprehensive client database with history, preferences, and analytics',
  staff: 'Staff scheduling, commission tracking, and performance management',
  services: 'Service catalog with pricing, duration, and kit management',
  
  inventory: 'Track product inventory, stock levels, and automatic reorder points',
  inventory_adjustments: 'Manage stock adjustments with approval workflows',
  suppliers: 'Supplier database with contact information and purchase history',
  
  expenses: 'Track business expenses with receipt uploads and categorization',
  purchases: 'Purchase order management and vendor bill tracking',
  accounting: 'Full chart of accounts with financial reporting',
  pos: 'Point of sale system for retail product sales',
  invoices: 'Professional invoice generation and payment tracking',
  
  job_cards: 'Complete workflow from booking to completion with product tracking',
  reports: 'Basic financial and operational reports',
  advanced_reports: 'Advanced analytics with custom dashboards',
  analytics: 'Business intelligence with predictive insights',
  
  integrations: 'Connect with popular third-party services and tools',
  api_access: 'Full REST API access for custom integrations',
  webhooks: 'Real-time event notifications for external systems',
  
  white_label: 'Remove all branding and use your own company branding',
  custom_branding: 'Customize colors, logos, and basic branding elements',
  custom_domains: 'Use your own domain name for the application',
  
  sms_notifications: 'Send automated SMS reminders and notifications',
  email_marketing: 'Email campaigns and automated marketing sequences',
  whatsapp_integration: 'WhatsApp Business API for client communication',
  
  max_users: 'Maximum number of staff members who can access the system',
  max_locations: 'Number of business locations you can manage',
  max_storage_gb: 'File storage limit for photos, documents, and receipts',
  
  priority_support: 'Priority email support with faster response times',
  phone_support: 'Direct phone support during business hours',
  dedicated_manager: 'Dedicated account manager for enterprise customers',
};