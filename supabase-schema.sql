-- ============================================
-- CAFE APP - SUPABASE DATABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Meja / Tables
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number INT NOT NULL UNIQUE,
  qr_token VARCHAR(64) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kategori Menu
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(50),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Items
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  base_price INT NOT NULL, -- in IDR, no decimals
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  stock INT DEFAULT -1, -- -1 = unlimited
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Varian / Modifiers (Ukuran, Gula, Es, dll)
CREATE TABLE modifier_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL, -- e.g. "Ukuran", "Level Gula", "Level Es"
  is_required BOOLEAN DEFAULT false,
  max_select INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE modifier_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g. "Large", "Less Sugar"
  price_add INT DEFAULT 0, -- additional price
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link menu items to modifier groups (many-to-many)
CREATE TABLE menu_item_modifiers (
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  modifier_group_id UUID REFERENCES modifier_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, modifier_group_id)
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES tables(id),
  order_number SERIAL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
  payment_method VARCHAR(30),
  payment_status VARCHAR(20) DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  midtrans_order_id VARCHAR(100),
  midtrans_transaction_id VARCHAR(100),
  subtotal INT DEFAULT 0,
  discount INT DEFAULT 0,
  total INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  menu_item_name VARCHAR(200) NOT NULL, -- snapshot
  quantity INT NOT NULL DEFAULT 1,
  unit_price INT NOT NULL, -- snapshot base price
  modifiers_json JSONB DEFAULT '[]', -- snapshot of selected modifiers [{name, price_add}]
  item_total INT NOT NULL, -- (unit_price + sum(modifier prices)) * quantity
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory / Bahan Baku (for AI stock check)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  unit VARCHAR(50) NOT NULL, -- kg, liter, pcs, etc
  current_stock DECIMAL(10,2) DEFAULT 0,
  min_stock DECIMAL(10,2) DEFAULT 0, -- alert threshold
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link menu items to inventory (recipe)
CREATE TABLE menu_item_ingredients (
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  quantity_needed DECIMAL(10,2) NOT NULL, -- per 1 serving
  PRIMARY KEY (menu_item_id, inventory_id)
);

-- Login Attempts (Rate Limiting)
CREATE TABLE login_attempts (
  ip VARCHAR(45) PRIMARY KEY,
  count INT DEFAULT 1,
  reset_at BIGINT NOT NULL
);

-- Admin users
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  role VARCHAR(20) DEFAULT 'kasir' CHECK (role IN ('admin', 'kasir', 'dapur')),
  pin VARCHAR(255) UNIQUE, -- bcrypt hashed pin
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(is_available);
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- SEED DATA
-- ============================================

-- Insert tables (1-15)
INSERT INTO tables (number) VALUES
  (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14),(15);

-- Insert categories
INSERT INTO categories (name, slug, icon, sort_order) VALUES
  ('Coffee', 'coffee', '☕', 1),
  ('Non-Coffee', 'non-coffee', '🧃', 2),
  ('Tea', 'tea', '🍵', 3),
  ('Food', 'food', '🍽️', 4),
  ('Snacks', 'snacks', '🍿', 5),
  ('Dessert', 'dessert', '🍰', 6);

-- Insert modifier groups
INSERT INTO modifier_groups (name, is_required, max_select) VALUES
  ('Ukuran', true, 1),
  ('Level Gula', true, 1),
  ('Level Es', true, 1),
  ('Extra', false, 3);

-- Insert modifier options
INSERT INTO modifier_options (group_id, name, price_add, sort_order)
SELECT mg.id, v.name, v.price_add, v.sort_order
FROM modifier_groups mg
CROSS JOIN LATERAL (
  VALUES
    ('Regular', 0, 1),
    ('Large', 5000, 2)
) AS v(name, price_add, sort_order)
WHERE mg.name = 'Ukuran';

INSERT INTO modifier_options (group_id, name, price_add, sort_order)
SELECT mg.id, v.name, v.price_add, v.sort_order
FROM modifier_groups mg
CROSS JOIN LATERAL (
  VALUES
    ('Normal', 0, 1),
    ('Less Sugar', 0, 2),
    ('No Sugar', 0, 3),
    ('Extra Sugar', 0, 4)
) AS v(name, price_add, sort_order)
WHERE mg.name = 'Level Gula';

