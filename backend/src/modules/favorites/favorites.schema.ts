import { z } from 'zod';

export const addFavoriteSchema = z.object({
  body: z.object({
    branchId: z.number().int().positive(),
  }),
});
