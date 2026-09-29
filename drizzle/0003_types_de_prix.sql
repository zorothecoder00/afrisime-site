ALTER TYPE "public"."order_status" ADD VALUE 'a-valider' BEFORE 'confirmee';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "price_type" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "price_type_label" text;