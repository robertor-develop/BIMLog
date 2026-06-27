import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { projectMembersTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRolesByPermission } from "./config-validator";

import crypto from "crypto";

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production.");
  }
  const generated = crypto.randomBytes(32).toString("hex");
  process.env.JWT_SECRET = generated;
  return generated;
}

const JWT_SECRET: string = resolveJwtSecret();

export interface AuthPayload {
  userId: number;
  email: string;
  companyId: number;
  fullName: string;
  companyName: string;
  isSuperAdmin?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      memberRole?: string;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireProjectMember(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    const projectId = Number(req.params.projectId);

    if (!userId || isNaN(projectId)) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const [userCheck] = await db.select({ isSuperAdmin: usersTable.isSuperAdmin }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (userCheck?.isSuperAdmin) {
      req.memberRole = "project_admin";
      next();
      return;
    }

    const members = await db
      .select()
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, userId)))
      .limit(1);

    if (members.length === 0) {
      res.status(403).json({ error: "Not a member of this project" });
      return;
    }

    const memberRole = members[0].role;
    req.memberRole = memberRole;

    if (allowedRoles.length > 0 && !allowedRoles.includes(memberRole)) {
      res.status(403).json({ error: "Insufficient permissions for this action" });
      return;
    }

    next();
  };
}

export function signBriefAccessToken(userId: number): string {
  return jwt.sign({ userId, scope: "living_brief" }, JWT_SECRET, { expiresIn: "1h" });
}

export function verifyBriefAccessToken(token: string): { userId: number; scope: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: number; scope: string };
}

export async function isSuperAdminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  const [u] = await db.select({ isSuperAdmin: usersTable.isSuperAdmin }).from(usersTable).where(eq(usersTable.id, req.user.userId)).limit(1);
  if (!u?.isSuperAdmin) { res.status(403).json({ error: "Super admin access required" }); return; }
  next();
}

export function requirePermission(...permissionLevels: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    const projectId = Number(req.params.projectId);

    if (!userId || isNaN(projectId)) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const members = await db
      .select()
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, userId)))
      .limit(1);

    if (members.length === 0) {
      res.status(403).json({ error: "Not a member of this project" });
      return;
    }

    const memberRole = members[0].role;
    req.memberRole = memberRole;

    if (permissionLevels.length > 0) {
      const allowedRoles = await getRolesByPermission(...permissionLevels);
      if (!allowedRoles.includes(memberRole)) {
        // Stable machine-readable signal so an external client (e.g. the plugin) can
        // surface "you don't have write permission" instead of a generic 403 string.
        res.status(403).json({ error: "Insufficient permissions for this action", code: "insufficient_permissions", required: permissionLevels });
        return;
      }
    }

    next();
  };
}
