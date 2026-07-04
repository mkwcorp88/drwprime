import path from 'path';
import { fileURLToPath } from 'url';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { buildConfig } from 'payload';
import sharp from 'sharp';

import { Posts } from './collections/Posts';
import { Media } from './collections/Media';
import { Users } from './collections/Users';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    theme: 'light',
    meta: {
      titleSuffix: '- DRW Prime CMS',
      icons: [{ url: '/drwprime-icon.png' }],
    },
    // components: {
    //   graphics: {
    //     Logo: './components/cms/Logo#Logo',
    //     Icon: './components/cms/Icon#Icon',
    //   },
    // },
  },
  // The app already serves its own dashboard at /admin and a large /api surface,
  // so Payload is mounted on dedicated paths to avoid collisions.
  routes: {
    admin: '/cms',
    api: '/cms-api',
  },
  collections: [Posts, Media, Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  sharp,
  plugins: [
    // Media is stored in self-hosted MinIO (S3-compatible) on the VPS.
    // Payload keeps serving files through its own /cms-api/media/file route,
    // so stored DB urls stay relative and need no rewrite.
    s3Storage({
      enabled: true,
      collections: {
        [Media.slug]: true,
      },
      bucket: process.env.S3_BUCKET || 'drwprime',
      config: {
        endpoint: process.env.S3_ENDPOINT || 'https://cdn.drwskincare.com',
        region: process.env.S3_REGION || 'us-east-1',
        // MinIO requires path-style addressing (bucket in the path, not subdomain).
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
      },
    }),
  ],
});
