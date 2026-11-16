import jwt, { type SignOptions } from "jsonwebtoken";

import type { Role } from "../generated/prisma/enums.js";
import { config } from "./config.js";

const ISSUER = "sensus-pkl";
const AUDIENCE = "sensus-pkl";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  /** Dicocokkan dengan User.tokenVersion di DB (logout/reset = token lama mati). */
  tokenVersion: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: config.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    typeof decoded.role !== "string" ||
    typeof decoded.tokenVersion !== "number"
  ) {
    throw new Error("Payload token tidak valid");
  }

  return {
    sub: decoded.sub,
    role: decoded.role as Role,
    tokenVersion: decoded.tokenVersion,
  };
}
