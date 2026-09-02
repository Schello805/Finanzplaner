CREATE TYPE "public"."transaction_special_type" AS ENUM('normal', 'refund', 'transfer');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "special_type" "transaction_special_type" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "linked_transaction_id" uuid;