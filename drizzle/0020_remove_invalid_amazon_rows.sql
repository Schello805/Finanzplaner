DELETE FROM "amazon_order_items"
WHERE "quantity" <= 0
   OR "order_total" <= 0
   OR "status" ~* 'cancel|storniert';
