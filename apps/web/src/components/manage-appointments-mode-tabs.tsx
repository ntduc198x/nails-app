"use client";

import Link from "next/link";

type AppointmentsMode = "calendar" | "web-booking";

const BOOKING_SERVICES_LABEL = "Booking services";

export function getAppointmentsModeLabel(mode: AppointmentsMode) {
  return mode === "calendar" ? "Lịch hẹn" : BOOKING_SERVICES_LABEL;
}

export function ManageAppointmentsModeTabs({
  activeTab,
  calendarHref,
  webBookingHref,
}: {
  activeTab: AppointmentsMode;
  calendarHref: string;
  webBookingHref: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={calendarHref}
        className={activeTab === "calendar" ? "manage-quick-link-accent" : "manage-quick-link"}
      >
        {getAppointmentsModeLabel("calendar")}
      </Link>
      <Link
        href={webBookingHref}
        className={activeTab === "web-booking" ? "manage-quick-link-accent" : "manage-quick-link"}
      >
        {getAppointmentsModeLabel("web-booking")}
      </Link>
    </div>
  );
}
