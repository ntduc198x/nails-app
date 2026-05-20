import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  generateTeamInviteCodeForMobile,
  getRoleLabel,
  listTeamInviteCodesForMobile,
  listTeamMembersForMobile,
  revokeTeamInviteCodeForMobile,
  type AppRole,
  type InviteCodeRole,
  type ServiceSkill,
  type ShiftType,
  type StaffRole,
  SERVICE_SKILL_OPTIONS,
  type TeamInviteCodeRow,
  type TeamMemberRow,
  updateTeamMemberDisplayNameForMobile,
  updateTeamMemberRoleForMobile,
} from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";
import { ManageScreenShell, manageStyles, useManageRouteAccess } from "@/src/features/admin/manage-ui";
import {
  canManageShiftPlans,
  createEmptyStaffShiftProfile,
  isMissingStaffShiftProfilesSchema,
  loadStaffShiftProfiles,
  normalizeStaffShiftProfiles,
  saveStaffShiftProfile,
  type StaffShiftProfileRecord,
} from "@/src/features/admin/shifts/data";
import { useAdminKeyboardFieldFocus } from "@/src/features/admin/ui";
import { useSession } from "@/src/providers/session-provider";

const roleOptions: AppRole[] = ["MANAGER", "RECEPTION", "ACCOUNTANT", "TECH"];
const teamSortOrder: AppRole[] = ["TECH", "ACCOUNTANT", "RECEPTION", "MANAGER", "PARTNER", "OWNER"];
const specialTeamRoles: AppRole[] = ["OWNER", "PARTNER"];
const shiftTypeSortOrder: ShiftType[] = ["MORNING", "AFTERNOON", "FULL_DAY"];
const shiftTypeOptions: Array<{ value: ShiftType; label: string }> = [
  { value: "MORNING", label: "Ca sáng" },
  { value: "AFTERNOON", label: "Ca chiều" },
  { value: "FULL_DAY", label: "Ca full" },
];
const weekdayOptions = [
  { value: 1, label: "Thứ 2" },
  { value: 2, label: "Thứ 3" },
  { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" },
  { value: 5, label: "Thứ 6" },
  { value: 6, label: "Thứ 7" },
  { value: 0, label: "Chủ nhật" },
] as const;

const palette = {
  border: "#EADFD3",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F3E7DA",
  danger: "#C66043",
  dangerSoft: "#FBECE7",
  success: "#2B9E5F",
  successSoft: "#E8F6ED",
  info: "#7A69E8",
  infoSoft: "#F2EEFF",
  warning: "#E79937",
  warningSoft: "#FFF1E0",
  red: "#FF6A5E",
  redSoft: "#FFF0EE",
  mutedSoft: "#F7F3EE",
};

function avatarColor(role: AppRole) {
  if (role === "OWNER") return { soft: palette.redSoft, text: palette.red };
  if (role === "MANAGER") return { soft: palette.successSoft, text: palette.success };
  if (role === "RECEPTION") return { soft: palette.warningSoft, text: palette.warning };
  if (role === "ACCOUNTANT") return { soft: palette.infoSoft, text: palette.info };
  return { soft: "#EEF8FF", text: "#5B9BD5" };
}

function roleIcon(role: AppRole): keyof typeof Feather.glyphMap {
  if (role === "OWNER") return "users";
  if (role === "MANAGER") return "shield";
  if (role === "RECEPTION") return "user";
  if (role === "ACCOUNTANT") return "credit-card";
  return "scissors";
}

function compareTeamMembers(left: TeamMemberRow, right: TeamMemberRow) {
  const leftIndex = teamSortOrder.indexOf(left.role);
  const rightIndex = teamSortOrder.indexOf(right.role);
  const normalizedLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
  const normalizedRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

  if (normalizedLeftIndex !== normalizedRightIndex) {
    return normalizedLeftIndex - normalizedRightIndex;
  }

  return left.displayName.localeCompare(right.displayName, "vi");
}

function isSpecialTeamRole(role: AppRole) {
  return specialTeamRoles.includes(role);
}

function isShiftProfileEditableRole(role: AppRole): role is StaffRole {
  return role === "TECH" || role === "ACCOUNTANT" || role === "RECEPTION" || role === "MANAGER";
}

function normalizeShiftTypes(shiftTypes: ShiftType[]) {
  return [...new Set(shiftTypes)]
    .filter((shiftType) => shiftType !== "OFF")
    .sort((left, right) => shiftTypeSortOrder.indexOf(left) - shiftTypeSortOrder.indexOf(right));
}

function buildShiftProfileSignature(profile: StaffShiftProfileRecord) {
  return JSON.stringify({
    staffRole: profile.staffRole,
    skills: [...profile.skills].sort(),
    availability: [...profile.availability]
      .map((rule) => ({
        weekday: rule.weekday,
        shiftTypes: normalizeShiftTypes(rule.shiftTypes),
      }))
      .sort((left, right) => left.weekday - right.weekday),
  });
}

function replaceShiftProfile(currentProfiles: StaffShiftProfileRecord[], nextProfile: StaffShiftProfileRecord) {
  const map = new Map(currentProfiles.map((item) => [item.userId, item]));
  map.set(nextProfile.userId, nextProfile);
  return Array.from(map.values());
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const handleFieldFocus = useAdminKeyboardFieldFocus();

  return (
    <TextInput
      {...props}
      onFocus={(event) => {
        handleFieldFocus(event);
        props.onFocus?.(event);
      }}
      placeholderTextColor="#B3A79B"
      style={[styles.input, props.style]}
    />
  );
}

function MetricCard({
  icon,
  iconColor,
  iconSoft,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconSoft: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricRow}>
        <View style={[styles.metricIcon, { backgroundColor: iconSoft }]}>
          <Feather name={icon} size={15} color={iconColor} />
        </View>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function RoleChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.roleChip, active ? styles.roleChipActive : null]} onPress={onPress}>
      <Text style={[styles.roleChipText, active ? styles.roleChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

export default function AdminManageTeamScreen() {
  const { isHydrated, allowed } = useManageRouteAccess(["OWNER", "PARTNER"]);
  const { role: currentRole } = useSession();
  const [rows, setRows] = useState<TeamMemberRow[]>([]);
  const [inviteRows, setInviteRows] = useState<TeamInviteCodeRow[]>([]);
  const [shiftProfiles, setShiftProfiles] = useState<StaffShiftProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [profileBusyUserId, setProfileBusyUserId] = useState<string | null>(null);
  const [profileSchemaMissing, setProfileSchemaMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteCodeRole>("TECH");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AppRole>>({});
  const [profileDrafts, setProfileDrafts] = useState<Record<string, StaffShiftProfileRecord>>({});
  const canManageProfiles = canManageShiftPlans(currentRole);

  const load = useCallback(async (force = false) => {
    if (!mobileSupabase) {
      setError("Thiếu cấu hình Supabase mobile.");
      setLoading(false);
      return;
    }

    try {
      if (force || rows.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      setProfileSchemaMissing(false);

      const [teamRows, invites, profileRowsRaw] = await Promise.all([
        listTeamMembersForMobile(mobileSupabase),
        listTeamInviteCodesForMobile(mobileSupabase),
        canManageProfiles
          ? loadStaffShiftProfiles().catch((nextError) => {
              if (isMissingStaffShiftProfilesSchema(nextError)) {
                setProfileSchemaMissing(true);
                return [];
              }
              throw nextError;
            })
          : Promise.resolve([]),
      ]);

      const fallbackRoles = new Map<string, StaffRole>();
      for (const row of teamRows) {
        if (isShiftProfileEditableRole(row.role)) {
          fallbackRoles.set(row.userId, row.role);
        }
      }
      const normalizedProfiles = normalizeStaffShiftProfiles(profileRowsRaw as never[], fallbackRoles);

      setRows(teamRows);
      setShiftProfiles(normalizedProfiles);
      setInviteRows(
        invites.filter((invite) => {
          const expired = new Date(invite.expiresAt).getTime() <= Date.now();
          const used = invite.usedCount >= invite.maxUses;
          const revoked = Boolean(invite.revokedAt);
          return !expired && !used && !revoked;
        }),
      );
      setRoleDrafts({});
      setProfileDrafts({});
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không tải được dữ liệu nhân sự.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManageProfiles, rows.length]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load(true);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  const roleStats = useMemo(() => {
    const stats = new Map<AppRole, number>();
    rows.forEach((row) => stats.set(row.role, (stats.get(row.role) ?? 0) + 1));
    return stats;
  }, [rows]);
  const shiftProfilesByUserId = useMemo(
    () => new Map(shiftProfiles.map((profile) => [profile.userId, profile])),
    [shiftProfiles],
  );

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort(compareTeamMembers);

    const keyword = search.trim().toLowerCase();
    if (!keyword) return sorted;
    return sorted.filter((row) =>
      `${row.displayName} ${row.email ?? ""} ${row.phone ?? ""} ${row.userId} ${row.role}`.toLowerCase().includes(keyword),
    );
  }, [rows, search]);

  function getBaseShiftProfile(member: TeamMemberRow) {
    if (!isShiftProfileEditableRole(member.role)) return null;
    return shiftProfilesByUserId.get(member.userId) ?? createEmptyStaffShiftProfile(member.userId, member.role);
  }

  function getWorkingShiftProfile(member: TeamMemberRow) {
    const baseProfile = getBaseShiftProfile(member);
    if (!baseProfile) return null;
    return profileDrafts[member.userId] ?? baseProfile;
  }

  function updateShiftProfileDraft(userId: string, nextProfile: StaffShiftProfileRecord) {
    setProfileDrafts((current) => ({
      ...current,
      [userId]: nextProfile,
    }));
  }

  function toggleSkill(member: TeamMemberRow, skill: ServiceSkill) {
    const currentProfile = getWorkingShiftProfile(member);
    if (!currentProfile) return;
    const hasSkill = currentProfile.skills.includes(skill);
    updateShiftProfileDraft(member.userId, {
      ...currentProfile,
      skills: hasSkill
        ? currentProfile.skills.filter((item) => item !== skill)
        : [...currentProfile.skills, skill].sort(),
    });
  }

  function toggleAvailability(member: TeamMemberRow, weekday: number, shiftType: ShiftType) {
    const currentProfile = getWorkingShiftProfile(member);
    if (!currentProfile) return;

    const currentRules = currentProfile.availability.filter((rule) => rule.weekday !== weekday);
    const existingRule = currentProfile.availability.find((rule) => rule.weekday === weekday);
    const currentShiftTypes = existingRule?.shiftTypes ?? [];
    const hasShiftType = currentShiftTypes.includes(shiftType);

    let nextShiftTypes: ShiftType[];
    if (shiftType === "FULL_DAY") {
      nextShiftTypes = hasShiftType ? [] : ["FULL_DAY"];
    } else if (hasShiftType) {
      nextShiftTypes = currentShiftTypes.filter((item) => item !== shiftType);
    } else {
      nextShiftTypes = [...currentShiftTypes.filter((item) => item !== "FULL_DAY"), shiftType];
    }

    const normalizedShiftTypes = normalizeShiftTypes(nextShiftTypes);
    updateShiftProfileDraft(member.userId, {
      ...currentProfile,
      availability:
        normalizedShiftTypes.length > 0
          ? [...currentRules, { weekday, shiftTypes: normalizedShiftTypes }].sort((left, right) => left.weekday - right.weekday)
          : currentRules.sort((left, right) => left.weekday - right.weekday),
    });
  }

  async function saveShiftProfile(member: TeamMemberRow) {
    if (!mobileSupabase || !canManageProfiles || profileSchemaMissing || profileBusyUserId) return;
    const nextProfile = getWorkingShiftProfile(member);
    if (!nextProfile) return;

    try {
      setProfileBusyUserId(member.userId);
      setError(null);
      const saved = await saveStaffShiftProfile(nextProfile);
      setShiftProfiles((current) => replaceShiftProfile(current, saved));
      setProfileDrafts((current) => {
        const next = { ...current };
        delete next[member.userId];
        return next;
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Cập nhật kỹ năng và khung giờ thất bại.");
    } finally {
      setProfileBusyUserId(null);
    }
  }

  async function createInvite() {
    if (!mobileSupabase || inviteBusy) return;
    try {
      setInviteBusy(true);
      setError(null);
      const invite = await generateTeamInviteCodeForMobile(mobileSupabase, inviteRole);
      setInviteRows((prev) => [invite, ...prev].slice(0, 20));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Tạo mã mời thất bại.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!mobileSupabase) return;
    try {
      setError(null);
      await revokeTeamInviteCodeForMobile(mobileSupabase, inviteId);
      await load(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Thu hồi mã mời thất bại.");
    }
  }

  async function saveName(userId: string) {
    if (!mobileSupabase || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      await updateTeamMemberDisplayNameForMobile(mobileSupabase, {
        userId,
        displayName: editingName.trim() || "User",
      });
      setEditingUserId(null);
      await load(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Cập nhật tên thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveRole(rowId: string) {
    if (!mobileSupabase || submitting) return;
    const current = rows.find((row) => row.id === rowId);
    const nextRole = roleDrafts[rowId];
    if (!current || !nextRole || current.role === nextRole) return;

    try {
      setSubmitting(true);
      setError(null);
      await updateTeamMemberRoleForMobile(mobileSupabase, { id: rowId, role: nextRole });
      setRoleDrafts((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
      await load(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Cập nhật vai trò thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  const latestInvite = inviteRows[0] ?? null;

  if (!isHydrated || !allowed) {
    return <View style={manageStyles.loadingState} />;
  }

  return (
    <ManageScreenShell
      title="Nhân sự"
      subtitle="Quản lý vai trò, mã mời và danh sách nhân sự nội bộ."
      currentKey="team"
      group="setup"
      showBackButton={false}
      hiddenTabKeys={["content"]}
    >
      <View style={styles.summaryCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeadingWrap}>
            <Feather name="bar-chart-2" size={16} color={palette.sub} />
            <Text style={styles.sectionTitle}>Tổng quan</Text>
          </View>
        </View>
        <View style={styles.metricGrid}>
          <MetricCard icon="users" iconColor={palette.red} iconSoft={palette.redSoft} label="Tổng quan nhân sự" value={rows.length} />
          <MetricCard icon="shield" iconColor={palette.success} iconSoft={palette.successSoft} label="Quản lý" value={roleStats.get("MANAGER") ?? 0} />
          <MetricCard icon="user" iconColor={palette.warning} iconSoft={palette.warningSoft} label="Lễ tân" value={roleStats.get("RECEPTION") ?? 0} />
          <MetricCard icon="credit-card" iconColor={palette.info} iconSoft={palette.infoSoft} label="Kế toán" value={roleStats.get("ACCOUNTANT") ?? 0} />
          <MetricCard icon="scissors" iconColor="#5B9BD5" iconSoft="#EEF8FF" label="Kỹ thuật viên" value={roleStats.get("TECH") ?? 0} />
        </View>
      </View>

      <View style={styles.createCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeadingWrap}>
            <Feather name="plus-circle" size={16} color={palette.accent} />
            <Text style={styles.sectionTitle}>Thêm nhân sự mới</Text>
          </View>
          {(refreshing || loading) ? <ActivityIndicator size="small" color={palette.accent} /> : <Text style={styles.ownerOnlyText}>Chỉ BOSS mới quản lý</Text>}
        </View>

        <Text style={styles.fieldLabel}>Vai trò</Text>
        <View style={styles.roleChipRow}>
          {roleOptions.map((role) => (
            <RoleChip
              key={role}
              active={inviteRole === role}
              label={getRoleLabel(role)}
              onPress={() => setInviteRole(role as InviteCodeRole)}
            />
          ))}
        </View>

        <Pressable disabled={inviteBusy} style={[styles.primaryButton, inviteBusy ? styles.primaryButtonDisabled : null]} onPress={() => void createInvite()}>
          <Feather name="plus" size={15} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{inviteBusy ? "Đang tạo..." : "Tạo mới"}</Text>
        </Pressable>

        {latestInvite ? (
          <View style={styles.inviteInfoCard}>
            <Text style={styles.inviteCodeLabel}>{getRoleLabel(latestInvite.allowedRole)}</Text>
            <Text style={styles.inviteCodeValue}>{latestInvite.code}</Text>
            <Text style={styles.inviteMeta}>Hết hạn: {new Date(latestInvite.expiresAt).toLocaleString("vi-VN")}</Text>
            <Pressable style={styles.revokeButton} onPress={() => void revokeInvite(latestInvite.id)}>
              <Text style={styles.revokeButtonText}>Thu hồi mã mới nhất</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyInviteNote}>
            <Feather name="sun" size={15} color="#A7988A" />
            <View style={styles.emptyInviteCopy}>
              <Text style={styles.emptyInviteTitle}>Chưa có nhân sự nào gần đây</Text>
              <Text style={styles.emptyInviteSubtitle}>Tạo nhân sự mới để thêm nhân sự vào hệ thống.</Text>
            </View>
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Feather name="alert-circle" size={16} color={palette.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {profileSchemaMissing ? (
        <View style={styles.errorCard}>
          <Feather name="alert-triangle" size={16} color={palette.warning} />
          <Text style={[styles.errorText, { color: palette.warning }]}>
            Thiếu bảng `staff_shift_profiles`, hiện chưa thể cấu hình kỹ năng và khung giờ làm cho nhân sự.
          </Text>
        </View>
      ) : null}

      <View style={styles.listCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeadingWrap}>
            <Feather name="users" size={16} color={palette.sub} />
            <Text style={styles.sectionTitle}>Danh sách nhân sự</Text>
          </View>
          <Text style={styles.countPill}>{filteredRows.length} nhân sự</Text>
        </View>

        <Input value={search} onChangeText={setSearch} placeholder="Tìm theo tên, user hoặc vai trò" />

        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.emptyText}>Đang tải nhân sự...</Text>
          </View>
        ) : filteredRows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {rows.length === 0 ? "Chưa có dữ liệu nhân sự." : "Không có nhân sự khớp bộ lọc hiện tại."}
            </Text>
          </View>
        ) : (
          <View style={styles.memberList}>
            {filteredRows.map((member) => {
              const colors = avatarColor(member.role);
              const isEditingName = editingUserId === member.userId;
              const roleDraft = roleDrafts[member.id] ?? member.role;
              const roleChanged = roleDraft !== member.role;
              const shiftProfile = getWorkingShiftProfile(member);
              const baseShiftProfile = getBaseShiftProfile(member);
              const canEditShiftProfile =
                canManageProfiles && !profileSchemaMissing && !isSpecialTeamRole(member.role) && !!shiftProfile && !!baseShiftProfile;
              const shiftProfileChanged =
                canEditShiftProfile &&
                buildShiftProfileSignature(shiftProfile) !== buildShiftProfileSignature(baseShiftProfile);

              return (
                <View key={member.id} style={styles.memberCard}>
                  <View style={styles.memberTopRow}>
                    <View style={styles.memberIdentity}>
                      <View style={[styles.avatar, { backgroundColor: colors.soft }]}>
                        <Feather name={roleIcon(member.role)} size={16} color={colors.text} />
                      </View>
                      <View style={styles.memberCopy}>
                        {isEditingName ? (
                          <Input value={editingName} onChangeText={setEditingName} placeholder="Tên nhân sự" style={styles.editNameInput} />
                        ) : (
                          <Text style={styles.memberName}>{member.displayName}</Text>
                        )}
                        <Text style={styles.memberEmail}>{member.email || member.userId}</Text>
                        <View style={styles.memberMetaRow}>
                          <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>{getRoleLabel(member.role)}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {isEditingName ? (
                      <View style={styles.inlineActionRow}>
                        <Pressable style={styles.iconButton} onPress={() => setEditingUserId(null)}>
                          <Feather name="x" size={15} color={palette.sub} />
                        </Pressable>
                        <Pressable style={[styles.primaryInlineButton, submitting ? styles.primaryInlineButtonDisabled : null]} disabled={submitting} onPress={() => void saveName(member.userId)}>
                          <Feather name={submitting ? "loader" : "check"} size={15} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable style={styles.iconButton} onPress={() => { setEditingUserId(member.userId); setEditingName(member.displayName); }}>
                        <Feather name="edit-3" size={13} color={palette.accent} />
                      </Pressable>
                    )}
                  </View>

                  {!isSpecialTeamRole(member.role) ? (
                    <View style={styles.roleEditorRow}>
                      <View style={styles.roleDraftRow}>
                        {roleOptions.map((role) => (
                          <RoleChip
                            key={`${member.id}-${role}`}
                            active={roleDraft === role}
                            label={getRoleLabel(role)}
                            onPress={() => setRoleDrafts((prev) => ({ ...prev, [member.id]: role }))}
                          />
                        ))}
                      </View>
                      {roleChanged ? (
                        <View style={styles.inlineActionRow}>
                          <Pressable
                            style={styles.iconButton}
                            onPress={() => setRoleDrafts((prev) => {
                              const next = { ...prev };
                              delete next[member.id];
                              return next;
                            })}
                          >
                            <Feather name="x" size={15} color={palette.sub} />
                          </Pressable>
                          <Pressable style={[styles.primaryInlineButton, submitting ? styles.primaryInlineButtonDisabled : null]} disabled={submitting} onPress={() => void saveRole(member.id)}>
                            <Feather name={submitting ? "loader" : "check"} size={15} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {canEditShiftProfile ? (
                    <View style={styles.profileEditorCard}>
                      <Text style={styles.editorSectionLabel}>Kỹ năng</Text>
                      <View style={styles.roleDraftRow}>
                        {SERVICE_SKILL_OPTIONS.map((skill) => (
                          <RoleChip
                            key={`${member.id}-${skill}`}
                            active={shiftProfile.skills.includes(skill)}
                            label={skill}
                            onPress={() => toggleSkill(member, skill)}
                          />
                        ))}
                      </View>

                      <Text style={styles.editorSectionLabel}>Khung giờ có thể đi làm</Text>
                      <View style={styles.availabilityList}>
                        {weekdayOptions.map((weekday) => {
                          const activeRule = shiftProfile.availability.find((rule) => rule.weekday === weekday.value);
                          return (
                            <View key={`${member.id}-${weekday.value}`} style={styles.availabilityCard}>
                              <Text style={styles.availabilityLabel}>{weekday.label}</Text>
                              <View style={styles.roleDraftRow}>
                                {shiftTypeOptions.map((option) => (
                                  <RoleChip
                                    key={`${member.id}-${weekday.value}-${option.value}`}
                                    active={activeRule?.shiftTypes.includes(option.value) ?? false}
                                    label={option.label}
                                    onPress={() => toggleAvailability(member, weekday.value, option.value)}
                                  />
                                ))}
                              </View>
                            </View>
                          );
                        })}
                      </View>

                      {shiftProfileChanged ? (
                        <View style={styles.inlineActionRow}>
                          <Pressable
                            style={styles.iconButton}
                            onPress={() =>
                              setProfileDrafts((current) => {
                                const next = { ...current };
                                delete next[member.userId];
                                return next;
                              })
                            }
                          >
                            <Feather name="x" size={15} color={palette.sub} />
                          </Pressable>
                          <Pressable
                            style={[styles.primaryInlineButton, profileBusyUserId === member.userId ? styles.primaryInlineButtonDisabled : null]}
                            disabled={profileBusyUserId === member.userId}
                            onPress={() => void saveShiftProfile(member)}
                          >
                            <Feather name={profileBusyUserId === member.userId ? "loader" : "check"} size={15} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  ...manageStyles,
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: palette.text,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    width: "30.8%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FCFAF8",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 21,
    fontWeight: "800",
    color: palette.text,
  },
  createCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  ownerOnlyText: {
    fontSize: 11,
    lineHeight: 13,
    color: palette.sub,
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: palette.sub,
  },
  roleChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleChip: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  roleChipActive: {
    backgroundColor: palette.accentSoft,
    borderColor: "#D9BA9A",
  },
  roleChipText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.sub,
  },
  roleChipTextActive: {
    color: palette.accent,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  inviteInfoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  inviteCodeLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    color: palette.sub,
  },
  inviteCodeValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
  },
  inviteMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.sub,
  },
  revokeButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  revokeButtonText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.sub,
  },
  emptyInviteNote: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  emptyInviteCopy: {
    flex: 1,
    gap: 2,
  },
  emptyInviteTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    color: palette.text,
  },
  emptyInviteSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.sub,
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1D5CA",
    backgroundColor: palette.dangerSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: palette.danger,
  },
  listCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  countPill: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    color: palette.sub,
  },
  input: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 18,
    color: palette.text,
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: "dashed",
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 16,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.sub,
    textAlign: "center",
  },
  memberList: {
    gap: 12,
  },
  memberCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  memberTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  memberIdentity: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  memberCopy: {
    flex: 1,
    gap: 3,
  },
  memberName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: palette.text,
  },
  editNameInput: {
    minHeight: 40,
    paddingVertical: 10,
  },
  memberEmail: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.sub,
  },
  memberMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  roleBadge: {
    minHeight: 20,
    borderRadius: 10,
    backgroundColor: palette.redSoft,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  roleBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    color: palette.red,
  },
  inlineActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryButtonText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.sub,
  },
  editButtonText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.accent,
  },
  primaryInlineButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryInlineButtonDisabled: {
    opacity: 0.65,
  },
  primaryInlineButtonText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  roleEditorRow: {
    gap: 10,
  },
  profileEditorCard: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12,
  },
  editorSectionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: palette.text,
  },
  availabilityList: {
    gap: 10,
  },
  availabilityCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  availabilityLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    color: palette.sub,
  },
  roleDraftRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
