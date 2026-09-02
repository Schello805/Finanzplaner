CREATE TABLE "amazon_order_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"file_fingerprint" text NOT NULL,
	"original_filename" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amazon_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"order_id_encrypted" text NOT NULL,
	"order_id_fingerprint" text NOT NULL,
	"source_fingerprint" text NOT NULL,
	"order_date" date NOT NULL,
	"ship_date" date,
	"asin" text NOT NULL,
	"product_name_encrypted" text NOT NULL,
	"department" text,
	"status" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"unit_tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"order_total" numeric(14, 2) NOT NULL,
	"shipping_charge" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_discounts" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"category_id" uuid,
	"matched_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amazon_order_imports" ADD CONSTRAINT "amazon_order_imports_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amazon_order_imports" ADD CONSTRAINT "amazon_order_imports_owner_member_id_household_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amazon_order_imports" ADD CONSTRAINT "amazon_order_imports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amazon_order_items" ADD CONSTRAINT "amazon_order_items_import_id_amazon_order_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."amazon_order_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amazon_order_items" ADD CONSTRAINT "amazon_order_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amazon_order_items" ADD CONSTRAINT "amazon_order_items_owner_member_id_household_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amazon_order_items" ADD CONSTRAINT "amazon_order_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amazon_order_items" ADD CONSTRAINT "amazon_order_items_matched_transaction_id_transactions_id_fk" FOREIGN KEY ("matched_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amazon_import_household_file_unique" ON "amazon_order_imports" USING btree ("household_id","file_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "amazon_item_household_source_unique" ON "amazon_order_items" USING btree ("household_id","source_fingerprint");