INSERT INTO modifier_options (group_id, name, price_add, sort_order)
SELECT mg.id, v.name, v.price_add, v.sort_order
FROM modifier_groups mg
CROSS JOIN LATERAL (
  VALUES
    ('Normal Ice', 0, 1),
    ('Less Ice', 0, 2),
    ('No Ice', 0, 3),
    ('Hot', 0, 4)
) AS v(name, price_add, sort_order)
WHERE mg.name = 'Level Es';

INSERT INTO modifier_options (group_id, name, price_add, sort_order)
SELECT mg.id, v.name, v.price_add, v.sort_order
FROM modifier_groups mg
CROSS JOIN LATERAL (
  VALUES
    ('Extra Shot', 5000, 1),
    ('Oat Milk', 8000, 2),
    ('Whipped Cream', 5000, 3)
) AS v(name, price_add, sort_order)
WHERE mg.name = 'Extra';

-- Insert menu items
WITH cat AS (SELECT id, slug FROM categories)
INSERT INTO menu_items (category_id, name, slug, description, base_price, is_available) VALUES
  ((SELECT id FROM cat WHERE slug='coffee'), 'Americano', 'americano', 'Espresso + air, bold flavor', 22000, true),
  ((SELECT id FROM cat WHERE slug='coffee'), 'Cafe Latte', 'cafe-latte', 'Espresso + steamed milk', 28000, true),
  ((SELECT id FROM cat WHERE slug='coffee'), 'Cappuccino', 'cappuccino', 'Espresso + foamed milk', 28000, true),
  ((SELECT id FROM cat WHERE slug='coffee'), 'Caramel Macchiato', 'caramel-macchiato', 'Vanilla + milk + espresso + caramel drizzle', 35000, true),
  ((SELECT id FROM cat WHERE slug='coffee'), 'Mocha', 'mocha', 'Espresso + chocolate + milk', 32000, true),
  ((SELECT id FROM cat WHERE slug='coffee'), 'Espresso', 'espresso', 'Double shot espresso', 18000, true),
  ((SELECT id FROM cat WHERE slug='coffee'), 'Affogato', 'affogato', 'Espresso + vanilla ice cream', 35000, true),
  ((SELECT id FROM cat WHERE slug='non-coffee'), 'Matcha Latte', 'matcha-latte', 'Premium matcha + milk', 30000, true),
  ((SELECT id FROM cat WHERE slug='non-coffee'), 'Chocolate', 'chocolate', 'Rich hot/iced chocolate', 25000, true),
  ((SELECT id FROM cat WHERE slug='non-coffee'), 'Red Velvet Latte', 'red-velvet-latte', 'Red velvet + milk', 30000, true),
  ((SELECT id FROM cat WHERE slug='non-coffee'), 'Taro Latte', 'taro-latte', 'Creamy taro + milk', 28000, true),
  ((SELECT id FROM cat WHERE slug='tea'), 'Lemon Tea', 'lemon-tea', 'Black tea + fresh lemon', 18000, true),
  ((SELECT id FROM cat WHERE slug='tea'), 'Peach Tea', 'peach-tea', 'Black tea + peach syrup', 22000, true),
  ((SELECT id FROM cat WHERE slug='tea'), 'Green Tea', 'green-tea', 'Japanese green tea', 20000, true),
  ((SELECT id FROM cat WHERE slug='food'), 'Nasi Goreng', 'nasi-goreng', 'Fried rice with egg & chicken', 35000, true),
  ((SELECT id FROM cat WHERE slug='food'), 'Chicken Katsu', 'chicken-katsu', 'Crispy chicken cutlet + rice', 40000, true),
  ((SELECT id FROM cat WHERE slug='food'), 'Pasta Aglio Olio', 'pasta-aglio-olio', 'Spaghetti with garlic & chili', 38000, true),
  ((SELECT id FROM cat WHERE slug='food'), 'Club Sandwich', 'club-sandwich', 'Triple decker sandwich', 35000, true),
  ((SELECT id FROM cat WHERE slug='snacks'), 'French Fries', 'french-fries', 'Crispy fries with dipping sauce', 22000, true),
  ((SELECT id FROM cat WHERE slug='snacks'), 'Chicken Wings', 'chicken-wings', 'Spicy buffalo wings (6pcs)', 30000, true),
  ((SELECT id FROM cat WHERE slug='snacks'), 'Roti Bakar', 'roti-bakar', 'Toasted bread with various toppings', 18000, true),
  ((SELECT id FROM cat WHERE slug='dessert'), 'Cheesecake', 'cheesecake', 'New York style cheesecake', 35000, true),
  ((SELECT id FROM cat WHERE slug='dessert'), 'Brownies', 'brownies', 'Fudgy chocolate brownies', 25000, true),
  ((SELECT id FROM cat WHERE slug='dessert'), 'Banana Split', 'banana-split', 'Banana + ice cream + toppings', 30000, true);

