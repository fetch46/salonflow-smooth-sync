import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Enhanced deletion utility that properly handles related records and database cleanup
 */
export const deleteRecord = async (
  table: string, 
  id: string, 
  options?: {
    cascadeRules?: Array<{
      table: string;
      foreignKey: string;
      action: 'delete' | 'nullify';
    }>;
    customValidation?: (id: string) => Promise<{ canDelete: boolean; message?: string }>;
    accountingCleanup?: boolean;
  }
) => {
  try {
    // Run custom validation if provided
    if (options?.customValidation) {
      const validation = await options.customValidation(id);
      if (!validation.canDelete) {
        throw new Error(validation.message || 'Cannot delete this record');
      }
    }

    // Handle cascade deletions
    if (options?.cascadeRules) {
      for (const rule of options.cascadeRules) {
        if (rule.action === 'delete') {
          const { error } = await (supabase as any)
            .from(rule.table)
            .delete()
            .eq(rule.foreignKey, id);
          if (error) throw error;
        } else if (rule.action === 'nullify') {
          const { error } = await (supabase as any)
            .from(rule.table)
            .update({ [rule.foreignKey]: null })
            .eq(rule.foreignKey, id);
          if (error) throw error;
        }
      }
    }

    // Clean up accounting transactions if requested
    if (options?.accountingCleanup) {
      await supabase
        .from('account_transactions')
        .delete()
        .eq('reference_id', id);
    }

    // Delete the main record
    const { error } = await (supabase as any)
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting ${table} record:`, error);
    toast.error(error.message || `Failed to delete ${table} record`);
    return { success: false, error: error.message };
  }
};

/**
 * Common deletion patterns for different entities
 */
export const deletionPatterns = {
  service: (id: string) => deleteRecord('services', id, {
    cascadeRules: [
      { table: 'service_kits', foreignKey: 'service_id', action: 'delete' },
      { table: 'appointment_services', foreignKey: 'service_id', action: 'nullify' },
      { table: 'job_card_services', foreignKey: 'service_id', action: 'nullify' },
      { table: 'invoice_items', foreignKey: 'service_id', action: 'nullify' }
    ]
  }),

  client: (id: string) => deleteRecord('clients', id, {
    customValidation: async (clientId) => {
      // Check for active appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id')
        .eq('client_id', clientId)
        .in('status', ['scheduled', 'confirmed']);
      
      if (appointments && appointments.length > 0) {
        return { 
          canDelete: false, 
          message: 'Cannot delete client with active appointments. Please cancel or complete appointments first.' 
        };
      }
      return { canDelete: true };
    },
    cascadeRules: [
      { table: 'appointments', foreignKey: 'client_id', action: 'delete' },
      { table: 'invoices', foreignKey: 'client_id', action: 'nullify' },
      { table: 'job_cards', foreignKey: 'client_id', action: 'nullify' }
    ]
  }),

  staff: (id: string) => deleteRecord('staff', id, {
    cascadeRules: [
      { table: 'appointments', foreignKey: 'staff_id', action: 'nullify' },
      { table: 'job_card_services', foreignKey: 'staff_id', action: 'nullify' },
      { table: 'invoice_items', foreignKey: 'staff_id', action: 'nullify' },
      { table: 'staff_commissions', foreignKey: 'staff_id', action: 'delete' }
    ]
  }),

  inventoryItem: (id: string) => deleteRecord('inventory_items', id, {
    customValidation: async (itemId) => {
      // Check for existing stock levels
      const { data: levels } = await supabase
        .from('inventory_levels')
        .select('quantity')
        .eq('item_id', itemId);
      
      const totalStock = levels?.reduce((sum, level) => sum + (level.quantity || 0), 0) || 0;
      if (totalStock > 0) {
        return { 
          canDelete: false, 
          message: 'Cannot delete item with existing stock. Please adjust inventory to zero first.' 
        };
      }
      return { canDelete: true };
    },
    cascadeRules: [
      { table: 'inventory_levels', foreignKey: 'item_id', action: 'delete' },
      { table: 'service_kits', foreignKey: 'good_id', action: 'delete' },
      { table: 'purchase_items', foreignKey: 'item_id', action: 'delete' },
      { table: 'goods_received_items', foreignKey: 'item_id', action: 'delete' }
    ]
  }),

  expense: (id: string) => deleteRecord('expenses', id, {
    accountingCleanup: true
  }),

  purchase: (id: string) => deleteRecord('purchases', id, {
    cascadeRules: [
      { table: 'purchase_items', foreignKey: 'purchase_id', action: 'delete' },
      { table: 'goods_received', foreignKey: 'purchase_id', action: 'delete' },
      { table: 'purchase_payments', foreignKey: 'purchase_id', action: 'delete' }
    ],
    accountingCleanup: true
  }),

  invoice: (id: string) => deleteRecord('invoices', id, {
    cascadeRules: [
      { table: 'invoice_items', foreignKey: 'invoice_id', action: 'delete' },
      { table: 'invoice_payments', foreignKey: 'invoice_id', action: 'delete' },
      { table: 'staff_commissions', foreignKey: 'invoice_id', action: 'delete' }
    ],
    accountingCleanup: true
  }),

  goodsReceived: (id: string) => deleteRecord('goods_received', id, {
    cascadeRules: [
      { table: 'goods_received_items', foreignKey: 'goods_received_id', action: 'delete' }
    ],
    accountingCleanup: true
  })
};