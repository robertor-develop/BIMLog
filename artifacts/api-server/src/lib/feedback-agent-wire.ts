import { createHmac, timingSafeEqual } from "node:crypto";

export const FEEDBACK_AGENT_MAX_ATTEMPTS = 3;
export const FEEDBACK_AGENT_LEASE_SECONDS = 300;

export function feedbackAgentMac(key: string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

export function feedbackAgentRequestBytes(nonce: string, pathname: string, body: string) {
  return `${nonce}\n${pathname}\n${body}`;
}

export function feedbackAgentResponseBytes(nonce: string, status: number, body: string) {
  return `${nonce}\n${status}\n${body}`;
}

export function safeFeedbackAgentMacEqual(supplied: string, expected: string) {
  return /^[a-f0-9]{64}$/.test(supplied)
    && supplied.length === expected.length
    && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}
