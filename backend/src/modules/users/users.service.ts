import bcrypt from 'bcryptjs';
import { db } from '../../db/connection';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors';
import { TokenPayload } from '../../utils/tokens';

export class UsersService {
  public static async listUsers(
    currentUser: TokenPayload,
    query: { page: number; limit: number; role?: string; search?: string; branchId?: number }
  ) {
    const { page, limit, role, search, branchId } = query;
    const offset = (page - 1) * limit;

    let baseQuery = db('users').leftJoin('customer_loyalty', 'users.id', 'customer_loyalty.customer_id').select(
      'users.id',
      'users.full_name',
      'users.email',
      'users.role',
      'users.branch_id',
      'users.phone',
      'users.is_active',
      'users.created_at',
      db.raw('COALESCE(customer_loyalty.points_balance, 0) as points_balance')
    );

    // Filtrado estricto por aislamiento de sucursal
    if (currentUser.role === 'MANAGER') {
      baseQuery = baseQuery
        .where('branch_id', currentUser.branchId)
        .whereIn('role', ['CASHIER', 'BARISTA']);
    } else if (currentUser.role !== 'ADMIN') {
      throw new ForbiddenError('No tenés permisos para listar usuarios');
    }

    if (role) {
      baseQuery = baseQuery.where('role', role);
    }

    if (branchId !== undefined) {
      baseQuery = baseQuery.where('branch_id', branchId);
    }

    if (search) {
      baseQuery = baseQuery.where((builder) => {
        builder.where('full_name', 'like', `%${search}%`)
               .orWhere('email', 'like', `%${search}%`);
      });
    }

    const countResult = await baseQuery.clone().clearSelect().clearOrder().countDistinct('users.id as count').first();
    const total = Number((countResult as any)?.count || 0);

    const data = await baseQuery.orderBy('users.id', 'desc').limit(limit).offset(offset);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getUserById(currentUser: TokenPayload, id: number) {
    const user = await db('users')
      .select('id', 'full_name', 'email', 'role', 'branch_id', 'phone', 'is_active', 'created_at')
      .where({ id })
      .first();

    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    if (currentUser.role === 'MANAGER') {
      if (user.branch_id !== currentUser.branchId || !['CASHIER', 'BARISTA'].includes(user.role)) {
        throw new ForbiddenError('No tenés permisos para visualizar este usuario');
      }
    } else if (currentUser.role !== 'ADMIN') {
      throw new ForbiddenError('No tenés permisos para consultar otros usuarios');
    }

    return user;
  }

  public static async createUser(
    currentUser: TokenPayload,
    payload: {
      fullName: string;
      email: string;
      password: string;
      role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'BARISTA' | 'CUSTOMER';
      branchId?: number;
      phone?: string;
    }
  ) {
    if (currentUser.role === 'MANAGER') {
      if (!['CASHIER', 'BARISTA'].includes(payload.role)) {
        throw new ForbiddenError('Como encargado solo podés dar de alta cajeros o baristas');
      }
      payload.branchId = currentUser.branchId!;
    } else if (currentUser.role !== 'ADMIN') {
      throw new ForbiddenError('No tenés permisos para crear usuarios');
    }

    if (['MANAGER', 'CASHIER', 'BARISTA'].includes(payload.role) && !payload.branchId) {
      throw new ValidationError('El personal de sucursal debe tener asignado un branchId válido');
    }

    if (['ADMIN', 'CUSTOMER'].includes(payload.role)) {
      payload.branchId = undefined;
    }

    const existing = await db('users').where({ email: payload.email }).first();
    if (existing) {
      throw new ConflictError('Ya existe un usuario con este correo electrónico');
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    const [id] = await db('users').insert({
      full_name: payload.fullName,
      email: payload.email,
      password_hash: passwordHash,
      role: payload.role,
      branch_id: payload.branchId || null,
      phone: payload.phone || null,
      is_active: true,
      created_at: db.fn.now(),
    });

    return db('users')
      .select('id', 'full_name', 'email', 'role', 'branch_id', 'phone', 'is_active', 'created_at')
      .where({ id })
      .first();
  }

  public static async updateUser(
    currentUser: TokenPayload,
    id: number,
    payload: { fullName?: string; phone?: string; isActive?: boolean; branchId?: number; role?: string }
  ) {
    const targetUser = await db('users').where({ id }).first();
    if (!targetUser) {
      throw new NotFoundError('Usuario no encontrado');
    }

    if (currentUser.role === 'MANAGER') {
      if (
        targetUser.branch_id !== currentUser.branchId ||
        !['CASHIER', 'BARISTA'].includes(targetUser.role)
      ) {
        throw new ForbiddenError('No tenés permisos para modificar usuarios de otra sucursal');
      }
      // Un encargado no puede reasignar el branch_id ni el rol
      delete payload.branchId;
      delete payload.role;
    } else if (currentUser.role !== 'ADMIN') {
      throw new ForbiddenError();
    }

    const updateData: any = {
      full_name: payload.fullName ?? targetUser.full_name,
      phone: payload.phone ?? targetUser.phone,
      is_active: payload.isActive ?? targetUser.is_active,
      branch_id: payload.branchId !== undefined ? payload.branchId : targetUser.branch_id,
    };

    if (currentUser.role === 'ADMIN' && payload.role) {
      updateData.role = payload.role;
      if (['ADMIN', 'CUSTOMER'].includes(payload.role)) {
        updateData.branch_id = null;
      }
    }

    await db('users').where({ id }).update(updateData);

    return db('users')
      .select('id', 'full_name', 'email', 'role', 'branch_id', 'phone', 'is_active', 'created_at')
      .where({ id })
      .first();
  }

  public static async deactivateUser(currentUser: TokenPayload, id: number) {
    const targetUser = await db('users').where({ id }).first();
    if (!targetUser) {
      throw new NotFoundError('Usuario no encontrado');
    }

    if (targetUser.id === currentUser.sub) {
      throw new ValidationError('No podés dar de baja tu propia cuenta');
    }

    if (currentUser.role === 'MANAGER') {
      if (
        targetUser.branch_id !== currentUser.branchId ||
        !['CASHIER', 'BARISTA'].includes(targetUser.role)
      ) {
        throw new ForbiddenError('No tenés permisos para dar de baja este usuario');
      }
    } else if (currentUser.role !== 'ADMIN') {
      throw new ForbiddenError();
    }

    // Intentar borrado físico si no tiene claves foráneas restrictivas; si falla, baja lógica
    try {
      await db('users').where({ id }).del();
    } catch {
      await db('users').where({ id }).update({ is_active: false });
    }
  }

  public static async updateMe(userId: number, payload: { fullName?: string; phone?: string }) {
    await db('users').where({ id: userId }).update({
      full_name: payload.fullName,
      phone: payload.phone,
    });

    return db('users')
      .select('id', 'full_name', 'email', 'role', 'branch_id', 'phone', 'is_active')
      .where({ id: userId })
      .first();
  }
}
