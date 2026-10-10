import type { CommercialOffer } from "./commercial-offers";
import type { PublicCommercialAvailabilityDto } from "./public-commercial-availability-client";

export type CommercialAvailabilityJourney = Readonly<{
  destination: string;
  mode: "free_signup" | "paid_signup" | "consultation" | "custom_consultation";
  label: Readonly<{ en: string; es: string }>;
  detail: Readonly<{ en: string; es: string }>;
}>;

export function commercialAvailabilityJourney(
  offer: CommercialOffer,
  billing: "monthly" | "annual",
  useCase: string,
  availability: PublicCommercialAvailabilityDto | null,
): CommercialAvailabilityJourney {
  const query = new URLSearchParams({ plan: offer.id, billing });
  if (useCase.trim()) query.set("useCase", useCase.trim().slice(0, 120));
  const destination = (path: "/register" | "/contact") => `${path}?${query}`;
  if (offer.id === "free") {
    return {
      destination: destination("/register"),
      mode: "free_signup",
      label: { en: "Create free account", es: "Crear cuenta gratis" },
      detail: {
        en: "Create your company account. No card required.",
        es: "Cree la cuenta de su empresa. No requiere tarjeta.",
      },
    };
  }

  if (offer.id === "enterprise") {
    return {
      destination: destination("/contact"),
      mode: "custom_consultation",
      label: { en: "Request enterprise consultation", es: "Solicitar consulta Enterprise" },
      detail: {
        en: "Enterprise scope and price require an agreement.",
        es: "El alcance y precio Enterprise requieren un acuerdo.",
      },
    };
  }

  if (availability?.paidPlans === "available") {
    return {
      destination: destination("/register"),
      mode: "paid_signup",
      label: { en: "Create account for this plan", es: "Crear cuenta para este plan" },
      detail: {
        en: "Create the company account, then confirm in Billing & Support. This page does not take payment.",
        es: "Cree la cuenta y confirme en Facturación y soporte. Aquí no se realiza ningún cobro.",
      },
    };
  }

  return {
    destination: destination("/contact"),
    mode: "consultation",
    label: { en: "Request plan consultation", es: "Solicitar consulta del plan" },
    detail: availability
      ? {
          en: "Paid activation starts with a consultation.",
          es: "La activación pagada comienza con una consulta.",
        }
      : {
          en: "Availability is unverified. Request review; no payment is taken here.",
          es: "Disponibilidad sin verificar. Solicite revisión; aquí no se cobra.",
        },
  };
}
