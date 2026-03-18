import { pgTable, serial, text, timestamp, customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const files = pgTable('files', {
  id: serial('id').primaryKey(),
  path: text('path').notNull().unique(),
  mimetype: text('mimetype').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});