-- Link coffee & non-coffee items to all modifier groups
INSERT INTO menu_item_modifiers (menu_item_id, modifier_group_id)
SELECT mi.id, mg.id
FROM menu_items mi
JOIN categories c ON mi.category_id = c.id
CROSS JOIN modifier_groups mg
WHERE c.slug IN ('coffee', 'non-coffee', 'tea')
  AND mg.name IN ('Ukuran', 'Level Gula', 'Level Es');

-- Link coffee items to Extra modifier group
INSERT INTO menu_item_modifiers (menu_item_id, modifier_group_id)
SELECT mi.id, mg.id
FROM menu_items mi
JOIN categories c ON mi.category_id = c.id
CROSS JOIN modifier_groups mg
WHERE c.slug = 'coffee'
  AND mg.name = 'Extra';

-- ============================================
-- RPC: CREATE ORDER TRANSACTION
-- ============================================
CREATE OR REPLACE FUNCTION create_order_transaction(
  p_table_id UUID,
  p_subtotal INT,
  p_total INT,
  p_notes TEXT,
  p_midtrans_order_id VARCHAR,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_order_record JSONB;
BEGIN
  -- 1. Create order
  INSERT INTO orders (
    table_id,
    status,
    payment_status,
    subtotal,
    total,
    notes,
    midtrans_order_id
  ) VALUES (
    p_table_id,
    'pending',
    'unpaid',
    p_subtotal,
    p_total,
    p_notes,
    p_midtrans_order_id
  )
  RETURNING id INTO v_order_id;

  -- 2. Process items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert order_item
    INSERT INTO order_items (
      order_id,
      menu_item_id,
      menu_item_name,
      quantity,
      unit_price,
      modifiers_json,
      item_total,
      notes
    ) VALUES (
      v_order_id,
      (v_item->>'menu_item_id')::UUID,
      v_item->>'menu_item_name',
      (v_item->>'quantity')::INT,
      (v_item->>'unit_price')::INT,
      v_item->'modifiers_json',
      (v_item->>'item_total')::INT,
      v_item->>'notes'
    );

    -- Deduct stock if limited (using the existing function logic)
    -- The existing function is deduct_stock_if_limited, let's call it or do it here
    PERFORM deduct_stock_if_limited(
      (v_item->>'menu_item_id')::UUID,
      (v_item->>'quantity')::INT
    );
  END LOOP;

  -- Return the created order details
  SELECT row_to_json(o)::JSONB INTO v_order_record
  FROM orders o
  WHERE o.id = v_order_id;

  RETURN v_order_record;
END;
$$;

-- ============================================
-- RPC: DEDUCT STOCK IF LIMITED
-- ============================================
CREATE OR REPLACE FUNCTION deduct_stock_if_limited(
  p_menu_item_id UUID,
  p_quantity INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE menu_items
  SET stock = stock - p_quantity
  WHERE id = p_menu_item_id
    AND stock != -1;
END;
$$;

-- AI Chat Rate Limiting
CREATE TABLE ai_chat_limits (
  ip VARCHAR(45) PRIMARY KEY,
  count INT DEFAULT 1,
  reset_at BIGINT NOT NULL
);

-- Insert default admin users for each role
-- PIN default: admin=111111, kasir=222222, dapur=333333 (hash bcrypt)
INSERT INTO admin_users (email, name, role, pin) VALUES
  ('admin@cafe.local', 'Admin Pusat', 'admin', '$2b$10$kS6W7M29KptpVoRolEDIEuV3AMG/UFNKBMMy15Zhk5el1p9e9atVO'),
  ('kasir@cafe.local', 'Kasir Depan', 'kasir', '$2b$10$lBVZP170U9cPwOVE/c7zkOQHWmaKGHF1xxtb0VMbUHApSZy48cT3u'),
  ('dapur@cafe.local', 'Chef Dapur', 'dapur', '$2b$10$vDBsFg5kwImJkiFz27dvS.RqxGmlZniNyFuBIyOu45XUEauh/RhTm');