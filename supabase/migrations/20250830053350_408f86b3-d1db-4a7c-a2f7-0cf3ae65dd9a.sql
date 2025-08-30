-- Trigger to automatically calculate commissions when job card services are inserted or updated
CREATE OR REPLACE FUNCTION calculate_job_card_commission()
RETURNS TRIGGER AS $$
DECLARE
    staff_commission_rate NUMERIC := 0;
    service_commission_rate NUMERIC := 0;
    final_commission_rate NUMERIC := 0;
    calculated_amount NUMERIC := 0;
BEGIN
    -- Get staff commission rate
    SELECT COALESCE(commission_rate, 0) INTO staff_commission_rate
    FROM staff 
    WHERE id = NEW.staff_id;
    
    -- Get service commission rate
    SELECT COALESCE(commission_percentage, 0) INTO service_commission_rate
    FROM services 
    WHERE id = NEW.service_id;
    
    -- Use override if provided, otherwise service rate, otherwise staff rate
    IF NEW.commission_percentage IS NOT NULL THEN
        final_commission_rate := NEW.commission_percentage;
    ELSIF service_commission_rate > 0 THEN
        final_commission_rate := service_commission_rate;
    ELSE
        final_commission_rate := staff_commission_rate;
    END IF;
    
    -- Calculate commission amount
    calculated_amount := (COALESCE(NEW.quantity, 1) * COALESCE(NEW.unit_price, 0) * final_commission_rate) / 100.0;
    
    -- Update the record
    NEW.commission_percentage := final_commission_rate;
    NEW.commission_amount := ROUND(calculated_amount, 2);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for job card services
DROP TRIGGER IF EXISTS trigger_calculate_job_card_commission ON job_card_services;
CREATE TRIGGER trigger_calculate_job_card_commission
    BEFORE INSERT OR UPDATE ON job_card_services
    FOR EACH ROW
    EXECUTE FUNCTION calculate_job_card_commission();

-- Trigger to deduct inventory when job card is completed
CREATE OR REPLACE FUNCTION deduct_inventory_on_completion()
RETURNS TRIGGER AS $$
DECLARE
    product_record RECORD;
    location_record RECORD;
    warehouse_record RECORD;
    org_location_id UUID;
BEGIN
    -- Only process when status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Get organization's default location
        SELECT bl.id INTO org_location_id 
        FROM business_locations bl 
        WHERE bl.organization_id = NEW.organization_id 
        AND bl.is_default = true 
        LIMIT 1;
        
        -- If no default location found, get any location for this org
        IF org_location_id IS NULL THEN
            SELECT bl.id INTO org_location_id 
            FROM business_locations bl 
            WHERE bl.organization_id = NEW.organization_id 
            LIMIT 1;
        END IF;
        
        -- Deduct inventory for each product used in this job card
        FOR product_record IN 
            SELECT inventory_item_id, quantity_used 
            FROM job_card_products 
            WHERE job_card_id = NEW.id
        LOOP
            -- Try to deduct from warehouse first (if available)
            UPDATE inventory_levels 
            SET quantity = GREATEST(0, quantity - product_record.quantity_used)
            WHERE item_id = product_record.inventory_item_id 
            AND warehouse_id IS NOT NULL
            AND quantity >= product_record.quantity_used;
            
            -- If not enough in warehouse or no warehouse, deduct from location
            IF NOT FOUND AND org_location_id IS NOT NULL THEN
                UPDATE inventory_levels 
                SET quantity = GREATEST(0, quantity - product_record.quantity_used)
                WHERE item_id = product_record.inventory_item_id 
                AND location_id = org_location_id;
                
                -- If no inventory level exists for this item at location, create it with negative quantity as a flag
                IF NOT FOUND THEN
                    INSERT INTO inventory_levels (item_id, location_id, quantity)
                    VALUES (product_record.inventory_item_id, org_location_id, -product_record.quantity_used)
                    ON CONFLICT (item_id, location_id) 
                    DO UPDATE SET quantity = GREATEST(0, inventory_levels.quantity - product_record.quantity_used);
                END IF;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for job card completion
DROP TRIGGER IF EXISTS trigger_deduct_inventory_on_completion ON job_cards;
CREATE TRIGGER trigger_deduct_inventory_on_completion
    AFTER UPDATE ON job_cards
    FOR EACH ROW
    EXECUTE FUNCTION deduct_inventory_on_completion();

-- Function to automatically create goods received after bill is saved
CREATE OR REPLACE FUNCTION auto_create_goods_received()
RETURNS TRIGGER AS $$
DECLARE
    gr_id UUID;
    org_location_id UUID;
    org_warehouse_id UUID;
BEGIN
    -- Only process when status changes to 'received' or 'approved'
    IF NEW.status IN ('received', 'approved') AND (OLD.status IS NULL OR OLD.status NOT IN ('received', 'approved')) THEN
        
        -- Get organization's default warehouse and location
        SELECT bl.id, bl.default_warehouse_id INTO org_location_id, org_warehouse_id
        FROM business_locations bl 
        WHERE bl.organization_id = NEW.organization_id 
        AND bl.is_default = true 
        LIMIT 1;
        
        -- If no default location found, get any location for this org
        IF org_location_id IS NULL THEN
            SELECT bl.id, bl.default_warehouse_id INTO org_location_id, org_warehouse_id
            FROM business_locations bl 
            WHERE bl.organization_id = NEW.organization_id 
            LIMIT 1;
        END IF;
        
        -- Use purchase location if available, otherwise org default
        IF NEW.location_id IS NOT NULL THEN
            org_location_id := NEW.location_id;
        END IF;
        
        -- Create goods received record
        INSERT INTO goods_received (
            organization_id,
            purchase_id,
            location_id,
            warehouse_id,
            received_date,
            grn_number,
            notes
        ) VALUES (
            NEW.organization_id,
            NEW.id,
            org_location_id,
            org_warehouse_id,
            COALESCE(NEW.purchase_date, CURRENT_DATE),
            'GRN-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random()*100000))::text, 5, '0'),
            'Auto-created from purchase ' || COALESCE(NEW.purchase_number, NEW.id::text)
        ) RETURNING id INTO gr_id;
        
        -- Create goods received items for all purchase items
        INSERT INTO goods_received_items (
            goods_received_id,
            purchase_item_id,
            item_id,
            quantity,
            unit_cost
        )
        SELECT 
            gr_id,
            pi.id,
            pi.item_id,
            pi.quantity,
            pi.unit_cost
        FROM purchase_items pi
        WHERE pi.purchase_id = NEW.id;
        
        -- Update purchase items received quantities
        UPDATE purchase_items 
        SET received_quantity = quantity 
        WHERE purchase_id = NEW.id;
        
        -- Update inventory levels
        INSERT INTO inventory_levels (item_id, location_id, warehouse_id, quantity)
        SELECT 
            pi.item_id,
            org_location_id,
            org_warehouse_id,
            pi.quantity
        FROM purchase_items pi
        WHERE pi.purchase_id = NEW.id
        ON CONFLICT (item_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET quantity = inventory_levels.quantity + EXCLUDED.quantity;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic goods received creation
DROP TRIGGER IF EXISTS trigger_auto_create_goods_received ON purchases;
CREATE TRIGGER trigger_auto_create_goods_received
    AFTER UPDATE ON purchases
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_goods_received();