-- 016: Create performance indexes

-- Users
CREATE INDEX idx_users_role ON users(role);

-- Clients
CREATE INDEX idx_clients_client_type ON clients(client_type);
CREATE INDEX idx_clients_name ON clients(name);

-- Client contacts
CREATE INDEX idx_client_contacts_client_id ON client_contacts(client_id);

-- Suppliers
CREATE INDEX idx_suppliers_name ON suppliers(name);

-- Products
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(active);

-- Inventory items
CREATE INDEX idx_inventory_items_category ON inventory_items(category);
CREATE INDEX idx_inventory_items_supplier_id ON inventory_items(supplier_id);
CREATE INDEX idx_inventory_items_low_stock ON inventory_items(current_quantity, minimum_stock_level)
    WHERE current_quantity <= minimum_stock_level;

-- Product materials
CREATE INDEX idx_product_materials_inventory_item_id ON product_materials(inventory_item_id);

-- Orders
CREATE INDEX idx_orders_client_id ON orders(client_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_production_status ON orders(production_status);
CREATE INDEX idx_orders_created_by ON orders(created_by);

-- Order items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Order status history
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_changed_at ON order_status_history(changed_at);

-- Payments
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- Inventory transactions
CREATE INDEX idx_inventory_transactions_item_id ON inventory_transactions(inventory_item_id);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_transactions_created_at ON inventory_transactions(created_at);
CREATE INDEX idx_inventory_transactions_reference ON inventory_transactions(reference_type, reference_id);

-- Expenses
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_supplier_id ON expenses(supplier_id);

-- Purchases
CREATE INDEX idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX idx_purchases_date ON purchases(date);

-- Purchase items
CREATE INDEX idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_inventory_item_id ON purchase_items(inventory_item_id);
