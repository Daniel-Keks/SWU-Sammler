import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const collectionEntries = sqliteTable('collection_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  setName: text('set_name').notNull(),
  cardNumber: text('card_number').notNull(),
  rarity: text('rarity').notNull().default('Unbekannt'),
  color: text('color').notNull().default('#d6ad43'),
  regular: integer('regular').notNull().default(0),
  foil: integer('foil').notNull().default(0),
  hyperspace: integer('hyperspace').notNull().default(0),
  hyperfoil: integer('hyperfoil').notNull().default(0),
  showcase: integer('showcase').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('idx_collection_user_set_number').on(table.userId, table.setName, table.cardNumber),
  index('idx_collection_user_name').on(table.userId, table.name),
]);

export const savedDecks = sqliteTable('saved_decks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  source: text('source').notNull().default('SWU Sammler'),
  sourceUrl: text('source_url').notNull().default(''),
  cardsJson: text('cards_json').notNull(),
  publicSlug: text('public_slug').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_saved_decks_user').on(table.userId),
  uniqueIndex('idx_saved_decks_public_slug').on(table.publicSlug),
]);
