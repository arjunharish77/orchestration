import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { randomBytes } from 'crypto';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class EmailDto {
  @IsEmail()
  email!: string;
}

class VerifyEmailOtpDto extends EmailDto {
  @IsString()
  @Length(6, 6)
  otp!: string;
}

class ConfirmPasswordResetDto extends EmailDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

class RefreshSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(40)
  refreshToken?: string;
}

class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

type AuthenticatedRequest = {
  user: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
};

type CookieResponse = {
  setHeader(name: string, value: string | string[]): void;
};

type AuthTokenResponse = {
  accessToken: string;
  refreshToken?: string | null;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService
  ) {}

  @Post('login')
  async login(@Body() body: LoginDto, @Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: CookieResponse) {
    const payload = await this.authService.login(body.email, body.password, requestMeta(request));
    this.writeAuthCookies(response, payload);
    return payload;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.currentUser(user.id);
  }

  @Post('email-otp/request')
  requestEmailOtp(@Body() body: EmailDto) {
    return this.authService.requestEmailOtp(body.email);
  }

  @Post('email-otp/verify')
  verifyEmailOtp(@Body() body: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(body.email, body.otp);
  }

  @Post('login/email-otp/verify')
  async verifyLoginEmailOtp(@Body() body: VerifyEmailOtpDto, @Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: CookieResponse) {
    const payload = await this.authService.verifyLoginEmailOtp(body.email, body.otp, requestMeta(request));
    this.writeAuthCookies(response, payload);
    return payload;
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshSessionDto, @Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: CookieResponse) {
    const refreshToken = body.refreshToken ?? readCookie(request.headers.cookie, 'unnatify_refresh_token');
    const payload = await this.authService.refreshSession(refreshToken ?? '');
    this.writeAuthCookies(response, payload);
    return payload;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() request: AuthenticatedRequest, @Body() body: LogoutDto, @Res({ passthrough: true }) response: CookieResponse) {
    const refreshToken = body.refreshToken ?? readCookie(request.headers.cookie, 'unnatify_refresh_token');
    const payload = await this.authService.logout(request.user.sessionId, refreshToken ?? undefined);
    this.clearAuthCookies(response);
    return payload;
  }

  @Post('password-reset/request')
  requestPasswordReset(@Body() body: EmailDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() body: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(body.email, body.token, body.newPassword);
  }

  private writeAuthCookies(response: CookieResponse, payload: unknown) {
    if (!isAuthTokenResponse(payload)) return;
    const csrfCookieDomain = this.csrfCookieDomain();
    const cookies = [
      buildCookie('unnatify_access_token', payload.accessToken, this.accessTokenMaxAgeSeconds(), this.cookieSecure()),
      payload.refreshToken ? buildCookie('unnatify_refresh_token', payload.refreshToken, this.refreshTokenMaxAgeSeconds(), this.cookieSecure()) : null,
      csrfCookieDomain ? buildCookie('unnatify_csrf_token', '', 0, this.cookieSecure(), false, 'Strict') : null,
      buildCookie('unnatify_csrf_token', randomBytes(24).toString('hex'), this.refreshTokenMaxAgeSeconds(), this.cookieSecure(), false, 'Strict', csrfCookieDomain)
    ].filter(Boolean) as string[];
    response.setHeader('Set-Cookie', cookies);
  }

  private clearAuthCookies(response: CookieResponse) {
    const csrfCookieDomain = this.csrfCookieDomain();
    response.setHeader('Set-Cookie', [
      buildCookie('unnatify_access_token', '', 0, this.cookieSecure()),
      buildCookie('unnatify_refresh_token', '', 0, this.cookieSecure()),
      buildCookie('unnatify_csrf_token', '', 0, this.cookieSecure(), false, 'Strict'),
      buildCookie('unnatify_csrf_token', '', 0, this.cookieSecure(), false, 'Strict', csrfCookieDomain)
    ]);
  }

  private accessTokenMaxAgeSeconds() {
    return parseDurationSeconds(this.config.get<string>('JWT_EXPIRES_IN') ?? '8h', 8 * 60 * 60);
  }

  private refreshTokenMaxAgeSeconds() {
    const days = Number(this.config.get<string>('REFRESH_TOKEN_EXPIRES_DAYS') ?? 30);
    return (Number.isFinite(days) && days > 0 ? days : 30) * 24 * 60 * 60;
  }

  private cookieSecure() {
    const appUrl = this.config.get<string>('APP_URL') ?? '';
    return this.config.get<string>('NODE_ENV') === 'production' || appUrl.startsWith('https://');
  }

  private csrfCookieDomain() {
    const configured = this.config.get<string>('CSRF_COOKIE_DOMAIN')?.trim();
    if (configured) return configured;
    const appUrl = this.config.get<string>('APP_URL') ?? '';
    const apiUrl = this.config.get<string>('API_URL') ?? '';
    const parentDomain = sharedParentDomain(appUrl, apiUrl);
    return parentDomain ? `.${parentDomain}` : undefined;
  }
}

function requestMeta(request: AuthenticatedRequest) {
  const userAgent = request.headers['user-agent'];
  const forwardedFor = request.headers['x-forwarded-for'];
  return {
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    ipAddress: Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor ?? request.ip
  };
}

function readCookie(value: string | string[] | undefined, name: string) {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return null;
  const cookie = header
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function buildCookie(name: string, value: string, maxAgeSeconds: number, secure: boolean, httpOnly = true, sameSite: 'Lax' | 'Strict' = 'Lax', domain?: string) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `SameSite=${sameSite}`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join('; ');
}

function sharedParentDomain(appUrl: string, apiUrl: string) {
  const appHost = hostnameFromUrl(appUrl);
  const apiHost = hostnameFromUrl(apiUrl);
  if (!appHost || !apiHost || appHost === apiHost) return undefined;
  const appParts = appHost.split('.');
  const apiParts = apiHost.split('.');
  const shared: string[] = [];
  while (appParts.length && apiParts.length && appParts[appParts.length - 1] === apiParts[apiParts.length - 1]) {
    shared.unshift(appParts.pop() as string);
    apiParts.pop();
  }
  return shared.length >= 2 ? shared.join('.') : undefined;
}

function hostnameFromUrl(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function parseDurationSeconds(value: string, fallback: number) {
  const match = value.trim().match(/^(\d+)([smhd])?$/i);
  if (!match) return fallback;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallback;
  const unit = (match[2] ?? 's').toLowerCase();
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 60 * 60;
  if (unit === 'd') return amount * 24 * 60 * 60;
  return amount;
}

function isAuthTokenResponse(payload: unknown): payload is AuthTokenResponse {
  return Boolean(payload && typeof payload === 'object' && 'accessToken' in payload && typeof (payload as { accessToken?: unknown }).accessToken === 'string');
}
