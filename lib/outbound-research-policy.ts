import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export const WEB_RESEARCH_MODE_ENV = "OLD_MIKE_WEB_RESEARCH_MODE";
export const WEB_RESEARCH_MODES = ["disabled", "public_read_only"] as const;

export type WebResearchMode = (typeof WEB_RESEARCH_MODES)[number];
export type ResearchDnsAddress = { address: string; family: 4 | 6 };
export type ResearchDnsResolver = (hostname: string) => Promise<ResearchDnsAddress[]>;
export type PublicResearchTarget = { url: URL; addresses: readonly ResearchDnsAddress[] };

export type WebResearchPolicyErrorCode =
  | "invalid_url"
  | "https_required"
  | "credentials_forbidden"
  | "port_forbidden"
  | "blocked_hostname"
  | "blocked_ip"
  | "blocked_dns_result"
  | "dns_resolution_failed";

export class WebResearchPolicyError extends Error {
  readonly code: WebResearchPolicyErrorCode;
  readonly status: number;

  constructor(code: WebResearchPolicyErrorCode, status = 400) {
    super(code);
    this.name = "WebResearchPolicyError";
    this.code = code;
    this.status = status;
  }
}

export function webResearchMode(env: NodeJS.ProcessEnv = process.env): WebResearchMode {
  return env[WEB_RESEARCH_MODE_ENV] === "public_read_only" ? "public_read_only" : "disabled";
}

export function webResearchEnabled(env: NodeJS.ProcessEnv = process.env) {
  return webResearchMode(env) === "public_read_only";
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const numbers = parts.map(Number);
  return numbers.every((part) => part >= 0 && part <= 255) ? numbers : null;
}

function isBlockedIpv4(address: string) {
  const parts = parseIpv4(address);
  if (!parts) return true;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && b >= 18 && b <= 19) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function ipv6Words(address: string): number[] | null {
  let value = address.toLowerCase();
  if (value.includes("%")) return null;

  const dottedTail = value.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (dottedTail) {
    const ipv4 = parseIpv4(dottedTail);
    if (!ipv4) return null;
    const tail = `${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
    value = `${value.slice(0, value.length - dottedTail.length)}${tail}`;
  }

  if ((value.match(/::/g) || []).length > 1) return null;
  const [leftRaw, rightRaw] = value.split("::");
  const left = leftRaw ? leftRaw.split(":") : [];
  const right = rightRaw ? rightRaw.split(":") : [];
  if ([...left, ...right].some((word) => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  const omitted = value.includes("::") ? 8 - left.length - right.length : 0;
  if (omitted < 0 || (!value.includes("::") && left.length !== 8)) return null;
  const words = [...left, ...Array.from({ length: omitted }, () => "0"), ...right].map((word) => Number.parseInt(word, 16));
  return words.length === 8 && words.every(Number.isFinite) ? words : null;
}

function isBlockedIpv6(address: string) {
  const words = ipv6Words(address);
  if (!words) return true;
  const [first, second] = words;
  const allZero = words.every((word) => word === 0);
  const loopback = words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  return (
    allZero ||
    loopback ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0 && second === 0) ||
    first === 0x0064 ||
    (first === 0x2001 && (second === 0x0000 || second === 0x0002 || second === 0x000d || second === 0x0010 || second === 0x0db8)) ||
    first === 0x2002 ||
    (first & 0xfff0) === 0x3ff0 ||
    (first & 0xffc0) === 0xfec0
  );
}

export function isPublicResearchAddress(address: string) {
  const normalized = address.trim().replace(/^\[|\]$/g, "");
  const family = isIP(normalized);
  if (family === 4) return !isBlockedIpv4(normalized);
  if (family === 6) return !isBlockedIpv6(normalized);
  return false;
}

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    !host ||
    host === "localhost" ||
    host === "localhost.localdomain" ||
    host === "instance-data" ||
    host === "metadata" ||
    host.startsWith("metadata.") ||
    host.startsWith("service-") ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa") ||
    host.endsWith(".lan") ||
    host.endsWith(".corp") ||
    host.endsWith(".test") ||
    host.endsWith(".invalid") ||
    host.endsWith(".example")
  );
}

const defaultResolver: ResearchDnsResolver = async (hostname) => {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map(({ address }) => {
    const family = isIP(address);
    if (family !== 4 && family !== 6) throw new Error("invalid_dns_address");
    return { address, family };
  });
};

export async function resolvePublicResearchTarget(
  input: string | URL,
  options: { resolver?: ResearchDnsResolver } = {},
): Promise<PublicResearchTarget> {
  let url: URL;
  try {
    url = input instanceof URL ? new URL(input.toString()) : new URL(input);
  } catch {
    throw new WebResearchPolicyError("invalid_url");
  }

  if (url.protocol !== "https:") throw new WebResearchPolicyError("https_required");
  if (url.username || url.password) throw new WebResearchPolicyError("credentials_forbidden");
  if (url.port && url.port !== "443") throw new WebResearchPolicyError("port_forbidden");

  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (isBlockedHostname(hostname)) throw new WebResearchPolicyError("blocked_hostname");

  const literalFamily = isIP(hostname);
  let addresses: ResearchDnsAddress[];
  if (literalFamily === 4 || literalFamily === 6) {
    if (!isPublicResearchAddress(hostname)) throw new WebResearchPolicyError("blocked_ip");
    addresses = [{ address: hostname, family: literalFamily }];
  } else {
    try {
      addresses = await (options.resolver || defaultResolver)(hostname);
    } catch {
      throw new WebResearchPolicyError("dns_resolution_failed", 502);
    }
    if (!addresses.length || addresses.some(({ address, family }) => isIP(address) !== family || !isPublicResearchAddress(address))) {
      throw new WebResearchPolicyError("blocked_dns_result");
    }
  }

  url.hostname = hostname;
  url.hash = "";
  if (url.port === "443") url.port = "";
  return { url, addresses: addresses.map((item) => ({ address: item.address, family: item.family })) };
}

export async function validatePublicResearchUrl(
  input: string | URL,
  options: { resolver?: ResearchDnsResolver } = {},
) {
  return (await resolvePublicResearchTarget(input, options)).url;
}
