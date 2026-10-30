import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    branchId: z.number().int().positive(),
    orderType: z.enum(['COUNTER', 'DINE_IN', 'TAKE_AWAY']).default('TAKE_AWAY'),
    notes: z.string().max(500).optional(),
    // Para pedidos de cajero en mostrador se puede enviar el medio de pago directo
    // Para clientes en app móvil: CASH o TRANSFER (Mercado Pago Alias / QR)
    paymentMethod: z.enum(['CASH', 'CARD', 'QR', 'TRANSFER']).optional(),
    pointsToRedeem: z.number().int().min(0).optional(),
    transferReference: z.string().min(4, 'El número de comprobante/operación debe tener al menos 4 caracteres').max(100).optional(),
    transferReceiptUrl: z.string().min(5, 'Debe adjuntar el comprobante').optional(),
    items: z.array(
      z.object({
        branchProductId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(100),
        notes: z.string().max(255).optional(),
        // Si el cliente envia precio, se ignora estrictamente
        unitPrice: z.any().optional(),
      })
    ).min(1, 'El pedido debe contener al menos un producto'),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    status: z.enum(['PREPARING', 'READY', 'DELIVERED', 'CANCELLED']),
    cancelReason: z.string().max(255).nullable().optional(),
  }),
});

export const payOrderSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    paymentMethod: z.enum(['CASH', 'CARD', 'QR', 'TRANSFER']),
  }),
});

export const queryOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED']).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
    branchId: z.coerce.number().int().positive().optional(),
  }),
});

export const overrideCancelOrderSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    managerPin: z.union([z.string(), z.number()]).transform((v) => String(v)).refine((v) => v.length >= 4 && v.length <= 8, {
      message: 'El PIN debe tener entre 4 y 8 dígitos',
    }),
    reason: z.string().min(3, 'Debe especificar un motivo de cancelación').max(255),
  }),
});

export const submitTransferProofSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    transferReference: z.string().min(4, 'El número de operación es requerido (mínimo 4 caracteres)').max(100),
    transferReceiptUrl: z.string().min(5, 'El comprobante de transferencia es requerido'),
  }),
});

export const verifyTransferProofSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    approved: z.boolean(),
    rejectionReason: z.string().max(255).optional(),
  }),
});

export const pendingTransfersSchema = z.object({
  body: z.object({
    branchId: z.number().int().positive().optional(),
  }).optional(),
});


