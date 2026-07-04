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
      name: 'title',
      type: 'text',
      required: true,
      label: 'Judul',
    },
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
      name: 'excerpt',
      type: 'textarea',
      label: 'Ringkasan',
      admin: {
        description: 'Ringkasan singkat untuk daftar artikel, meta description, dan social cards.',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Gambar Cover',
      admin: {
        description: 'Gambar cover (juga digunakan untuk OpenGraph/social image).',
      },
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      label: 'Konten',
    },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
    },
    /*
    {
      name: 'relatedTreatmentSlugs',
      type: 'text',
      hasMany: true,
      label: 'Treatment Terkait',
      admin: {
        description: 'Slug treatment untuk cross-link (contoh: radiance-glow-peel).',
      },
    },
    */
    {
      type: 'collapsible',
      label: 'SEO',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'seoTitle',
          type: 'text',
          label: 'Judul SEO',
          admin: { description: 'Override <title>. Jika kosong, menggunakan judul artikel.' },
        },
        {
          name: 'seoDescription',
          type: 'textarea',
          label: 'Deskripsi SEO',
          admin: { description: 'Override meta description. Jika kosong, menggunakan ringkasan.' },
        },
      ],
    },
  ],
};
