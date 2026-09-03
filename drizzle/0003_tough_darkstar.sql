CREATE TABLE `saved_decks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`source` text DEFAULT 'SWU Sammler' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`cards_json` text NOT NULL,
	`public_slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_saved_decks_user` ON `saved_decks` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_decks_public_slug` ON `saved_decks` (`public_slug`);