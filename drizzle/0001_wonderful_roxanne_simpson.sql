ALTER TABLE "transactions" ADD COLUMN "original_data_encrypted" text NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "original_data";