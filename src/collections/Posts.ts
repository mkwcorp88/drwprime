import type { CollectionConfig } from 'payload';
import { revalidatePath } from 'next/cache';

// Inlined (kept identical to slugifyTitle in src/lib/blog.ts) so the Payload
// config graph has no path-alias imports the CLI's tsx loader can't resolve.
function slugifyTitle(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

/**
 * Blog posts — the marketing team's publishing surface.
 * Rendered first-party by Next.js at /blog and /blog/[slug].
 * Drafts + scheduled publishing are enabled via `versions`.
 */
export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: {
    singular: 'Artikel',
    plural: 'Artikel',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'publishedAt'],
    group: 'Blog',
    description: 'Kelola artikel blog untuk edukasi treatment dan tips skincare.',
  },
  access: {
    // Anonymous visitors only ever see published posts; logged-in CMS users see everything.
    read: ({ req: { user } }) => {
      if (user) return true;
      return {
        _status: { equals: 'published' },
      };
    },
  },
  hooks: {
    // On-demand ISR: refresh the public blog when a post changes in the CMS.
    afterChange: [
      ({ doc }) => {
        try {
          revalidatePath('/blog');
          if (doc?.slug) revalidatePath(`/blog/${doc.slug}`);
          revalidatePath('/sitemap.xml');
        } catch {
          /* Not in a request/render context (e.g. migration script) — safe to ignore. */
        }
      },
    ],
    afterDelete: [
      ({ doc }) => {
        try {
          revalidatePath('/blog');
          if (doc?.slug) revalidatePath(`/blog/${doc.slug}`);
          revalidatePath('/sitemap.xml');
        } catch {
          /* no-op */
        }
      },
    ],
  },
  versions: {
    maxPerDoc: 25,
    drafts: {
      autosave: { interval: 375 },
      schedulePublish: true,
    },
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'URL path di /blog/. Otomatis dari judul jika dikosongkan.',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            const base = (typeof value === 'string' && value.trim()) || data?.title || '';
            return slugifyTitle(String(base));
          },
        ],
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Tanggal Publish',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Tanggal artikel ditampilkan. Set di masa depan + schedule publish untuk rilis terjadwal.',
      },
    },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
      admin: {
        position: 'sidebar',
        description: 'Tekan Enter setelah mengetik tag.',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Tulis Artikel',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              label: 'Judul Artikel',
              admin: {
                style: { fontSize: '1.5rem', fontWeight: 'bold' },
                placeholder: 'Masukkan judul artikel yang menarik...',
              },
            },
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Gambar Cover Utama',
              admin: {
                description: 'Gambar hero yang muncul di bagian paling atas artikel dan thumbnail.',
              },
            },
            {
              name: 'content',
              type: 'richText',
              required: true,
              label: 'Isi Konten Artikel',
            },
          ],
        },
        {
          label: 'Ringkasan & SEO',
          fields: [
            {
              name: 'excerpt',
              type: 'textarea',
              label: 'Ringkasan Pendek (Excerpt)',
              admin: {
                description: 'Muncul di daftar artikel blog dan preview sosial media.',
                rows: 3,
              },
            },
            {
              type: 'collapsible',
              label: 'Advanced SEO (Opsional)',
              admin: { initCollapsed: false },
              fields: [
                {
                  name: 'seoTitle',
                  type: 'text',
                  label: 'Custom SEO Title',
                  admin: { description: 'Override <title> browser. Jika kosong, otomatis menggunakan Judul Artikel.' },
                },
                {
                  name: 'seoDescription',
                  type: 'textarea',
                  label: 'Custom Meta Description',
                  admin: { description: 'Override tag <meta name="description">. Jika kosong, otomatis menggunakan Ringkasan Pendek.' },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
