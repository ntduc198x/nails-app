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
  type TeamInviteCodeRow,
  type TeamMemberRow,
  updateTeamMemberDisplayNameForMobile,
  updateTeamMemberRoleForMobile,
} from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";
import { ManageScreenShell, manageStyles } from "@/src/features/admin/manage-ui";

const roleOptions: AppRole[] = ["MANAGER", "RECEPTION", "ACCOUNTANT", "TECH"];

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

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
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
  const [rows, setRows] = useState<TeamMemberRow[]>([]);
  const [inviteRows, setInviteRows] = useState<TeamInviteCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteCodeRole>("TECH");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AppRole>>({});

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

      const [teamRows, invites] = await Promise.all([
        listTeamMembersForMobile(mobileSupabase),
        listTeamInviteCodesForMobile(mobileSupabase),
      ]);

      setRows(teamRows);
      setInviteRows(
        invites.filter((invite) => {
          const expired = new Date(invite.expiresAt).getTime() <= Date.now();
          const used = invite.usedCount >= invite.maxUses;
          const revoked = Boolean(invite.revokedAt);
          return !expired && !used && !revoked;
        }),
      );
      setRoleDrafts({});
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không tải được dữ liệu nhân sự.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rows.length]);

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

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      if (a.role === "OWNER" && b.role !== "OWNER") return -1;
      if (a.role !== "OWNER" && b.role === "OWNER") return 1;
      return a.displayName.localeCompare(b.displayName, "vi");
    });

    const keyword = search.trim().toLowerCase();
    if (!keyword) return sorted;
    return sorted.filter((row) =>
      `${row.displayName} ${row.email ?? ""} ${row.phone ?? ""} ${row.userId} ${row.role}`.toLowerCase().includes(keyword),
    );
  }, [rows, search]);

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

  return (
    <ManageScreenShell
      title="Nhân sự"
      subtitle="Quản lý vai trò, mã mời và danh sách nhân sự nội bộ."
      currentKey="team"
      group="setup"
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

                  {member.role !== "OWNER" ? (
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
  roleDraftRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
