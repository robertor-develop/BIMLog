import type { CommercialOffer } from "./commercial-offers";
import { commercialDestination } from "./commercial-offers";
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
  if (offer.id === "free") {
    return Object.freeze({
      destination: commercialDestination(offer, billing, useCase),
      mode: "free_signup",
      label: { en: "Create free account", es: "Crear cuenta gratis" },
      detail: {
        en: "Create your company account now. No payment method or sales conversation is required.",
        es: "Cree ahora la cuenta de su empresa. No se requiere método de pago ni conversación comercial.",
      },
    });
  }

  if (offer.id === "enterprise") {
    return Object.freeze({
      destination: commercialDestination(offer, billing, useCase),
      mode: "custom_consultation",
      label: { en: "Request enterprise consultation", es: "Solicitar consulta Enterprise" },
      detail: {
        en: "Enterprise scope, service levels and pricing require a confirmed customer agreement.",
        es: "El alcance, los niveles de servicio y el precio Enterprise requieren un acuerdo confirmado con el cliente.",
      },
    });
  }

  if (availability?.paidPlans === "available") {
    const query = new URLSearchParams({ plan: offer.id, billing });
    if (useCase.trim()) query.set("useCase", useCase.trim().slice(0, 120));
    return Object.freeze({
      destination: `/register?${query}`,
      mode: "paid_signup",
      label: { en: "Create account for this plan", es: "Crear cuenta para este plan" },
      detail: {
        en: "Create the company account first, then confirm the subscription in Billing & Support. This page does not take payment.",
        es: "Primero cree la cuenta de la empresa y luego confirme la suscripción en Facturación y soporte. Esta página no realiza cobros.",
      },
    });
  }

  return Object.freeze({
    destination: commercialDestination(offer, billing, useCase),
    mode: "consultation",
    label: { en: "Request plan consultation", es: "Solicitar consulta del plan" },
    detail: availability
      ? {
          en: "Paid activation currently begins with a consultation. BIMLog will confirm readiness and contracted terms before access changes.",
          es: "La activación pagada comienza actualmente con una consulta. BIMLog confirmará la disponibilidad y los términos contratados antes de cambiar el acceso.",
        }
      : {
          en: "Paid-plan availability could not be verified. Send the selected plan for review; no payment is taken here.",
          es: "No se pudo verificar la disponibilidad del plan pagado. Envíe el plan seleccionado para revisión; aquí no se realiza ningún cobro.",
        },
  });
}
