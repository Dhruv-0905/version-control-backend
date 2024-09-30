// schema.ts
import { defineSchema, defineTable, s } from 'convex/schema';


export const fileVersions = defineTable({
  id: s.id(),                       // Primary key for the table
  file_path: s.string(),             // Path of the file
  version: s.number(),               // Version number of the file
  last_modified: s.datetime(),       // Timestamp for when the file was last modified
  content: s.string(),               // File content (might be large; consider if this should be stored elsewhere)
  parent_folder: s.string(),         // Parent folder path or identifier
});

export default defineSchema({
  fileVersions,                      // Export the file_versions table
});
