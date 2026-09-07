ALTER TABLE "amazon_order_items" ADD COLUMN "ai_suggested_category_id" uuid;--> statement-breakpoint
ALTER TABLE "amazon_order_items" ADD COLUMN "ai_suggested_category_name" text;--> statement-breakpoint
ALTER TABLE "amazon_order_items" ADD COLUMN "ai_suggestion_confidence" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "amazon_order_items" ADD COLUMN "ai_suggestion_reason" text;--> statement-breakpoint
ALTER TABLE "amazon_order_items" ADD COLUMN "ai_analyzed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "amazon_order_items" ADD CONSTRAINT "amazon_order_items_ai_suggested_category_id_categories_id_fk" FOREIGN KEY ("ai_suggested_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;