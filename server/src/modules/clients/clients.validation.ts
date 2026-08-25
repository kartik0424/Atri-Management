import { z } from 'zod';

export const clientTypeEnum = z.enum([
  'individual',
  'company',
  'school',
  'college',
  'government',
  'other',
]);

export const contactInputSchema = z.object({
  name: z.string().min(1, 'Contact name is required'),
  designation: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  is_primary: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  contact_person: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  gst_number: z.string().optional().nullable(),
  client_type: clientTypeEnum.default('individual'),
  notes: z.string().optional().nullable(),
  allow_duplicate: z.boolean().optional().default(false),
  contacts: z.array(contactInputSchema).optional().default([]),
});

export const updateClientSchema = createClientSchema.partial().omit({ allow_duplicate: true });

export const clientQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  client_type: clientTypeEnum.optional(),
});

export const clientSearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
});

export const clientIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid client ID'),
});

export const contactIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid client ID'),
  contactId: z.coerce.number().int().positive('Invalid contact ID'),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientQueryParams = z.infer<typeof clientQuerySchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;
