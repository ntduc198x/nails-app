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
  createResourceForMobile,
  listResourcesForMobile,
  type MobileAdminResource,
  type MobileAdminResourceType,
  updateResourceForMobile,
} from "@nails/shared";
import { useAdminStrings } from "@/src/features/admin/strings";
import { ManageScreenShell, manageStyles, useManageRouteAccess } from "@/src/features/admin/manage-ui";
import { useAdminObserverScope } from "@/src/hooks/use-admin-observer-scope";
import { useAdminKeyboardFieldFocus } from "@/src/features/admin/ui";
import { mobileSupabase } from "@/src/lib/supabase";

const palette = {
  border: "#EADFD3",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F3E7DA",
  success: "#2B9E5F",
  successSoft: "#E8F6ED",
  info: "#7A69E8",
  infoSoft: "#F2EEFF",
  warning: "#E79937",
  warningSoft: "#FFF1E0",
  mutedSoft: "#F7F3EE",
  activeSoft: "#EAF7EE",
  activeText: "#2B9E5F",
  inactiveSoft: "#F3EEE8",
  inactiveText: "#8B7A6A",
};

function typeLabel(strings: ReturnType<typeof useAdminStrings>, type: MobileAdminResourceType) {
  if (type === "CHAIR") return strings.manageResourcesTypeChair;
  if (type === "TABLE") return strings.manageResourcesTypeTable;
  return strings.manageResourcesTypeRoom;
}

function typeIcon(type: MobileAdminResourceType): keyof typeof Feather.glyphMap {
  if (type === "CHAIR") return "coffee";
  if (type === "TABLE") return "grid";
  return "home";
}

function typeColor(type: MobileAdminResourceType) {
  if (type === "CHAIR") return { soft: palette.infoSoft, text: palette.info };
  if (type === "TABLE") return { soft: palette.warningSoft, text: palette.warning };
  return { soft: palette.successSoft, text: palette.success };
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

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.filterChip, active ? styles.filterChipActive : null]} onPress={onPress}>
      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{label}</Text>
    </Pressable>
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

