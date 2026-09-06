ALTER TABLE "categorization_rules" ADD COLUMN "account_id" uuid;--> statement-breakpoint
UPDATE "categorization_rules" AS r
SET "account_id" = (
  SELECT t."account_id"
  FROM "transactions" t
  JOIN "accounts" a ON a."id" = t."account_id"
  WHERE t."counterparty_normalized" = r."value"
    AND a."household_id" = r."household_id"
    AND (a."owner_member_id" = r."owner_member_id" OR a."kind" = 'joint')
  ORDER BY t."updated_at" DESC
  LIMIT 1
)
WHERE r."shared" = false;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
