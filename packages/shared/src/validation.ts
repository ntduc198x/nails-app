import { z } from "zod";
import { DEFAULT_LOCALE, type Locale, translate } from "./i18n";

export function createPublicBookingInputSchema(locale: Locale = DEFAULT_LOCALE) {
  return z.object({
    customerName: z.string().trim().min(1, translate(locale, "errors", "bookingMissingName")),
    customerPhone: z.string().trim().min(1, translate(locale, "errors", "bookingMissingPhone")),
    requestedService: z.string().trim().optional(),
    preferredStaff: z.string().trim().optional(),
    note: z.string().trim().optional(),
    requestedStartAt: z.string().trim().min(1, translate(locale, "errors", "bookingMissingStartAt")),
    requestedEndAt: z.string().trim().optional(),
    source: z.string().trim().optional(),
    appliedOfferId: z.string().uuid().optional(),
    appliedOfferClaimId: z.string().uuid().optional(),
    appliedOfferCode: z.string().trim().optional(),
  });
}

export const publicBookingInputSchema = createPublicBookingInputSchema();

export type PublicBookingInput = z.infer<typeof publicBookingInputSchema>;
