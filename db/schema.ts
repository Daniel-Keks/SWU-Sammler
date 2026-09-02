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
  showcase: integer('showcase').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('idx_collection_user_set_number').on(table.userId, table.setName, table.cardNumber),
  index('idx_collection_user_name').on(table.userId, table.name),
]);
