-- Entfernt wirkungslose Nullbuchungen und alte Sparkassen-Vormerkungen, die
-- vor der statusbasierten Importfilterung gespeichert wurden.
UPDATE "transactions"
SET "linked_transaction_id" = NULL,
    "transfer_peer_id" = NULL
WHERE "linked_transaction_id" IN (
  SELECT "id" FROM "transactions"
  WHERE "amount" = 0
     OR (
       "counterparty" IS NULL
       AND COALESCE("booking_type", '') ILIKE 'SONSTIGER EINZUG'
       AND COALESCE("purpose", '') ILIKE 'MO %'
     )
)
OR "transfer_peer_id" IN (
  SELECT "id" FROM "transactions"
  WHERE "amount" = 0
     OR (
       "counterparty" IS NULL
       AND COALESCE("booking_type", '') ILIKE 'SONSTIGER EINZUG'
       AND COALESCE("purpose", '') ILIKE 'MO %'
     )
);

DELETE FROM "transactions"
WHERE "amount" = 0
   OR (
     "counterparty" IS NULL
     AND COALESCE("booking_type", '') ILIKE 'SONSTIGER EINZUG'
     AND COALESCE("purpose", '') ILIKE 'MO %'
   );
