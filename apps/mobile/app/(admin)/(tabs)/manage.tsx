import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { filterManageScreenItemsForRole, MANAGE_SCREEN_ITEMS } from "@/src/features/admin/manage";
import { ManageHubCard, useManageOwnerGuard } from "@/src/features/admin/manage-ui";
import { getAdminNavHref, type AdminNavTarget } from "@/src/features/admin/navigation";
import { AdminBottomNavDock, AdminHeaderActions, AdminTopSafeArea, ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE, ADMIN_CONTENT_TOP_GAP } from "@/src/features/admin/ui";

const palette = {
  bg: "#FCFAF8",
  card: "#FFFFFF",
  border: "#EADFD3",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F6EBDD",
};

export default function AdminManageHubScreen() {
  const router = useRouter();
  const { isHydrated, allowed, role } = useManageOwnerGuard();

  if (!isHydrated || !allowed) {
    return <View style={styles.screen} />;
  }

  const visibleItems = filterManageScreenItemsForRole(role, MANAGE_SCREEN_ITEMS);
  const insightItems = visibleItems.filter((item) => item.group === "insights");
  const setupItems = visibleItems.filter((item) => item.group === "setup");

  return (
    <View style={styles.screen}>
      <AdminTopSafeArea style={styles.topChrome}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <View style={styles.heroBadge}>
              <Feather name="shield" size={14} color={palette.accent} />
              <Text style={styles.heroBadgeText}>Admin only</Text>
            </View>
            <Text style={styles.headerTitle}>Quản lý</Text>
          </View>
          <AdminHeaderActions onSettingsPress={() => void router.push("/settings")} />
        </View>
      </AdminTopSafeArea>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thiết lập vận hành</Text>
            <Text style={styles.sectionSubtitle}>Nhóm màn hình Dịch vụ, Tài nguyên và Nhân sự cho admin mở rộng.</Text>
            <View style={styles.cardColumn}>
              {setupItems.map((item) => (
                <ManageHubCard key={item.key} item={item} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Khách hàng và báo cáo</Text>
            <Text style={styles.sectionSubtitle}>Nhóm màn hình CRM khách, Báo cáo, Sổ thuế và Quản lý ca.</Text>
            <View style={styles.cardColumn}>
              {insightItems.map((item) => (
                <ManageHubCard key={item.key} item={item} />
              ))}
            </View>
          </View>
        </ScrollView>

      <AdminBottomNavDock
        current="profile"
        role={role}
        onNavigate={(target: AdminNavTarget) => void router.replace(getAdminNavHref(target, role))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: 16, paddingTop: ADMIN_CONTENT_TOP_GAP, paddingBottom: ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE, gap: 18 },
  topChrome: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 10,
  },
  heroBadge: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: palette.accentSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroBadgeText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    color: palette.accent,
  },
  heroAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: -0.6,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.sub,
  },
  cardColumn: {
    gap: 10,
  },
});
