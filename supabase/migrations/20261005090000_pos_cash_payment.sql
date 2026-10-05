-- ============================================
-- POS KASIR — Pesanan walk-in + pembayaran tunai
-- ============================================
-- Menambah dua RPC atomik:
--   pos_create_order(p_menu_items JSONB, p_notes TEXT)
--     -> membuat order (table_id NULL = walk-in), menghitung harga dari
--        menu_items di server, memotong stok, menolak item unavailable/kosong.
--   pos_pay_cash(p_order_id UUID, p_cash_received INT)
--     -> kunci order (FOR UPDATE), ubah ke paid/cash, hitung kembalian.
-- Semua penolakan memakai RAISE EXCEPTION dengan prefix kode yang stabil
-- supaya route handler bisa memetakan ke HTTP status yang tepat.
-- ============================================

CREATE OR REPLACE FUNCTION pos_create_order(
  p_menu_items JSONB,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_menu RECORD;
  v_qty INT;
  v_unit_price INT;
  v_subtotal INT := 0;
  v_lines JSONB := '[]'::JSONB;
  v_order_record JSONB;
BEGIN
  IF p_menu_items IS NULL OR jsonb_typeof(p_menu_items) <> 'array' OR jsonb_array_length(p_menu_items) = 0 THEN
    RAISE EXCEPTION 'ORDER_EMPTY';
  END IF;

  -- Pass 1: validasi + kunci harga dari DB (client tidak pernah dipercaya)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_menu_items)
  LOOP
    v_qty := (v_item->>'quantity')::INT;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN
      RAISE EXCEPTION 'ORDER_BAD_QUANTITY';
    END IF;

    SELECT id, name, base_price, is_available, stock
      INTO v_menu
      FROM menu_items
      WHERE id = (v_item->>'menu_item_id')::UUID
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ORDER_ITEM_NOT_FOUND';
    END IF;
    IF NOT v_menu.is_available THEN
      RAISE EXCEPTION 'ORDER_ITEM_UNAVAILABLE:%', v_menu.name;
    END IF;
    IF v_menu.stock <> -1 AND v_menu.stock < v_qty THEN
      RAISE EXCEPTION 'ORDER_ITEM_NO_STOCK:%', v_menu.name;
    END IF;

    v_unit_price := v_menu.base_price;
    v_subtotal := v_subtotal + (v_unit_price * v_qty);

    v_lines := v_lines || jsonb_build_object(
      'menu_item_id', v_menu.id,
      'menu_item_name', v_menu.name,
      'quantity', v_qty,
      'unit_price', v_unit_price,
      'item_total', v_unit_price * v_qty
    );
  END LOOP;

  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION 'ORDER_EMPTY';
  END IF;

  INSERT INTO orders (table_id, status, payment_status, subtotal, total, notes)
  VALUES (NULL, 'pending', 'unpaid', v_subtotal, v_subtotal, p_notes)
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (
    order_id, menu_item_id, menu_item_name, quantity,
    unit_price, modifiers_json, item_total, notes
  )
  SELECT v_order_id,
         (l->>'menu_item_id')::UUID,
         l->>'menu_item_name',
         (l->>'quantity')::INT,
         (l->>'unit_price')::INT,
         '[]'::JSONB,
         (l->>'item_total')::INT,
         NULL
  FROM jsonb_array_elements(v_lines) AS l;

  -- Pass 2: potong stok (hanya yang stock != -1)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_lines)
  LOOP
    PERFORM deduct_stock_if_limited(
      (v_item->>'menu_item_id')::UUID,
      (v_item->>'quantity')::INT
    );
  END LOOP;

  SELECT to_jsonb(o) INTO v_order_record FROM orders o WHERE o.id = v_order_id;
  RETURN v_order_record;
END;
$$;

CREATE OR REPLACE FUNCTION pos_pay_cash(
  p_order_id UUID,
  p_cash_received INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_change INT;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_order.status <> 'pending' OR v_order.payment_status <> 'unpaid' THEN
    RAISE EXCEPTION 'ORDER_ALREADY_SETTLED:%', v_order.status;
  END IF;

  IF p_cash_received IS NULL OR p_cash_received < v_order.total THEN
    RAISE EXCEPTION 'ORDER_INSUFFICIENT_CASH:%', v_order.total;
  END IF;

  v_change := p_cash_received - v_order.total;

  UPDATE orders
     SET status = 'paid',
         payment_status = 'paid',
         payment_method = 'cash',
         updated_at = NOW()
   WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id),
    'cash_received', p_cash_received,
    'change', v_change
  );
END;
$$;

-- Akses hanya lewat service_role (route API). Anon tidak perlu akses langsung.
REVOKE ALL ON FUNCTION pos_create_order(JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION pos_pay_cash(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pos_create_order(JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION pos_pay_cash(UUID, INT) TO service_role;
