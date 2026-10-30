import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    categoryId: z.number().int().positive(),
    name: z.string().min(2).max(120),
    description: z.string().min(5),
    imageUrl: z.string().url(),
    basePrice: z.number().positive(),
    exclusiveBranchId: z.number().int().positive().nullable().optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    categoryId: z.number().int().positive().optional(),
    name: z.string().min(2).max(120).optional(),
    description: z.string().min(5).optional(),
    imageUrl: z.string().url().optional(),
    basePrice: z.number().positive().optional(),
    exclusiveBranchId: z.number().int().positive().nullable().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const queryProductsSchema = z.object({
  query: z.object({
    categoryId: z.coerce.number().int().positive().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});
