import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80),
    icon: z.string().min(1).max(50).default('coffee'),
    sortOrder: z.number().int().default(0),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    name: z.string().min(2).max(80).optional(),
    icon: z.string().min(1).max(50).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});
