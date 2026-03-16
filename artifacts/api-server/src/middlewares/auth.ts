import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { projectMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production.");
  }
  process.env.JWT_SECRET = process.env.REPL_ID || require("crypto").randomBytes(32).toString("hex");
}

const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AuthPayload {
  userId: number;
  email: string;
  companyId: number;
  fullName: string;
  companyName: string;
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
