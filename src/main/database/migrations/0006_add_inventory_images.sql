-- Add inventory_images table for product gallery support
CREATE TABLE inventory_images (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,                    -- inventory SKU or variant SKU
    is_variant BOOLEAN NOT NULL DEFAULT FALSE,   -- TRUE = variant, FALSE = inventory
    file_path VARCHAR(500) NOT NULL,             -- relative path from userData
    thumbnail_path VARCHAR(500),                 -- thumbnail relative path
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(50),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,   -- primary/cover image
    sort_order INTEGER NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- No FK constraint: SKU references inventory.sku OR variants.variant_sku
    -- Integrity enforced at application level
);

CREATE INDEX idx_inventory_images_sku ON inventory_images(sku);
CREATE INDEX idx_inventory_images_variant ON inventory_images(is_variant);
CREATE INDEX idx_inventory_images_primary ON inventory_images(sku, is_primary) WHERE is_primary = TRUE;
