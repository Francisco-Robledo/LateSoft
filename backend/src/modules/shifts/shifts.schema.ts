import { z } from 'zod';

export const openShiftSchema = z.object({
  body: z.object({
    branchId: z.number().int().positive(),
    initialCash: z.number().min(0, 'El fondo inicial no puede ser negativo'),
    notes: z.string().max(500).optional(),
  }),
});

export const closeShiftSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    finalCashCounted: z.number().min(0, 'El efectivo contado no puede ser negativo'),
    notes: z.string().max(500).optional(),
  }),
});
