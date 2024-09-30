const { ConvexHttpClient } = require("convex/browser");
const { Client } = require("pg");
require("dotenv").config();

const convexApiUrl = process.env.CONVEX_API_URL || 'https://expert-mosquito-358.convex.cloud';

// Initialize Convex client
const client = new ConvexHttpClient(process.env.CONVEX_API_URL);

// Initialize PostgreSQL client
const pgClient = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'file_tracking',
  password: 'yourpassword',
  port: 5432,
});

async function migrate() {
  // Connect to PostgreSQL
  await pgClient.connect();

  try {
    // Fetch data from PostgreSQL
    const res = await pgClient.query('SELECT * FROM file_versions');
    const fileVersions = res.rows;

    // Insert each record into Convex
    for (const fileVersion of fileVersions) {
      await client.insert('file_versions', {
        file_path: fileVersion.file_path,
        version: fileVersion.version,
        last_modified: fileVersion.last_modified,
        content: fileVersion.content,
        parent_folder: fileVersion.parent_folder,
      });
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    // Close PostgreSQL connection
    await pgClient.end();
  }
}

// Run the migration
migrate().catch(console.error);
