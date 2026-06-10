import type { Locale, MobileAppointmentSummary } from "@nails/shared";

type ResourceOptionLike = {
  id: string;
  type: string;
};

export const BLOCKING_RESOURCE_STATUSES = new Set(["BOOKED", "CHECKED_IN"]);

export function rangesOverlap(
  existingStartAt: string,
  existingEndAt: string,
  nextStartAt: string,
  nextEndAt: string,
) {
  return new Date(existingStartAt).getTime() < new Date(nextEndAt).getTime()
    && new Date(existingEndAt).getTime() > new Date(nextStartAt).getTime();
}

export function getOccupiedResourceIdsForWindow(
  appointments: MobileAppointmentSummary[],
  startAt: string,
  endAt: string,
  excludedAppointmentId?: string | null,
) {
  const occupied = new Set<string>();

  appointments.forEach((appointment) => {
    if (excludedAppointmentId && appointment.id === excludedAppointmentId) {
      return;
    }
    if (!BLOCKING_RESOURCE_STATUSES.has(appointment.status)) {
      return;
    }
    if (!rangesOverlap(appointment.startAt, appointment.endAt, startAt, endAt)) {
      return;
    }

    if (appointment.resourceId) {
      occupied.add(appointment.resourceId);
    }
    if (appointment.secondaryResourceId) {
      occupied.add(appointment.secondaryResourceId);
    }
  });

  return occupied;
}

export function buildAppointmentWindow(dateValue: string, timeValue: string, durationValue: string) {
  const [day, month, year] = dateValue.split("/");
  if (!day || !month || !year || !timeValue) {
    return null;
  }

  const parsedStartAt = new Date(`${year}-${month}-${day}T${timeValue}`);
  const duration = Number(durationValue);
  if (Number.isNaN(parsedStartAt.getTime()) || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  const endAt = new Date(parsedStartAt);
  endAt.setMinutes(endAt.getMinutes() + duration);

  return {
    startAt: parsedStartAt.toISOString(),
    endAt: endAt.toISOString(),
  };
}

export function getFootHandComboCopy(locale: Locale) {
  return locale === "vi"
    ? {
        label: "Combo chân tay",
        resourceSummaryLabel: "Tài nguyên",
        missingPairTitle: "Thiếu tài nguyên",
        missingPairBody: "Cần ít nhất 1 ghế chân và 1 bàn tay đang hoạt động để tạo combo chân tay.",
        unavailableTitle: "Không còn combo trống",
        unavailableBody:
          "Khung giờ này không còn đủ 1 ghế chân và 1 bàn tay đang trống. Vui lòng đổi giờ hoặc chọn tài nguyên thủ công.",
        conflictTitle: "Tài nguyên đã có lịch",
      }
    : {
        label: "Foot + hand combo",
        resourceSummaryLabel: "Resources",
        missingPairTitle: "Missing resources",
        missingPairBody: "At least one active foot chair and one active hand table are required for a foot + hand combo.",
        unavailableTitle: "No combo available",
        unavailableBody:
          "This time slot no longer has both one available foot chair and one available hand table. Please change the time or choose resources manually.",
        conflictTitle: "Resource unavailable",
      };
}

export function findAvailableFootHandCombo(params: {
  appointments: MobileAppointmentSummary[];
  resourceOptions: ResourceOptionLike[];
  startAt: string;
  endAt: string;
  excludedAppointmentId?: string | null;
}) {
  const footResources = params.resourceOptions.filter((resource) => resource.type === "CHAIR");
  const handResources = params.resourceOptions.filter((resource) => resource.type === "TABLE");

  if (footResources.length === 0 || handResources.length === 0) {
    return null;
  }

  const occupiedResourceIds = getOccupiedResourceIdsForWindow(
    params.appointments,
    params.startAt,
    params.endAt,
    params.excludedAppointmentId,
  );

  const primary = footResources.find((resource) => !occupiedResourceIds.has(resource.id)) ?? null;
  const secondary = handResources.find((resource) => !occupiedResourceIds.has(resource.id)) ?? null;

  if (!primary || !secondary) {
    return null;
  }

  return {
    resourceId: primary.id,
    secondaryResourceId: secondary.id,
  };
}
