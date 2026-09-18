import { z } from 'zod';

export const CURRENT_SITE_MAX_PAGES = 12;

export const currentSiteLinkSchema = z.object({
  url: z.string().max(2000),
  label: z.string().max(240).default(''),
  kind: z.enum([
    'internal',
    'external',
    'document',
    'email',
    'phone',
    'whatsapp',
    'social',
  ]),
  pageUrl: z.url(),
});

export const currentSiteImageCandidateSchema = z.object({
  url: z.url(),
  pageUrl: z.url(),
  alt: z.string().max(300).default(''),
  context: z.string().max(400).default(''),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  role: z.enum(['photo', 'logo', 'unknown']).default('unknown'),
});

export const currentSitePageSchema = z.object({
  url: z.url(),
  title: z.string().max(240).default(''),
  description: z.string().max(500).default(''),
  canonical: z.url().optional(),
  headings: z.array(z.string().max(240)).max(40).default([]),
  text: z.string().max(8000).default(''),
  links: z.array(currentSiteLinkSchema).max(160).default([]),
  images: z.array(currentSiteImageCandidateSchema).max(100).default([]),
  emails: z.array(z.string().max(320)).max(20).default([]),
  phones: z.array(z.string().max(80)).max(20).default([]),
  addresses: z.array(z.string().max(500)).max(12).default([]),
  structuredData: z
    .array(
      z.object({
        type: z.string().max(120).default(''),
        name: z.string().max(240).default(''),
        description: z.string().max(600).default(''),
        telephone: z.string().max(80).default(''),
        email: z.string().max(320).default(''),
        address: z.string().max(500).default(''),
        url: z.string().max(2000).default(''),
      }),
    )
    .max(20)
    .default([]),
  rendered: z.boolean().default(false),
});

export type CurrentSiteLink = z.infer<typeof currentSiteLinkSchema>;
export type CurrentSiteImageCandidate = z.infer<
  typeof currentSiteImageCandidateSchema
>;
export type CurrentSitePage = z.infer<typeof currentSitePageSchema>;
