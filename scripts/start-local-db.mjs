import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.LOCAL_DB_PORT || 5433);
const USER = 'postgres';
const PASSWORD = 'postgres';
const DATABASE = 'drwprime_local';

const pg = new EmbeddedPostgres({
  databaseDir: process.env.LOCAL_DB_DIR || '.local-postgres/data',
  port: PORT,
  user: USER,
  password: PASSWORD,
  authMethod: 'password',
  persistent: true,
  onLog: (message) => console.log(`[PG] ${message}`),
  onError: (error) => console.error(`[PG] ${error}`),
});

async function main() {
  const dataDir = process.env.LOCAL_DB_DIR || '.local-postgres/data';
  const initialized = existsSync(join(dataDir, 'PG_VERSION'));
  try {
    if (!initialized) {
      await pg.initialise();
      console.log('[PG] cluster initialised');
    } else {
      console.log('[PG] cluster already initialised, skipping initdb');
    }
    await pg.start();
    console.log(`[PG] embedded postgres listening on 127.0.0.1:${PORT}`);
  } catch (error) {
    console.error('[PG] failed to start:', error);
    process.exit(1);
  }

  const client = pg.getPgClient('postgres');
  await client.connect();
  const result = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [DATABASE]);
  if (result.rowCount === 0) {
    await pg.createDatabase(DATABASE);
    console.log(`[PG] created database "${DATABASE}"`);
  } else {
    console.log(`[PG] database "${DATABASE}" already exists`);
  }
  await client.end();

  console.log(`[PG] ready. DATABASE_URL=postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`);

  const shutdown = async () => {
    console.log('\n[PG] stopping embedded postgres...');
    try { await pg.stop(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  setInterval(() => {}, 1000 * 60 * 60);
}

main();
