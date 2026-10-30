import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../utils/errors';

export interface VerifiedSocialProfile {
  provider: 'GOOGLE' | 'FACEBOOK' | 'GITHUB' | 'DISCORD';
  providerUserId: string;
  email: string | null;
  fullName: string;
  emailVerified: boolean;
}

export class SocialVerifier {
  private static googleClient = new OAuth2Client();

  /**
   * Verifica ID Token de Google (Web o Android)
   */
  public static async verifyGoogle(idToken: string): Promise<VerifiedSocialProfile> {
    try {
      const audiences = env.GOOGLE_CLIENT_IDS.split(',').map((s) => s.trim()).filter(Boolean);
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: audiences.length > 0 ? audiences : undefined,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub) {
        throw new UnauthorizedError('Token de Google inválido');
      }

      return {
        provider: 'GOOGLE',
        providerUserId: payload.sub,
        email: payload.email || null,
        fullName: payload.name || payload.email?.split('@')[0] || 'Usuario Google',
        emailVerified: !!payload.email_verified,
      };
    } catch (err) {
      console.error('[Google Verification Error]', err);
      throw new UnauthorizedError('Error al verificar las credenciales con Google');
    }
  }

  /**
   * Verifica Access Token de Facebook con Graph API y consulta de perfil
   */
  public static async verifyFacebook(accessToken: string): Promise<VerifiedSocialProfile> {
    try {
      const appToken = `${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`;
      
      // 1. Validar validez del token si las credenciales de app estan configuradas
      if (env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) {
        const debugRes = await axios.get('https://graph.facebook.com/debug_token', {
          params: {
            input_token: accessToken,
            access_token: appToken,
          },
        });

        if (!debugRes.data?.data?.is_valid) {
          throw new UnauthorizedError('Token de Facebook inválido o vencido');
        }
      }

      // 2. Obtener datos del perfil
      const profileRes = await axios.get('https://graph.facebook.com/me', {
        params: {
          fields: 'id,name,email',
          access_token: accessToken,
        },
      });

      const data = profileRes.data;
      if (!data?.id) {
        throw new UnauthorizedError('No se pudo obtener la identidad de Facebook');
      }

      return {
        provider: 'FACEBOOK',
        providerUserId: String(data.id),
        email: data.email || null,
        fullName: data.name || 'Usuario Facebook',
        emailVerified: !!data.email,
      };
    } catch (err) {
      console.error('[Facebook Verification Error]', err);
      throw new UnauthorizedError('Error al verificar las credenciales con Facebook');
    }
  }

  /**
   * Intercambia el código de GitHub con OAuth y consulta /user y /user/emails
   */
  public static async verifyGitHub(code: string, redirectUri?: string): Promise<VerifiedSocialProfile> {
    try {
      // 1. Intercambiar code por access_token
      const tokenRes = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        },
        {
          headers: { Accept: 'application/json' },
        }
      );

      const githubAccessToken = tokenRes.data?.access_token;
      if (!githubAccessToken) {
        throw new UnauthorizedError('No se pudo obtener el token de acceso de GitHub');
      }

      // 2. Obtener perfil
      const userRes = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          'User-Agent': 'LateSoft-App',
        },
      });

      // 3. Obtener emails para encontrar el primario verificado
      let primaryEmail: string | null = userRes.data.email || null;
      let isVerified = false;

      try {
        const emailsRes = await axios.get('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${githubAccessToken}`,
            'User-Agent': 'LateSoft-App',
          },
        });

        if (Array.isArray(emailsRes.data)) {
          const verifiedEmail = emailsRes.data.find((e: any) => e.primary && e.verified);
          if (verifiedEmail) {
            primaryEmail = verifiedEmail.email;
            isVerified = true;
          }
        }
      } catch (_e) {
        // En caso de que el scope de emails no este concedido
      }

      return {
        provider: 'GITHUB',
        providerUserId: String(userRes.data.id),
        email: primaryEmail,
        fullName: userRes.data.name || userRes.data.login || 'Usuario GitHub',
        emailVerified: isVerified,
      };
    } catch (err) {
      console.error('[GitHub Verification Error]', err);
      throw new UnauthorizedError('Error al verificar las credenciales con GitHub');
    }
  }

  /**
   * Intercambia el código de Discord con OAuth2 o usa accessToken y consulta /users/@me
   */
  public static async verifyDiscord(
    codeOrToken: string,
    redirectUri?: string,
    isToken: boolean = false
  ): Promise<VerifiedSocialProfile> {
    try {
      let discordAccessToken = codeOrToken;

      if (!isToken) {
        const params = new URLSearchParams();
        params.append('client_id', env.DISCORD_CLIENT_ID);
        params.append('client_secret', env.DISCORD_CLIENT_SECRET);
        params.append('grant_type', 'authorization_code');
        params.append('code', codeOrToken);
        if (redirectUri) {
          params.append('redirect_uri', redirectUri);
        }

        const tokenRes = await axios.post(
          'https://discord.com/api/oauth2/token',
          params.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        );

        discordAccessToken = tokenRes.data?.access_token;
        if (!discordAccessToken) {
          throw new UnauthorizedError('No se pudo obtener el token de acceso de Discord');
        }
      }

      const userRes = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${discordAccessToken}`,
        },
      });

      const data = userRes.data;
      if (!data || !data.id) {
        throw new UnauthorizedError('No se pudo obtener el perfil de Discord');
      }

      return {
        provider: 'DISCORD',
        providerUserId: String(data.id),
        email: data.email || null,
        fullName: data.global_name || data.username || 'Usuario Discord',
        emailVerified: !!data.verified,
      };
    } catch (err: any) {
      console.error('[Discord Verification Error]', err.response?.data || err.message);
      throw new UnauthorizedError('Error al verificar las credenciales con Discord');
    }
  }
}
