import { permanentRedirect } from "next/navigation";

export default function LegacyBookingRequestsPage() {
  permanentRedirect("/manage/appointments/web-booking");
}
