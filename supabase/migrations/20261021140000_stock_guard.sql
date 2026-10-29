-- ============================================
-- STOCK GUARD — stok tidak boleh tembus di bawah 0
-- ============================================
-- stock = -1 artinya "tidak terbatas". Fungsi lama memotong stok tanpa cek,
-- jadi dua order bersamaan untuk stok 1 bisa membuat stock = -1 dan menu
-- berubah jadi unlimited. Sekarang potongan hanya jalan kalau stok cukup;
-- kalau tidak, seluruh transaksi order dibatalkan (RAISE).
-- Menu yang stoknya 0 tetap ada dan tampil "Sold out", tidak dihapus.

-- Rapikan data yang sudah terlanjur di bawah -1
UPDATE menu_items SET stock = 0 WHERE stock < -1;

ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_stock_check;
ALTER TABLE menu_items ADD CONSTRAINT menu_items_stock_check CHECK (stock >= -1);

CREATE OR REPLACE FUNCTION deduct_stock_if_limited(
  p_menu_item_id UUID,
  p_quantity INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_name TEXT;
  v_stock INT;
BEGIN
  -- Kunci baris supaya order bersamaan antre, bukan sama-sama lolos
  SELECT name, stock INTO v_name, v_stock
    FROM menu_items
    WHERE id = p_menu_item_id
    FOR UPDATE;

  IF NOT FOUND OR v_stock = -1 THEN
    RETURN;
  END IF;

  IF v_stock < p_quantity THEN
    RAISE EXCEPTION 'ORDER_ITEM_NO_STOCK:%', v_name;
  END IF;

  UPDATE menu_items
  SET stock = stock - p_quantity
  WHERE id = p_menu_item_id;
END;
$$;
