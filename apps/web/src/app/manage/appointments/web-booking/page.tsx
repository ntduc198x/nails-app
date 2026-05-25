import { Suspense } from "react";
import { ManageWebBookingPage } from "@/components/manage-web-booking-page";

export default function ManageAppointmentsWebBookingPage() {
  return (
    <Suspense fallback={null}>
      <ManageWebBookingPage />
    </Suspense>
  );
}