function ResourceRowCard({
  strings,
  editing,
  editActive,
  editName,
  editType,
  item,
  onCancel,
  onChangeActive,
  onChangeName,
  onChangeType,
  onEdit,
  onSave,
  saving,
}: {
  strings: ReturnType<typeof useAdminStrings>;
  editing: boolean;
  editActive: boolean;
  editName: string;
  editType: MobileAdminResourceType;
  item: MobileAdminResource;
  onCancel: () => void;
  onChangeActive: (next: boolean) => void;
  onChangeName: (value: string) => void;
  onChangeType: (value: MobileAdminResourceType) => void;
  onEdit: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const currentType = editing ? editType : item.type;
  const currentActive = editing ? editActive : item.active;
  const colors = typeColor(currentType);

  return (
    <View style={styles.resourceCard}>
      <View style={styles.resourceTopRow}>
        <View style={styles.resourceIdentity}>
          <View style={[styles.resourceIcon, { backgroundColor: colors.soft }]}>
            <Feather name={typeIcon(currentType)} size={16} color={colors.text} />
          </View>
          <View style={styles.resourceCopy}>
            {editing ? (
              <Input
                value={editName}
                onChangeText={onChangeName}
                placeholder={strings.manageResourcesNamePlaceholder}
                style={styles.editNameInput}
              />
            ) : (
              <Text style={styles.resourceName}>{item.name}</Text>
            )}
            <View style={styles.badgeRow}>
              <View style={[styles.typeBadge, { backgroundColor: colors.soft }]}>
                <Text style={[styles.typeBadgeText, { color: colors.text }]}>{typeLabel(strings, currentType)}</Text>
              </View>
              <View style={[styles.stateBadge, currentActive ? styles.stateBadgeActive : styles.stateBadgeInactive]}>
                <Text style={[styles.stateBadgeText, currentActive ? styles.stateBadgeActiveText : styles.stateBadgeInactiveText]}>
                  {currentActive ? strings.manageResourcesStateActive : strings.manageResourcesStateInactive}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {editing ? (
          <View style={styles.actionRow}>
            <Pressable style={styles.iconButton} onPress={onCancel}>
              <Feather name="x" size={15} color={palette.sub} />
            </Pressable>
            <Pressable style={[styles.primaryInlineButton, saving ? styles.primaryInlineButtonDisabled : null]} disabled={saving} onPress={onSave}>
              <Feather name={saving ? "loader" : "check"} size={15} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.iconButton} onPress={onEdit}>
            <Feather name="edit-3" size={13} color={palette.accent} />
          </Pressable>
        )}
      </View>

      {editing ? (
        <View style={styles.editPanel}>
          <View style={styles.typeSelectRow}>
            {(["CHAIR", "TABLE", "ROOM"] as MobileAdminResourceType[]).map((option) => {
              const optionColors = typeColor(option);
              const active = editType === option;
              return (
                <Pressable
                  key={option}
                  style={[
                    styles.typeSelectChip,
                    { backgroundColor: active ? optionColors.soft : "#FFFFFF", borderColor: active ? optionColors.text : palette.border },
                  ]}
                  onPress={() => onChangeType(option)}
                >
                  <Text style={[styles.typeSelectChipText, { color: active ? optionColors.text : palette.sub }]}>{typeLabel(strings, option)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.statusToggle, editActive ? styles.statusToggleActive : styles.statusToggleInactive]}
            onPress={() => onChangeActive(!editActive)}
          >
            <Feather name={editActive ? "check-circle" : "slash"} size={15} color={editActive ? palette.success : palette.sub} />
            <Text style={[styles.statusToggleText, { color: editActive ? palette.success : palette.sub }]}>
              {editActive ? strings.manageResourcesStateActiveLong : strings.manageResourcesStateInactiveLong}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function AdminManageResourcesScreen() {
  const strings = useAdminStrings();
  const { isHydrated, allowed } = useManageRouteAccess(["OWNER", "PARTNER"]);
  const observer = useAdminObserverScope();
  const [rows, setRows] = useState<MobileAdminResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<MobileAdminResourceType>("CHAIR");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<MobileAdminResourceType>("CHAIR");
  const [editActive, setEditActive] = useState(true);
  const [filterType, setFilterType] = useState<"ALL" | MobileAdminResourceType>("ALL");
  const observerReadOnly =
    observer.viewContext?.observerScope.mode === "org" ||
    (observer.viewContext?.observerScope.mode === "branch"
      && observer.viewContext.observerScope.branchId !== observer.viewContext.workingBranchId);

  const load = useCallback(async (force = false) => {
    if (!mobileSupabase) {
      setError(strings.manageResourcesMissingSupabase);
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
      setRows(await listResourcesForMobile(mobileSupabase, {
        activeOnly: false,
        observerScope: observer.observerScope,
      }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : strings.manageResourcesLoadFailed);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [observer.observerScope, rows.length, strings.manageResourcesLoadFailed, strings.manageResourcesMissingSupabase]);

  useEffect(() => {
    if (!observer.isReady) return;
    const timeoutId = setTimeout(() => {
      void load(true);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [load, observer.isReady]);

  const totalCount = rows.length;
  const activeCount = useMemo(() => rows.filter((item) => item.active).length, [rows]);
  const availableChairCount = useMemo(
    () => rows.filter((item) => item.type === "CHAIR" && item.active).length,
    [rows],
  );

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesKeyword = !keyword || `${item.name} ${item.type}`.toLowerCase().includes(keyword);
      const matchesType = filterType === "ALL" || item.type === filterType;
      return matchesKeyword && matchesType;
    });
  }, [filterType, rows, search]);

  async function submitCreate() {
    if (!mobileSupabase || submitting) return;
    if (observerReadOnly) {
      setError(strings.manageResourcesObserverCreateBlocked);
      return;
    }
    if (!name.trim()) {
      setError(strings.manageResourcesNameRequired);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createResourceForMobile(mobileSupabase, { name: name.trim(), type });
      setName("");
      setType("CHAIR");
      await load(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : strings.manageResourcesCreateFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item: MobileAdminResource) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditType(item.type);
    setEditActive(item.active);
  }

  async function saveEdit() {
    if (!mobileSupabase || !editingId || submitting) return;
    if (observerReadOnly) {
      setError(strings.manageResourcesObserverEditBlocked);
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await updateResourceForMobile(mobileSupabase, {
        id: editingId,
        name: editName.trim(),
        type: editType,
        active: editActive,
      });
      setEditingId(null);
      await load(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : strings.manageResourcesUpdateFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isHydrated || !allowed) {
    return <View style={manageStyles.loadingState} />;
  }

  return (
    <ManageScreenShell
      title={strings.manageResourcesTitle}
      subtitle={strings.manageResourcesSubtitle}
      currentKey="resources"
      group="setup"
      showBackButton={false}
      hiddenTabKeys={["content"]}
      observerReadOnly={observerReadOnly}
      observerReadOnlyMessage={strings.manageResourcesObserverReadonlyMessage}
    >
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={styles.infoIconWrap}>
            <Feather name="coffee" size={18} color={palette.accent} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>{strings.manageResourcesTitle}</Text>
            <Text style={styles.infoSubtitle}>{strings.manageResourcesInfoSubtitle}</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeadingWrap}>
            <Feather name="bar-chart-2" size={16} color={palette.sub} />
            <Text style={styles.sectionTitle}>{strings.manageResourcesOverviewTitle}</Text>
          </View>
          <Pressable style={styles.headerPill} onPress={() => {}}>
            <Feather name="list" size={14} color={palette.sub} />
            <Text style={styles.headerPillText}>{strings.manageResourcesOverviewListPill}</Text>
          </Pressable>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard icon="grid" iconColor={palette.info} iconSoft={palette.infoSoft} label={strings.manageResourcesMetricTotal} value={totalCount} />
          <MetricCard icon="check-circle" iconColor={palette.success} iconSoft={palette.successSoft} label={strings.manageResourcesMetricActive} value={activeCount} />
          <MetricCard icon="coffee" iconColor={palette.warning} iconSoft={palette.warningSoft} label={strings.manageResourcesMetricAvailableChairs} value={availableChairCount} />
        </View>
      </View>

      <View style={styles.formCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeadingWrap}>
            <Feather name="plus-circle" size={16} color={palette.accent} />
            <Text style={styles.sectionTitle}>{strings.manageResourcesAddTitle}</Text>
          </View>
          {(refreshing || loading) ? <ActivityIndicator size="small" color={palette.accent} /> : <Text style={styles.alwaysText}>{strings.manageResourcesFormAlwaysVisible}</Text>}
        </View>

        <View style={styles.typeSelectRow}>
          {(["CHAIR", "TABLE", "ROOM"] as MobileAdminResourceType[]).map((option) => {
            const colors = typeColor(option);
            const active = type === option;
            return (
              <Pressable
                key={option}
                style={[
                  styles.typeSelectChip,
                  { backgroundColor: active ? colors.soft : "#FFFFFF", borderColor: active ? colors.text : palette.border },
                ]}
                onPress={() => setType(option)}
              >
                <Text style={[styles.typeSelectChipText, { color: active ? colors.text : palette.sub }]}>{typeLabel(strings, option)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          value={name}
          onChangeText={setName}
          placeholder={
            type === "CHAIR"
              ? strings.manageResourcesPlaceholderChair
              : type === "TABLE"
                ? strings.manageResourcesPlaceholderTable
                : strings.manageResourcesPlaceholderRoom
          }
        />

        <Pressable disabled={submitting} style={[styles.primaryButton, submitting ? styles.primaryButtonDisabled : null]} onPress={() => void submitCreate()}>
          <Feather name="plus" size={15} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{submitting ? strings.manageResourcesSubmitting : strings.manageResourcesAddButton}</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Feather name="alert-circle" size={16} color="#C66043" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.listCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeadingWrap}>
            <Feather name="list" size={16} color={palette.sub} />
            <View>
              <Text style={styles.sectionTitle}>{strings.manageResourcesListTitle}</Text>
              <Text style={styles.sectionHint}>{strings.manageResourcesListHint}</Text>
            </View>
          </View>
        </View>

        <Input value={search} onChangeText={setSearch} placeholder={strings.manageResourcesSearchPlaceholder} />

        <View style={styles.filterRow}>
          <FilterChip active={filterType === "ALL"} label={strings.manageResourcesFilterAll} onPress={() => setFilterType("ALL")} />
          <FilterChip active={filterType === "CHAIR"} label={strings.manageResourcesTypeChair} onPress={() => setFilterType("CHAIR")} />
          <FilterChip active={filterType === "TABLE"} label={strings.manageResourcesTypeTable} onPress={() => setFilterType("TABLE")} />
          <FilterChip active={filterType === "ROOM"} label={strings.manageResourcesTypeRoom} onPress={() => setFilterType("ROOM")} />
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.emptyText}>{strings.manageResourcesLoading}</Text>
          </View>
        ) : filteredRows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {rows.length === 0 ? strings.manageResourcesEmpty : strings.manageResourcesEmptyFiltered}
            </Text>
          </View>
        ) : (
          <View style={styles.listStack}>
            {filteredRows.map((item) => (
              <ResourceRowCard
                key={item.id}
                strings={strings}
                editing={editingId === item.id}
                editActive={editActive}
                editName={editName}
                editType={editType}
                item={item}
                onCancel={() => setEditingId(null)}
                onChangeActive={setEditActive}
                onChangeName={setEditName}
                onChangeType={setEditType}
                onEdit={() => startEdit(item)}
                onSave={() => void saveEdit()}
                saving={submitting}
              />
            ))}
          </View>
        )}
      </View>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  ...manageStyles,
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCopy: {
    flex: 1,
    gap: 3,
  },
  infoTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    color: palette.text,
  },
  infoSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.sub,
  },
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
  sectionHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: palette.sub,
  },
  headerPill: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerPillText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    color: palette.sub,
  },
  metricGrid: {
    flexDirection: "row",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#FCFAF8",
    borderWidth: 1,
    borderColor: palette.border,
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
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
  },
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  alwaysText: {
    fontSize: 11,
    lineHeight: 13,
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
  typeSelectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeSelectChip: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  typeSelectChipText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
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
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1D5CA",
    backgroundColor: "#FBECE7",
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
    color: "#C66043",
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
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: palette.accentSoft,
    borderColor: "#D9BA9A",
  },
  filterChipText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.sub,
  },
  filterChipTextActive: {
    color: palette.accent,
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
  listStack: {
    gap: 12,
  },
  resourceCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  resourceTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  resourceIdentity: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  resourceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  resourceCopy: {
    flex: 1,
    gap: 4,
  },
  resourceName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: palette.text,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  typeBadge: {
    minHeight: 20,
    borderRadius: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
  },
  stateBadge: {
    minHeight: 20,
    borderRadius: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stateBadgeActive: {
    backgroundColor: palette.activeSoft,
  },
  stateBadgeActiveText: {
    color: palette.activeText,
  },
  stateBadgeInactive: {
    backgroundColor: palette.inactiveSoft,
  },
  stateBadgeInactiveText: {
    color: palette.inactiveText,
  },
  stateBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
  },
  actionRow: {
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
  editPanel: {
    borderRadius: 16,
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  editNameInput: {
    minHeight: 40,
    paddingVertical: 10,
  },
  statusToggle: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  statusToggleActive: {
    backgroundColor: palette.successSoft,
    borderColor: "#BFE4CE",
  },
  statusToggleInactive: {
    backgroundColor: "#FFFFFF",
    borderColor: palette.border,
  },
  statusToggleText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
});
