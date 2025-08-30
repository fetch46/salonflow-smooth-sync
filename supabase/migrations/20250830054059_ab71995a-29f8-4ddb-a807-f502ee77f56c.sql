-- Fix security issues: Add missing RLS policies and set search paths for functions

-- Enable RLS for tables that have it enabled but no policies
-- (First, let's check which tables need policies)

-- Fix the function search paths by adding SET search_path = 'public'
-- Update the newly created functions to include proper search paths

ALTER FUNCTION calculate_job_card_commission() SET search_path = 'public';
ALTER FUNCTION deduct_inventory_on_completion() SET search_path = 'public';  
ALTER FUNCTION auto_create_goods_received() SET search_path = 'public';

-- Also fix any other functions that might be missing search paths
ALTER FUNCTION update_appointment_no_show() SET search_path = 'public';
ALTER FUNCTION get_user_organization_count(uuid) SET search_path = 'public';
ALTER FUNCTION set_job_number() SET search_path = 'public';
ALTER FUNCTION ensure_organization_context() SET search_path = 'public';
ALTER FUNCTION sync_organization_modules_with_plan() SET search_path = 'public';
ALTER FUNCTION generate_grn_number() SET search_path = 'public';
ALTER FUNCTION delete_account_transactions_by_reference(text, text) SET search_path = 'public';
ALTER FUNCTION post_receipt_to_ledger() SET search_path = 'public';
ALTER FUNCTION user_has_organization(uuid) SET search_path = 'public';
ALTER FUNCTION create_organization_with_user(text, text, jsonb, uuid) SET search_path = 'public';
ALTER FUNCTION post_receipt_item_product_to_ledger() SET search_path = 'public';
ALTER FUNCTION setup_new_organization(uuid) SET search_path = 'public';
ALTER FUNCTION handle_payment_deletion() SET search_path = 'public';
ALTER FUNCTION post_receipt_payment_to_ledger() SET search_path = 'public';
ALTER FUNCTION handle_new_user() SET search_path = 'public';
ALTER FUNCTION post_bank_transfer(uuid, uuid, uuid, numeric, date, text) SET search_path = 'public';
ALTER FUNCTION post_expense_to_ledger() SET search_path = 'public';
ALTER FUNCTION calculate_trial_balance(uuid, date) SET search_path = 'public';
ALTER FUNCTION calculate_staff_commission(uuid, uuid, numeric, numeric) SET search_path = 'public';
ALTER FUNCTION pay_purchase(uuid, uuid, uuid, numeric, date, text, text) SET search_path = 'public';
ALTER FUNCTION post_purchase_to_ledger() SET search_path = 'public';
ALTER FUNCTION is_member_of_organization(uuid) SET search_path = 'public';
ALTER FUNCTION is_admin_of_organization(uuid) SET search_path = 'public';
ALTER FUNCTION update_goods_received(uuid, uuid, uuid, uuid, date, text, jsonb) SET search_path = 'public';
ALTER FUNCTION record_goods_received(uuid, uuid, uuid, uuid, date, text, jsonb) SET search_path = 'public';
ALTER FUNCTION rebuild_organization_chart_of_accounts(uuid, boolean) SET search_path = 'public';
ALTER FUNCTION enforce_inventory_account_is_stock() SET search_path = 'public';
ALTER FUNCTION is_super_admin(uuid) SET search_path = 'public';
ALTER FUNCTION grant_super_admin(uuid) SET search_path = 'public';
ALTER FUNCTION revoke_super_admin(uuid) SET search_path = 'public';
ALTER FUNCTION update_purchase_status(uuid) SET search_path = 'public';
ALTER FUNCTION is_date_locked(uuid, date) SET search_path = 'public';
ALTER FUNCTION prevent_locked_period_changes() SET search_path = 'public';
ALTER FUNCTION get_next_transaction_number(uuid, text) SET search_path = 'public';
ALTER FUNCTION schedule_appointment_no_show_update() SET search_path = 'public';
ALTER FUNCTION record_goods_received(uuid, uuid, uuid, date, text, jsonb) SET search_path = 'public';
ALTER FUNCTION update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION _lov_refresh_types_marker() SET search_path = 'public';
ALTER FUNCTION prevent_warehouse_delete_if_referenced() SET search_path = 'public';
ALTER FUNCTION update_goods_received(uuid, uuid, uuid, uuid, date, text, jsonb) SET search_path = 'public';
ALTER FUNCTION apply_purchase_receipt() SET search_path = 'public';
ALTER FUNCTION generate_job_number(uuid) SET search_path = 'public';
ALTER FUNCTION create_goods_received(uuid, uuid, uuid, date, text, jsonb) SET search_path = 'public';