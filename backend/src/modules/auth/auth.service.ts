import bcrypt from 'bcryptjs';
import { db } from '../../db/connection';
import { env } from '../../config/env';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/errors';
import {
  generateAccessToken,
  generateFamilyId,
  generateOpaqueToken,
  hashOpaqueToken,
  TokenPayload,
} from '../../utils/tokens';
import { SocialVerifier, VerifiedSocialProfile } from './socialVerifier';

export interface AuthResponse {
  user: {
    id: number;
    fullName: string;
    email: string | null;
    role: string;
    branchId: number | null;
    phone: string | null;
    assignedRoles?: string[];
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  /**
   * Registro público de cliente
   */
  public static async register(data: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<AuthResponse> {
    const existing = await db('users').where({ email: data.email }).first();
    if (existing) {
      throw new ConflictError('Ya existe una cuenta registrada con este correo electrónico');
    }

    // Hash de contraseña con costo 12
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Invariable: Todo registro público crea estrictamente CUSTOMER
    const [userId] = await db('users').insert({
      full_name: data.fullName,
      email: data.email,
      password_hash: passwordHash,
      role: 'CUSTOMER',
      branch_id: null,
      phone: data.phone || null,
      is_active: true,
    });

    const user = await db('users').where({ id: userId }).first();
    return this.createAuthTokens(user);
  }

  /**
   * Inicio de sesión con email y contraseña
   */
  public static async login(email: string, password: string): Promise<AuthResponse> {
    const user = await db('users').where({ email }).first();
    if (!user || !user.is_active || !user.password_hash) {
      throw new UnauthorizedError('Credenciales inválidas o cuenta desactivada');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Credenciales inválidas o cuenta desactivada');
    }

    return this.createAuthTokens(user);
  }

  /**
   * Renovación de token de acceso con rotación y detección de reutilización
   */
  public static async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = hashOpaqueToken(token);
    const result = await db.transaction(async (trx) => {
      const tokenRecord = await trx('refresh_tokens')
        .where({ token_hash: tokenHash })
        .forUpdate()
        .first();

      if (!tokenRecord) return { error: 'invalid' as const };

      if (tokenRecord.used_at !== null) {
        await trx('refresh_tokens')
          .where({ family_id: tokenRecord.family_id })
          .update({ revoked_at: trx.fn.now() });
        return { error: 'reuse' as const };
      }

      if (tokenRecord.revoked_at !== null) return { error: 'revoked' as const };
      if (new Date(tokenRecord.expires_at) < new Date()) return { error: 'expired' as const };

      const user = await trx('users').where({ id: tokenRecord.user_id }).first();
      if (!user || !user.is_active) return { error: 'inactive' as const };

      const newRefreshToken = generateOpaqueToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

      await trx('refresh_tokens').where({ id: tokenRecord.id }).update({ used_at: trx.fn.now() });
      await trx('refresh_tokens').insert({
        user_id: user.id,
        family_id: tokenRecord.family_id,
        token_hash: hashOpaqueToken(newRefreshToken),
        expires_at: expiresAt,
        created_at: trx.fn.now(),
      });

      const assignments = await trx('staff_branch_assignments')
        .where({ user_id: user.id, is_active: true });
      const assignedRolesSet = new Set<string>();
      for (const a of assignments) {
        try {
          const parsed = typeof a.roles === 'string' ? JSON.parse(a.roles) : a.roles;
          if (Array.isArray(parsed)) parsed.forEach((r) => assignedRolesSet.add(r));
        } catch {}
      }
      const assignedRoles = Array.from(assignedRolesSet) as any;

      return {
        accessToken: generateAccessToken({
          sub: user.id,
          role: user.role,
          branchId: user.branch_id,
          assignedRoles,
        }),
        refreshToken: newRefreshToken,
      };
    });

    if ('error' in result) {
      if (result.error === 'reuse') {
        throw new UnauthorizedError(
          'Se detectó un intento de reutilización de token. La sesión fue cerrada por seguridad.'
        );
      }
      switch (result.error) {
        case 'invalid': throw new UnauthorizedError('Token de renovación inválido');
        case 'revoked': throw new UnauthorizedError('Esta sesión fue revocada.');
        case 'expired': throw new UnauthorizedError('La sesión ha expirado. Por favor iniciá sesión nuevamente.');
        case 'inactive': throw new UnauthorizedError('Usuario no encontrado o inactivo');
      }
      throw new UnauthorizedError('Token de renovación inválido');
    }

    return result;
  }

  /**
   * Cierre de sesión (revocación de token)
   */
  public static async logout(token: string): Promise<void> {
    const tokenHash = hashOpaqueToken(token);
    await db('refresh_tokens')
      .where({ token_hash: tokenHash })
      .update({ revoked_at: db.fn.now() });
  }

  /**
   * Login o vinculación mediante redes sociales (Google, Facebook, GitHub, Discord)
   */
  public static async socialLogin(data: {
    provider: 'GOOGLE' | 'FACEBOOK' | 'GITHUB' | 'DISCORD';
    idToken?: string;
    accessToken?: string;
    code?: string;
    redirectUri?: string;
  }): Promise<AuthResponse> {
    let profile: VerifiedSocialProfile;

    if (data.provider === 'GOOGLE' && data.idToken) {
      profile = await SocialVerifier.verifyGoogle(data.idToken);
    } else if (data.provider === 'FACEBOOK' && data.accessToken) {
      profile = await SocialVerifier.verifyFacebook(data.accessToken);
    } else if (data.provider === 'GITHUB' && data.code) {
      profile = await SocialVerifier.verifyGitHub(data.code, data.redirectUri);
    } else if (data.provider === 'DISCORD' && (data.code || data.accessToken)) {
      profile = await SocialVerifier.verifyDiscord(
        data.code || data.accessToken!,
        data.redirectUri,
        !data.code
      );
    } else {
      throw new UnauthorizedError('Datos insuficientes para autenticación social');
    }

    // 1. Verificar si la cuenta social ya está vinculada a un usuario
    const existingSocial = await db('social_accounts')
      .where({
        provider: profile.provider,
        provider_user_id: profile.providerUserId,
      })
      .first();

    let user: any;

    if (existingSocial) {
      user = await db('users').where({ id: existingSocial.user_id }).first();
      if (!user || !user.is_active) {
        throw new UnauthorizedError('Usuario no encontrado o inactivo');
      }
    } else {
      // 2. Si no está vinculada, verificar si existe un usuario con el email verificado
      if (profile.email && profile.emailVerified) {
        const userByEmail = await db('users').where({ email: profile.email }).first();

        if (userByEmail) {
          // REGLA DE SEGURIDAD INNEGOCIABLE:
          // Solo se vincula automáticamente si el rol es CUSTOMER.
          // Nunca se vincula a cuentas de personal (ADMIN, MANAGER, CASHIER, BARISTA).
          if (userByEmail.role !== 'CUSTOMER') {
            throw new ForbiddenError(
              'Por motivos de seguridad, las cuentas del personal no pueden vincularse mediante redes sociales. Iniciá sesión con email y contraseña.'
            );
          }

          // Vincular cuenta social a este cliente
          await db('social_accounts').insert({
            user_id: userByEmail.id,
            provider: profile.provider,
            provider_user_id: profile.providerUserId,
            created_at: db.fn.now(),
          });

          user = userByEmail;
        }
      }

      // 3. Si sigue sin existir, crear un nuevo usuario con rol CUSTOMER
      if (!user) {
        const [newUserId] = await db('users').insert({
          full_name: profile.fullName,
          email: profile.email,
          password_hash: null, // Cuenta autenticada externamente
          role: 'CUSTOMER',
          branch_id: null,
          is_active: true,
          created_at: db.fn.now(),
        });

        await db('social_accounts').insert({
          user_id: newUserId,
          provider: profile.provider,
          provider_user_id: profile.providerUserId,
          created_at: db.fn.now(),
        });

        user = await db('users').where({ id: newUserId }).first();
      }
    }

    return this.createAuthTokens(user);
  }

  /**
   * Obtiene la información del usuario autenticado
   */
  public static async getMe(userId: number) {
    const user = await db('users').where({ id: userId }).first();
    if (!user || !user.is_active) {
      throw new NotFoundError('Usuario no encontrado');
    }

    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      branchId: user.branch_id,
      phone: user.phone,
    };
  }

  /**
   * Helper para generar par de tokens y persistir refresh token
   */
  private static async createAuthTokens(user: any): Promise<AuthResponse> {
    const assignments = await db('staff_branch_assignments')
      .where({ user_id: user.id, is_active: true });
    const assignedRolesSet = new Set<string>();
    for (const a of assignments) {
      try {
        const parsed = typeof a.roles === 'string' ? JSON.parse(a.roles) : a.roles;
        if (Array.isArray(parsed)) parsed.forEach((r) => assignedRolesSet.add(r));
      } catch {}
    }
    const assignedRoles = Array.from(assignedRolesSet) as any;

    const payload: TokenPayload = {
      sub: user.id,
      role: user.role,
      branchId: user.branch_id,
      assignedRoles,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateOpaqueToken();
    const familyId = generateFamilyId();
    const tokenHash = hashOpaqueToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

    await db('refresh_tokens').insert({
      user_id: user.id,
      family_id: familyId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: db.fn.now(),
    });

    return {
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        branchId: user.branch_id,
        phone: user.phone,
        assignedRoles,
      },
      accessToken,
      refreshToken,
    };
  }
}
