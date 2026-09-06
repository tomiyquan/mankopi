import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";
import type { AuthUser } from "@mankopi/shared";

export type TxClient = Prisma.TransactionClient;

export type RequestStore = {
  tx: TxClient;
  user?: AuthUser;
  tenantId?: string;
  bypassRls: boolean;
  ip?: string;
  userAgent?: string;
};

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function store(): RequestStore {
  const current = requestContext.getStore();
  if (!current) {
    throw new Error("Request context is not available");
  }
  return current;
}

export function optionalStore(): RequestStore | undefined {
  return requestContext.getStore();
}
