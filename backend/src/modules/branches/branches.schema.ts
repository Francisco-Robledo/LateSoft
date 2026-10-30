import { z } from 'zod';

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'El slug solo puede contener letras minusculas, numeros y guiones'),
    address: z.string().min(5).max(255),
    latitude: z.number().min(-90).max(90).default(-34.6037),
    longitude: z.number().min(-180).max(180).default(-58.3816),
    phone: z.string().min(5).max(30),
    openingHours: z.record(z.any()),
    taxRate: z.number().min(0).max(100).default(21.00),
  }),
});

export const updateBranchSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    address: z.string().min(5).max(255).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    phone: z.string().min(5).max(30).optional(),
    openingHours: z.record(z.any()).optional(),
    isOpen: z.boolean().optional(),
    isActive: z.boolean().optional(),
    taxRate: z.number().min(0).max(100).optional(),
  }),
});

export const addBranchProductSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    productId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    price: z.number().positive(),
    isAvailable: z.boolean().default(true),
  }),
});

export const updateBranchProductSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    productId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    price: z.number().positive().optional(),
    isAvailable: z.boolean().optional(),
  }),
});

export const toggleProductAvailabilitySchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    productId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    isAvailable: z.boolean(),
    pausedReason: z.string().max(200).nullable().optional(),
  }),
});
