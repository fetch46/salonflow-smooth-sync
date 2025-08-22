// Core module system for organizing application features
export interface ModuleRoute {
  path: string;
  component: string;
  permissions?: string[];
  exact?: boolean;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  permissions: string[];
  dependencies?: string[];
  routes: ModuleRoute[];
}

export interface OrganizationModule {
  id: string;
  organization_id: string;
  module_name: string;
  is_enabled: boolean;
  enabled_at?: string;
  enabled_by?: string;
}

// Define core modules available in the system
export const CORE_MODULES: Record<string, Module> = {
  appointments: {
    id: 'appointments',
    name: 'Appointments',
    description: 'Schedule and manage client appointments',
    icon: 'Calendar',
    category: 'Customer Management',
    permissions: ['appointments:view', 'appointments:create', 'appointments:edit', 'appointments:delete'],
    routes: [
      { path: '/appointments', component: 'Appointments', permissions: ['appointments:view'] },
      { path: '/appointments/new', component: 'AppointmentForm', permissions: ['appointments:create'] },
      { path: '/appointments/:id/edit', component: 'AppointmentForm', permissions: ['appointments:edit'] }
    ]
  },
  sales: {
    id: 'sales',
    name: 'Sales',
    description: 'Manage clients, invoices, and payments',
    icon: 'DollarSign',
    category: 'Sales Management',
    permissions: ['clients:view', 'clients:create', 'clients:edit', 'invoices:view', 'invoices:create', 'payments:view'],
    routes: [
      { path: '/clients', component: 'Clients', permissions: ['clients:view'] },
      { path: '/clients/:id', component: 'ClientProfile', permissions: ['clients:view'] },
      { path: '/invoices', component: 'Invoices', permissions: ['invoices:view'] },
      { path: '/invoices/new', component: 'InvoiceCreate', permissions: ['invoices:create'] },
      { path: '/payments', component: 'Payments', permissions: ['payments:view'] }
    ]
  },
  pos: {
    id: 'pos',
    name: 'Point of Sale',
    description: 'Quick sales and payment processing',
    icon: 'CreditCard',
    category: 'Sales Management',
    permissions: ['pos:access', 'sales:create'],
    routes: [
      { path: '/pos', component: 'POS', permissions: ['pos:access'] }
    ]
  },
  job_cards: {
    id: 'job_cards',
    name: 'Job Cards',
    description: 'Track work orders and service jobs',
    icon: 'ClipboardList',
    category: 'Operations',
    permissions: ['job_cards:view', 'job_cards:create', 'job_cards:edit', 'job_cards:delete'],
    routes: [
      { path: '/job-cards', component: 'JobCards', permissions: ['job_cards:view'] },
      { path: '/job-cards/new', component: 'CreateJobCard', permissions: ['job_cards:create'] },
      { path: '/job-cards/:id', component: 'JobCardView', permissions: ['job_cards:view'] },
      { path: '/job-cards/:id/edit', component: 'EditJobCard', permissions: ['job_cards:edit'] }
    ]
  },
  purchases: {
    id: 'purchases',
    name: 'Purchases',
    description: 'Manage suppliers, purchases, and expenses',
    icon: 'ShoppingCart',
    category: 'Procurement',
    permissions: ['purchases:view', 'purchases:create', 'suppliers:view', 'expenses:view'],
    routes: [
      { path: '/suppliers', component: 'Suppliers', permissions: ['suppliers:view'] },
      { path: '/purchases', component: 'Purchases', permissions: ['purchases:view'] },
      { path: '/purchases/new', component: 'PurchaseForm', permissions: ['purchases:create'] },
      { path: '/goods-received', component: 'GoodsReceived', permissions: ['purchases:view'] },
      { path: '/expenses', component: 'Expenses', permissions: ['expenses:view'] }
    ]
  },
  services: {
    id: 'services',
    name: 'Services',
    description: 'Define and manage service offerings',
    icon: 'Settings',
    category: 'Service Management',
    permissions: ['services:view', 'services:create', 'services:edit', 'services:delete'],
    routes: [
      { path: '/services', component: 'Services', permissions: ['services:view'] },
      { path: '/services/new', component: 'ServiceForm', permissions: ['services:create'] },
      { path: '/services/:id', component: 'ServiceView', permissions: ['services:view'] },
      { path: '/services/:id/edit', component: 'ServiceForm', permissions: ['services:edit'] }
    ]
  },
  inventory: {
    id: 'inventory',
    name: 'Inventory',
    description: 'Manage products, stock levels, and transfers',
    icon: 'Package',
    category: 'Inventory Management',
    permissions: ['inventory:view', 'inventory:create', 'inventory:edit', 'transfers:view'],
    routes: [
      { path: '/inventory', component: 'Inventory', permissions: ['inventory:view'] },
      { path: '/inventory/new', component: 'ProductForm', permissions: ['inventory:create'] },
      { path: '/inventory/:id', component: 'ProductView', permissions: ['inventory:view'] },
      { path: '/inventory-adjustments', component: 'InventoryAdjustments', permissions: ['inventory:edit'] },
      { path: '/inventory-transfers', component: 'StockTransfers', permissions: ['transfers:view'] }
    ]
  },
  accountant: {
    id: 'accountant',
    name: 'Accounting',
    description: 'Financial management and reporting',
    icon: 'Calculator',
    category: 'Financial Management',
    permissions: ['accounting:view', 'banking:view', 'reports:view'],
    routes: [
      { path: '/banking', component: 'Banking', permissions: ['banking:view'] },
      { path: '/accounts', component: 'Accounts', permissions: ['accounting:view'] },
      { path: '/journal', component: 'Journal', permissions: ['accounting:view'] },
      { path: '/reports', component: 'Reports', permissions: ['reports:view'] }
    ]
  }
};

export class ModuleManager {
  private enabledModules: string[];
  private userPermissions: string[];

  constructor(enabledModules: string[] = [], userPermissions: string[] = []) {
    this.enabledModules = enabledModules;
    this.userPermissions = userPermissions;
  }

  /**
   * Check if a module is enabled for the organization
   */
  isModuleEnabled(moduleId: string): boolean {
    return this.enabledModules.includes(moduleId);
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: string): boolean {
    return this.userPermissions.includes(permission);
  }

  /**
   * Check if user can access a module (module enabled + has required permissions)
   */
  canAccessModule(moduleId: string): boolean {
    const module = CORE_MODULES[moduleId];
    if (!module || !this.isModuleEnabled(moduleId)) {
      return false;
    }

    // Check if user has at least one required permission
    return module.permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Get all modules that the user can access
   */
  getAvailableModules(): Module[] {
    return Object.values(CORE_MODULES).filter(module => 
      this.canAccessModule(module.id)
    );
  }

  /**
   * Get accessible routes for a specific module
   */
  getModuleRoutes(moduleId: string): ModuleRoute[] {
    if (!this.canAccessModule(moduleId)) {
      return [];
    }

    const module = CORE_MODULES[moduleId];
    return module.routes.filter(route => {
      if (!route.permissions) return true;
      return route.permissions.some(permission => this.hasPermission(permission));
    });
  }

  /**
   * Check module dependencies
   */
  checkDependencies(moduleId: string): { satisfied: boolean; missing: string[] } {
    const module = CORE_MODULES[moduleId];
    if (!module?.dependencies) {
      return { satisfied: true, missing: [] };
    }

    const missing = module.dependencies.filter(dep => !this.isModuleEnabled(dep));
    return {
      satisfied: missing.length === 0,
      missing
    };
  }
}