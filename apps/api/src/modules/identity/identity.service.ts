import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import {
  ERROR_CODES,
  ROLE_PERMISSION_MAP,
  type AuthUser,
  type DataScope,
  type PermissionKey,
} from "@mankopi/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { JwtPayload } from "../../common/auth.guard";
import { store } from "../../common/request-context";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, meta: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        tenant: true,
        memberships: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: "Email atau kata sandi salah",
      });
    }
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException({ code: ERROR_CODES.USER_DISABLED, message: "Pengguna dinonaktifkan" });
    }
    if (user.tenant?.status === "SUSPENDED") {
      throw new UnauthorizedException({ code: ERROR_CODES.TENANT_SUSPENDED, message: "Koperasi ditangguhkan" });
    }

    const authUser = this.toAuthUser(user);
    const tokens = await this.issueTokens(authUser, meta);
    await this.prisma.db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.record({
      action: "identity.signed_in",
      resource: "user",
      resourceId: user.id,
      tenantId: user.tenantId,
      actorId: user.id,
    });
    return { user: authUser, ...tokens };
  }

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.db.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            tenant: true,
            memberships: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          },
        },
      },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHENTICATED, message: "Sesi berakhir" });
    }
    await this.prisma.db.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const authUser = this.toAuthUser(stored.user);
    const tokens = await this.issueTokens(authUser, meta);
    return { user: authUser, ...tokens };
  }

  async snapshot(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        memberships: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHENTICATED, message: "Sesi tidak valid" });
    }
    if (user.tenant?.status === "SUSPENDED") {
      throw new UnauthorizedException({ code: ERROR_CODES.TENANT_SUSPENDED, message: "Koperasi ditangguhkan" });
    }
    return this.toAuthUser(user);
  }

  async reissue(userId: string) {
    const authUser = await this.snapshot(userId);
    const accessToken = await this.jwt.signAsync({ ...authUser, typ: "access" } satisfies JwtPayload);
    return { user: authUser, accessToken };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return { ok: true };
    await this.prisma.db.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken) },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async listUsers(tenantId?: string) {
    return this.prisma.db.user.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        status: true,
        tenantId: true,
        lastLoginAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
        memberships: { include: { role: true, branch: true } },
      },
    });
  }

  async updateUser(
    id: string,
    input: { name?: string; phone?: string | null },
    actorId?: string,
  ) {
    const user = await this.prisma.db.user.update({
      where: { id },
      data: { name: input.name, phone: input.phone },
    });
    await this.audit.record({
      action: "identity.user.updated",
      resource: "user",
      resourceId: id,
      tenantId: user.tenantId,
      actorId,
    });
    return user;
  }

  async setUserStatus(id: string, status: "ACTIVE" | "DISABLED", actorId?: string) {
    if (id === actorId) {
      throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Tidak bisa menonaktifkan akun sendiri" });
    }
    const user = await this.prisma.db.user.update({ where: { id }, data: { status } });
    if (status === "DISABLED") {
      await this.prisma.db.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.record({
      action: status === "DISABLED" ? "identity.user.disabled" : "identity.user.enabled",
      resource: "user",
      resourceId: id,
      tenantId: user.tenantId,
      actorId,
    });
    return user;
  }

  async resetPassword(id: string, password: string, actorId?: string) {
    const user = await this.prisma.db.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    await this.prisma.db.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      action: "identity.user.password_reset",
      resource: "user",
      resourceId: id,
      tenantId: user.tenantId,
      actorId,
    });
    return { ok: true };
  }

  async setMembership(
    userId: string,
    input: { roleId: string; scope: DataScope; branchId?: string; unitId?: string },
    actorId?: string,
  ) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Pengguna tidak ditemukan" });
    }
    await this.prisma.db.membership.deleteMany({ where: { userId } });
    await this.prisma.db.membership.create({
      data: {
        userId,
        roleId: input.roleId,
        tenantId: user.tenantId,
        branchId: input.branchId,
        unitId: input.unitId,
        scope: input.scope,
      },
    });
    await this.audit.record({
      action: "identity.user.role_changed",
      resource: "user",
      resourceId: userId,
      tenantId: user.tenantId,
      actorId,
    });
    return this.prisma.db.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { role: true, branch: true } } },
    });
  }

  async createUser(input: {
    email: string;
    name: string;
    password: string;
    tenantId?: string | null;
    roleId: string;
    scope: DataScope;
    branchId?: string;
    unitId?: string;
    phone?: string;
  }) {
    const exists = await this.prisma.db.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (exists) {
      throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Email sudah terpakai" });
    }
    const user = await this.prisma.db.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        phone: input.phone,
        tenantId: input.tenantId ?? null,
        passwordHash: await bcrypt.hash(input.password, 10),
        memberships: {
          create: {
            roleId: input.roleId,
            tenantId: input.tenantId ?? null,
            branchId: input.branchId,
            unitId: input.unitId,
            scope: input.scope,
          },
        },
      },
      include: { memberships: { include: { role: true } } },
    });
    await this.audit.record({
      action: "identity.user.created",
      resource: "user",
      resourceId: user.id,
      tenantId: user.tenantId,
    });
    return user;
  }

  listRoles(filter: { tenantId?: string | null; platformOnly?: boolean }) {
    if (!filter.platformOnly && !filter.tenantId) return Promise.resolve([]);
    return this.prisma.db.role.findMany({
      where: filter.platformOnly ? { layer: "PLATFORM" } : { tenantId: filter.tenantId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
  }

  async setRolePermissions(roleId: string, keys: PermissionKey[]) {
    const role = await this.prisma.db.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Peran tidak ditemukan" });
    }
    const next = role.layer === "TENANT" ? keys.filter((key) => !key.startsWith("platform:")) : keys;
    const permissions = await this.prisma.db.permission.findMany({ where: { key: { in: next } } });
    await this.prisma.db.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.db.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
    });
    await this.audit.record({ action: "identity.role.changed", resource: "role", resourceId: roleId });
    return this.prisma.db.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async resetRolePermissions(roleId: string) {
    const role = await this.prisma.db.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Peran tidak ditemukan" });
    }
    return this.setRolePermissions(roleId, [...this.defaultPermissionKeys(role.slug)]);
  }

  async provisionTenantRoles(tenantId: string) {
    const templates = await this.prisma.db.role.findMany({
      where: { tenantId: null, layer: "TENANT" },
      include: { permissions: true },
    });
    for (const template of templates) {
      await this.prisma.db.role.create({
        data: {
          tenantId,
          name: template.name,
          slug: template.slug,
          description: template.description,
          isSystem: true,
          layer: "TENANT",
          permissions: {
            create: template.permissions.map((p) => ({ permissionId: p.permissionId })),
          },
        },
      });
    }
  }

  defaultPermissionKeys(slug: string): readonly PermissionKey[] {
    return ROLE_PERMISSION_MAP[slug] ?? [];
  }

  private async issueTokens(user: AuthUser, meta: { ip?: string; userAgent?: string }) {
    const accessToken = await this.jwt.signAsync({ ...user, typ: "access" } satisfies JwtPayload);
    const refreshToken = randomBytes(32).toString("hex");
    const days = 7;
    await this.prisma.db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 86400_000),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    return { accessToken, refreshToken };
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    name: string;
    tenantId: string | null;
    status: "ACTIVE" | "DISABLED";
    tenant?: { slug: string } | null;
    memberships: Array<{
      scope: DataScope;
      branchId: string | null;
      unitId: string | null;
      role: { slug: string; permissions: Array<{ permission: { key: string } }> };
    }>;
  }): AuthUser {
    const membership = user.memberships[0];
    const permissions = [
      ...new Set(user.memberships.flatMap((m) => m.role.permissions.map((p) => p.permission.key))),
    ] as PermissionKey[];
    const isPlatformAdmin = user.memberships.some((m) => m.role.slug === "platform_admin");
    const ctx = (() => {
      try {
        return store();
      } catch {
        return undefined;
      }
    })();
    if (ctx) ctx.user = undefined;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug ?? null,
      status: user.status,
      isPlatformAdmin,
      permissions,
      scope: membership?.scope ?? (isPlatformAdmin ? "PLATFORM" : "TENANT"),
      branchId: membership?.branchId ?? null,
      unitId: membership?.unitId ?? null,
    };
  }
}
