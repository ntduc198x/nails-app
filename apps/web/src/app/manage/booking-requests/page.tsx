"use client";

import { AppShell } from "@/components/app-shell";
import { getAppointmentsModeLabel, ManageAppointmentsModeTabs } from "@/components/manage-appointments-mode-tabs";
import { BookingServicesPanelSkeleton } from "@/components/manage-booking-requests.sections";
import { ManageQuickNav, operationsQuickNav } from "@/components/manage-quick-nav";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const ManageBookingRequestsPanel = dynamic(
  () => import("@/components/manage-booking-requests-panel").then((module) => module.ManageBookingRequestsPanel),
  {
    loading: () => <BookingServicesPanelSkeleton title={getAppointmentsModeLabel("web-booking")} />,
  },
);

export default function BookingRequestsPage() {
  const router = useRouter();

  return (
    <AppShell>
      <div className="space-y-5 pb-24 md:pb-0">
        <ManageQuickNav items={operationsQuickNav("/manage/appointments")} />
        <ManageAppointmentsModeTabs
          activeTab="web-booking"
          onSelect={(tab) => router.push(`/manage/appointments?tab=${tab}`)}
        />
        <div className="manage-info-box">
          Route cũ vẫn đang hoạt động để không gãy link Telegram và thông báo nội bộ. Điều hướng chính đã chuyển sang
          <span className="font-semibold"> Appointments → {getAppointmentsModeLabel("web-booking")}</span>.
        </div>
        <ManageBookingRequestsPanel title={getAppointmentsModeLabel("web-booking")} />
      </div>
    </AppShell>
  );
}
