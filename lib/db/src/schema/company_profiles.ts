import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const companyProfilesTable = pgTable("company_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  companyName: text("company_name"),
  companyRole: text("company_role"),
  logoUrl: text("logo_url"),
  website: text("website"),
  phone: text("phone"),
  city: text("city"),
  country: text("country"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdUnique: uniqueIndex("company_profiles_user_id_unique").on(t.userId),
}));

export type CompanyProfile = typeof companyProfilesTable.$inferSelect;
