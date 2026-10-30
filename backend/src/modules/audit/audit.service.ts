import { db } from '../../db/connection';

export class AuditService {
  /**
   * Registra una acción sensible o de superpermiso en el log de auditoría
   */
  public static async logAction(params: {
    userId?: number | null;
    branchId?: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    details?: any;
    ipAddress?: string | null;
  }) {
    const detailsStr =
      params.details !== undefined
        ? typeof params.details === 'string'
          ? params.details
          : JSON.stringify(params.details)
        : null;

    return db('audit_logs').insert({
      user_id: params.userId || null,
      branch_id: params.branchId || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      details: detailsStr,
      ip_address: params.ipAddress || null,
      created_at: db.fn.now(),
    });
  }

  /**
   * Consulta el historial de auditoría con filtros y paginación para el Administrador
   */
  public static async listLogs(query: {
    page?: number;
    limit?: number;
    branchId?: number;
    action?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    let qb = db('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .leftJoin('branches', 'audit_logs.branch_id', 'branches.id')
      .select(
        'audit_logs.*',
        'users.full_name as user_name',
        'users.email as user_email',
        'users.role as user_role',
        'branches.name as branch_name'
      );

    if (query.branchId) {
      qb = qb.where('audit_logs.branch_id', query.branchId);
    }

    if (query.action) {
      qb = qb.where('audit_logs.action', query.action);
    }

    const countRes = await qb.clone().clearSelect().count('audit_logs.id as count').first();
    const total = Number((countRes as any)?.count || 0);

    const logs = await qb.orderBy('audit_logs.id', 'desc').limit(limit).offset(offset);

    const formatted = logs.map((log) => {
      let parsedDetails = null;
      try {
        parsedDetails = log.details ? JSON.parse(log.details) : null;
      } catch {
        parsedDetails = log.details;
      }
      return {
        ...log,
        details: parsedDetails,
      };
    });

    return {
      data: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
