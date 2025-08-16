@@ .. @@
     required_tables TEXT[] := ARRAY[
         'profiles', 'clients', 'staff', 'services', 'appointments', 
         'inventory_items', 'business_locations', 'inventory_levels', 
         'service_kits', 'job_cards', 'job_card_services', 'job_card_products', 'expenses', 
         'purchases', 'purchase_items', 'suppliers', 'accounts', 
         'account_transactions', 'sales', 'sale_items', 'invoices', 
         'invoice_items', 'inventory_adjustments', 'inventory_adjustment_items', 'staff_commissions',
         'organizations', 'organization_users', 'organization_subscriptions',
-        'subscription_plans', 'user_invitations', 'super_admins'
+        'subscription_plans', 'user_invitations', 'super_admins',
+        'business_listings', 'landing_settings'
     ];
     table_name TEXT;