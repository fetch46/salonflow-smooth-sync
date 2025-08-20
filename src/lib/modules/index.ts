// Module System for Organization-Scoped Features
export interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'core' | 'sales' | 'inventory' | 'financial' | 'operations';
  permissions: string[];
  dependencies?: string[];
  routes: ModuleRoute[];
}

export interface ModuleRoute {
  path: string;
  component: string;
  permissions?: string[];
  exact?: boolean;
}

export interface OrganizationModule {
  id: string;
  organization_id: string;
  module_name: string;
  is_enabled: boolean;
  enabled_at?: string;
  enabled_by?: string;
}

// Core modules definition
export const CORE_MODULES: Record<string, Module> = {
  appointments: {
    id: 'appointments',
    name: 'Appointments',
    description: 'Manage client appointments and scheduling',
    icon: 'Calendar',
    category: 'core',
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
    description: 'Manage clients, invoices, and sales activities',
    icon: 'CreditCard',
    category: 'sales',
    permissions: ['clients:view', 'invoices:view', 'payments:view'],
    routes: [
      { path: '/clients', component: 'Clients', permissions: ['clients:view'] },
      { path: '/invoices', component: 'Invoices', permissions: ['invoices:view'] },
      { path: '/payments', component: 'Payments', permissions: ['payments:view'] }
    ]
  },

  pos: {
    id: 'pos',
    name: 'Point of Sale',
    description: 'Point of sale system for retail operations',
    icon: 'CreditCard',
    category: 'sales',
    permissions: ['pos:access'],
    routes: [
      { path: '/pos', component: 'POS', permissions: ['pos:access'] }
    ]
  },

  job_cards: {
    id: 'job_cards',
    name: 'Job Cards',
    description: 'Manage service job cards and workflows',
    icon: 'FileText',
    category: 'operations',
    permissions: ['job_cards:view', 'job_cards:create', 'job_cards:edit'],
    dependencies: ['appointments'],
    routes: [
      { path: '/job-cards', component: 'JobCards', permissions: ['job_cards:view'] },
      { path: '/job-cards/new', component: 'CreateJobCard', permissions: ['job_cards:create'] },
      { path: '/job-cards/:id/edit', component: 'EditJobCard', permissions: ['job_cards:edit'] }
    ]
  },

  purchases: {
    id: 'purchases',
    name: 'Purchases',
    description: 'Manage suppliers, purchases, and goods received',
    icon: 'ShoppingCart',
    category: 'inventory',
    permissions: ['purchases:view', 'suppliers:view', 'goods_received:view'],
    routes: [
      { path: '/suppliers', component: 'Suppliers', permissions: ['suppliers:view'] },
      { path: '/purchases', component: 'Purchases', permissions: ['purchases:view'] },
      { path: '/goods-received', component: 'GoodsReceived', permissions: ['goods_received:view'] }
    ]
  },

  services: {
    id: 'services',
    name: 'Services',
    description: 'Manage service catalog and pricing',
    icon: 'Scissors',
    category: 'core',
    permissions: ['services:view', 'services:create', 'services:edit'],
    routes: [
      { path: '/services', component: 'Services', permissions: ['services:view'] },
      { path: '/services/new', component: 'ServiceForm', permissions: ['services:create'] },
      { path: '/services/:id/edit', component: 'ServiceForm', permissions: ['services:edit'] }
    ]
  },

  inventory: {
    id: 'inventory',
    name: 'Inventory',
    description: 'Manage products, stock levels, and transfers',
    icon: 'Package',
    category: 'inventory',
    permissions: ['inventory:view', 'inventory_adjustments:view', 'transfers:view'],
    routes: [
      { path: '/inventory', component: 'Inventory', permissions: ['inventory:view'] },
      { path: '/inventory-adjustments', component: 'InventoryAdjustments', permissions: ['inventory_adjustments:view'] },
      { path: '/inventory-transfers', component: 'StockTransfers', permissions: ['transfers:view'] }
    ]
  },

  accountant: {
    id: 'accountant',
    name: 'Accountant',
    description: 'Financial management and accounting features',
    icon: 'DollarSign',
    category: 'financial',
    permissions: ['accounting:view', 'banking:view', 'reports:view'],
    routes: [
      { path: '/accounts', component: 'Accounts', permissions: ['accounting:view'] },
      { path: '/journal', component: 'Journal', permissions: ['accounting:view'] },
      { path: '/banking', component: 'Banking', permissions: ['banking:view'] },
      { path: '/reports', component: 'Reports', permissions: ['reports:view'] }
    ]
  }
};

// Module utilities
export class ModuleManager {
  private enabledModules: Set<string> = new Set();
  private userPermissions: Set<string> = new Set();

  constructor(enabledModules: string[] = [], userPermissions: string[] = []) {
    this.enabledModules = new Set(enabledModules);
    this.userPermissions = new Set(userPermissions);
  }

  isModuleEnabled(moduleId: string): boolean {
    return this.enabledModules.has(moduleId);
  }

  hasPermission(permission: string): boolean {
    return this.userPermissions.has(permission);
  }

  canAccessModule(moduleId: string): boolean {
    const module = CORE_MODULES[moduleId];
    if (!module || !this.isModuleEnabled(moduleId)) {
      return false;
    }

    // Check if user has any of the required permissions
    return module.permissions.some(permission => this.hasPermission(permission));
  }

  getAvailableModules(): Module[] {
    return Object.values(CORE_MODULES).filter(module => 
      this.canAccessModule(module.id)
    );
  }

  getModuleRoutes(moduleId: string): ModuleRoute[] {
    const module = CORE_MODULES[moduleId];
    if (!module || !this.canAccessModule(moduleId)) {
      return [];
    }

    return module.routes.filter(route => 
      !route.permissions || route.permissions.some(permission => this.hasPermission(permission))
    );
  }

  checkDependencies(moduleId: string): { satisfied: boolean; missing: string[] } {
    const module = CORE_MODULES[moduleId];
    if (!module?.dependencies) {
      return { satisfied: true, missing: [] };
    }

    const missing = module.dependencies.filter(dep => !this.isModuleEnabled(dep));
    return { satisfied: missing.length === 0, missing };
  }
}

export default ModuleManager;