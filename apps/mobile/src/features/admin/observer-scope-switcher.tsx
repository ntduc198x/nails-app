import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAdminViewContext, ObserverScopeInput } from "@nails/shared";

const palette = {
  border: "#EADFD3",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F6EBDD",
  card: "#FFFFFF",
};

export function AdminObserverScopeSwitcher({
  viewContext,
  loading = false,
  onSelectScope,
}: {
  viewContext: MobileAdminViewContext | null;
  loading?: boolean;
  onSelectScope: (scope: ObserverScopeInput) => void | Promise<void>;
}) {
  if (!viewContext) {
    return null;
  }

  if (!viewContext.canViewOrgWide) {
    return null;
  }

  const isOrgMode = viewContext.observerScope.mode === "org";
  const sortedBranches = [
    ...viewContext.branches.filter((branch) => branch.id === viewContext.workingBranchId),
    ...viewContext.branches.filter((branch) => branch.id !== viewContext.workingBranchId),
  ];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.title}>Phạm vi quan sát</Text>
          <Text style={styles.subtitle}>
            {viewContext.canViewOrgWide
              ? "OWNER có thể xem toàn công ty hoặc chốt vào một chi nhánh mà không đổi context ghi dữ liệu."
              : "Tài khoản này chỉ xem được chi nhánh đang phụ trách."}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{viewContext.scopeLabel}</Text>
        </View>
      </View>

      <View style={styles.pillRow}>
        {viewContext.canViewOrgWide ? (
          <Pressable
            style={[styles.pill, isOrgMode ? styles.pillActive : null, loading ? styles.pillDisabled : null]}
            disabled={loading}
            onPress={() => void onSelectScope({ mode: "org" })}
          >
            <Text style={[styles.pillText, isOrgMode ? styles.pillTextActive : null]}>Toàn công ty</Text>
          </Pressable>
        ) : null}

        {sortedBranches.map((branch) => {
          const active = viewContext.observerScope.mode === "branch" && viewContext.observerScope.branchId === branch.id;
          const label = branch.id === viewContext.workingBranchId ? "Chi nhánh chính" : branch.name;
          return (
            <Pressable
              key={branch.id}
              style={[styles.pill, active ? styles.pillActive : null, loading ? styles.pillDisabled : null]}
              disabled={loading}
              onPress={() => void onSelectScope({ mode: "branch", branchId: branch.id })}
            >
              <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.footnote}>Chi nhánh làm việc thật của tài khoản vẫn dùng cho các thao tác tạo, sửa và thanh toán.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    backgroundColor: palette.card,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: palette.text,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.sub,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.accent,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#FFF9F3",
  },
  pillActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  pillDisabled: {
    opacity: 0.65,
  },
  pillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: palette.text,
  },
  pillTextActive: {
    color: palette.accent,
  },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    color: palette.sub,
  },
});
