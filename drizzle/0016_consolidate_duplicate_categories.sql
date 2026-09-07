-- Exakt gleich benannte Kategorien eines Haushalts werden einmalig zusammengeführt.
-- Alle bestehenden Zuordnungen zeigen anschließend auf die älteste Kategorie.
CREATE TEMP TABLE category_duplicate_map ON COMMIT DROP AS
SELECT id AS duplicate_id, canonical_id
FROM (
  SELECT id, first_value(id) OVER (PARTITION BY household_id, lower(btrim(name)) ORDER BY created_at, id) AS canonical_id
  FROM categories
) ranked
WHERE id <> canonical_id;

UPDATE transactions t SET category_id=m.canonical_id, updated_at=now() FROM category_duplicate_map m WHERE t.category_id=m.duplicate_id;
UPDATE transaction_splits s SET category_id=m.canonical_id FROM category_duplicate_map m WHERE s.category_id=m.duplicate_id;
UPDATE amazon_order_items a SET category_id=m.canonical_id, updated_at=now() FROM category_duplicate_map m WHERE a.category_id=m.duplicate_id;
UPDATE categorization_rules r SET category_id=m.canonical_id, updated_at=now() FROM category_duplicate_map m WHERE r.category_id=m.duplicate_id;
UPDATE recurring_transactions r SET category_id=m.canonical_id, updated_at=now() FROM category_duplicate_map m WHERE r.category_id=m.duplicate_id;
UPDATE categories c SET parent_id=m.canonical_id, updated_at=now() FROM category_duplicate_map m WHERE c.parent_id=m.duplicate_id;
DELETE FROM categories c USING category_duplicate_map m WHERE c.id=m.duplicate_id;

-- Frühere KI-Sammelkategorien sind keine fachliche Zuordnung. Betroffene
-- Buchungen und Artikel werden wieder offen, damit sie sauber geprüft werden.
CREATE TEMP TABLE forbidden_category_ids ON COMMIT DROP AS
SELECT id FROM categories
WHERE lower(btrim(name)) ~ '(^|[ &/\-])(sonstiges?|einkauf|einkäufe|einkaeufe|shopping)([ &/\-]|$)';
CREATE TEMP TABLE forbidden_split_transactions ON COMMIT DROP AS
SELECT DISTINCT transaction_id FROM transaction_splits WHERE category_id IN (SELECT id FROM forbidden_category_ids);
DELETE FROM transaction_splits WHERE transaction_id IN (SELECT transaction_id FROM forbidden_split_transactions);
UPDATE transactions SET category_id=NULL, categorized_by=NULL, categorization_confidence=NULL, updated_at=now()
WHERE category_id IN (SELECT id FROM forbidden_category_ids) OR id IN (SELECT transaction_id FROM forbidden_split_transactions);
UPDATE amazon_order_items SET category_id=NULL, updated_at=now() WHERE category_id IN (SELECT id FROM forbidden_category_ids);
DELETE FROM categorization_rules WHERE category_id IN (SELECT id FROM forbidden_category_ids);
UPDATE recurring_transactions SET category_id=NULL, updated_at=now() WHERE category_id IN (SELECT id FROM forbidden_category_ids);
UPDATE categories SET parent_id=NULL, updated_at=now() WHERE parent_id IN (SELECT id FROM forbidden_category_ids);
DELETE FROM categories WHERE id IN (SELECT id FROM forbidden_category_ids);

CREATE UNIQUE INDEX IF NOT EXISTS categories_household_normalized_name_unique
ON categories (household_id, lower(btrim(name)));
