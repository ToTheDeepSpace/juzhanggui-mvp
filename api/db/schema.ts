import { integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const jzgStores = pgTable('jzg_stores', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  city: text('city'),
  address: text('address'),
  contact: text('contact'),
  status: text('status'),
  created_at: timestamp('created_at', { withTimezone: true }),
  updated_at: timestamp('updated_at', { withTimezone: true }),
  default_deposit_amount: integer('default_deposit_amount').notNull(),
});

export const rooms = pgTable('rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenant_id: uuid('tenant_id'),
  name: text('name'),
  capacity: integer('capacity'),
  hourly_cost: numeric('hourly_cost'),
  status: text('status'),
  created_at: timestamp('created_at', { withTimezone: true }),
});
