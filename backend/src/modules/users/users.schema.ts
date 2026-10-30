import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'BARISTA', 'CUSTOMER']),
    branchId: z.number().int().positive().optional(),
    phone: z.string().max(30).optional(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    fullName: z.string().min(2).max(120).optional(),
    phone: z.string().max(30).nullable().optional(),
    isActive: z.boolean().optional(),
    branchId: z.number().int().positive().nullable().optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'BARISTA', 'CUSTOMER']).optional(),
  }),
});

export const updateMeSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(120).optional(),
    phone: z.string().max(30).optional(),
  }),
});

export const queryUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'BARISTA', 'CUSTOMER']).optional(),
    search: z.string().optional(),
    branchId: z.coerce.number().int().positive().optional(),
  }),
});
