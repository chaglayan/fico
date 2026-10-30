import type { Institution } from "../../shared/bank";
import type { BankProvider, ProviderId } from "./provider";
import { SimulatedBank } from "./simulated";
import { Yapily } from "./yapily";

export type ProviderEnv = {
  APP_ENV?: string;
  YAPILY_APPLICATION_ID?: string;
  YAPILY_APPLICATION_SECRET?: string;
  YAPILY_API_URL?: string;
  YAPILY_COUNTRY?: string;
  // "on" or "off"; by default the simulated banks are offered outside production.
  SIMULATED_BANK?: string;
};

// The providers this deployment offers. Institution IDs in the app carry the
// provider as a prefix ("yapily:modelo-sandbox", "simulated:musterbank").
export function providersFor(env: ProviderEnv): BankProvider[] {
  const list: BankProvider[] = [];
  if (env.YAPILY_APPLICATION_ID && env.YAPILY_APPLICATION_SECRET) {
    list.push(
      new Yapily({
        applicationId: env.YAPILY_APPLICATION_ID,
        secret: env.YAPILY_APPLICATION_SECRET,
        baseUrl: env.YAPILY_API_URL,
        country: env.YAPILY_COUNTRY,
      }),
    );
  }
  const simulated = env.SIMULATED_BANK ? env.SIMULATED_BANK === "on" : env.APP_ENV !== "production";
  if (simulated) list.push(new SimulatedBank());
  return list;
}

export function qualify(provider: ProviderId, institution: Institution): Institution {
  return { ...institution, id: `${provider}:${institution.id}` };
}

export function splitInstitutionId(id: string): { provider: string; institutionId: string } | null {
  const at = id.indexOf(":");
  return at > 0 ? { provider: id.slice(0, at), institutionId: id.slice(at + 1) } : null;
}
