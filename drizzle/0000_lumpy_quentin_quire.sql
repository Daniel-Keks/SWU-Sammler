CREATE TABLE `collection_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`set_name` text NOT NULL,
	`card_number` text NOT NULL,
	`rarity` text DEFAULT 'Unbekannt' NOT NULL,
	`color` text DEFAULT '#d6ad43' NOT NULL,
	`regular` integer DEFAULT 0 NOT NULL,
	`foil` integer DEFAULT 0 NOT NULL,
	`hyperspace` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_collection_user_set_number` ON `collection_entries` (`user_id`,`set_name`,`card_number`);--> statement-breakpoint
CREATE INDEX `idx_collection_user_name` ON `collection_entries` (`user_id`,`name`);