"use client";

import { AppShell } from "@/components/app-shell";
import { ManageBookingRequestsPanel } from "@/components/manage-booking-requests-panel";
import { ManageQuickNav, operationsQuickNav } from "@/components/manage-quick-nav";
import Link from "next/link";

function ManageModeTabs() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/manage/appointments?tab=calendar" className="manage-quick-link">
        Lịch hẹn
      </Link>
      <Link href="/manage/appointments?tab=web-booking" className="manage-quick-link-accent">
        Web Booking
      </Link>
    </div>
  );
}

export default function BookingRequestsPage() {
  return (
    <AppShell>
      <div className="space-y-5 pb-24 md:pb-0">
        <ManageQuickNav items={operationsQuickNav("/manage/appointments")} />
        <ManageModeTabs />
        <div className="manage-info-box">
          Route cũ vẫn đang hoạt động để không gãy link Telegram và thông báo nội bộ. Điều hướng chính đã chuyển sang
          <span className="font-semibold"> Appointments → Web Booking</span>.
        </div>
        <ManageBookingRequestsPanel />
      </div>
    </AppShell>
  );
}
