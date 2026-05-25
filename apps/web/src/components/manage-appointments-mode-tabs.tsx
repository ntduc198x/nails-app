"use client";

type AppointmentsMode = "calendar" | "web-booking";

const BOOKING_SERVICES_LABEL = "Booking services";

export function getAppointmentsModeLabel(mode: AppointmentsMode) {
  return mode === "calendar" ? "Lịch hẹn" : BOOKING_SERVICES_LABEL;
}

export function ManageAppointmentsModeTabs({
  activeTab,
  onSelect,
}: {
  activeTab: AppointmentsMode;
  onSelect: (tab: AppointmentsMode) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect("calendar")}
        className={activeTab === "calendar" ? "manage-quick-link-accent" : "manage-quick-link"}
      >
        {getAppointmentsModeLabel("calendar")}
      </button>
      <button
        type="button"
        onClick={() => onSelect("web-booking")}
        className={activeTab === "web-booking" ? "manage-quick-link-accent" : "manage-quick-link"}
      >
        {getAppointmentsModeLabel("web-booking")}
      </button>
    </div>
  );
}
