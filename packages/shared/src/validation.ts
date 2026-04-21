import { z } from "zod";

export const publicBookingInputSchema = z.object({
  customerName: z.string().trim().min(1, "Vui lòng nhập tên khách hàng."),
  customerPhone: z.string().trim().min(1, "Vui lòng nhập số điện thoại."),
  requestedService: z.string().trim().optional(),
  preferredStaff: z.string().trim().optional(),
  note: z.string().trim().optional(),
  requestedStartAt: z.string().trim().min(1, "Vui lòng chọn thời gian bắt đầu."),
  requestedEndAt: z.string().trim().optional(),
  source: z.string().trim().optional(),
});

export type PublicBookingInput = z.infer<typeof publicBookingInputSchema>;
