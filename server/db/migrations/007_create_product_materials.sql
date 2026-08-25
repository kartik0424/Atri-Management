-- 007: Create product_materials table (recipe/BOM for each product)
CREATE TABLE product_materials (
    product_id              INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    inventory_item_id       INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity_required_per_unit NUMERIC(12,4) NOT NULL CHECK (quantity_required_per_unit > 0),
    PRIMARY KEY (product_id, inventory_item_id)
);
