import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MANAGE_SCREEN_ITEMS, type ManageScreenItem, type ManageScreenKey } from "@/src/features/admin/manage";
import { getAdminNavHref, isOwnerRole, type AdminNavTarget } from "@/src/features/admin/navigation";
import { AdminBottomNav, getAdminBottomBarPadding, getAdminHeaderTopPadding } from "@/src/features/admin/ui";
import { useSession } from "@/src/providers/session-provider";

const palette = {
  bg: "#FCFAF8",
  card: "#FFFFFF",
  border: "#EADFD3",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
};

function getManageCardTone(key: ManageScreenKey) {
  switch (key) {
    case "customers":
      return { iconBg: "#FFF3E8", iconBorder: "#F6DEC7", iconColor: "#E58A3A" };
    case "reports":
      return { iconBg: "#FFF5E7", iconBorder: "#F5E4BE", iconColor: "#E3A33A" };
    case "tax-books":
      return { iconBg: "#FFF6EA", iconBorder: "#F1DFC2", iconColor: "#C99042" };
    case "services":
      return { iconBg: "#EEF8EF", iconBorder: "#D7EED9", iconColor: "#54A96B" };
    case "resources":
      return { iconBg: "#F2EEFF", iconBorder: "#E0D8FF", iconColor: "#8B74E8" };
    case "team":
      return { iconBg: "#EDF5FF", iconBorder: "#D9E8FB", iconColor: "#5A98E6" };
    default:
      return { iconBg: "#FBF7F2", iconBorder: "#F1E7DC", iconColor: palette.accent };
  }
}

export function useManageOwnerGuard() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (!session.isHydrated) return;
    if (isOwnerRole(session.role)) return;
    void router.replace("/(admin)/shifts");
  }, [router, session.isHydrated, session.role]);

  return {
    ...session,
    allowed: isOwnerRole(session.role),
  };
}

function getGroupTabs(group: ManageScreenItem["group"]) {
  return MANAGE_SCREEN_ITEMS.filter((item) => item.group === group);
}

export function ManageModuleTabs({
  currentKey,
  group,
}: {
  currentKey: ManageScreenKey;
  group: ManageScreenItem["group"];
}) {
  const router = useRouter();
  const tabs = getGroupTabs(group);

  return (
    <View style={styles.tabsRow}>
      {tabs.map((item) => {
        const active = item.key === currentKey;
        return (
          <Pressable
            key={item.key}
            style={[styles.tabPill, active ? styles.tabPillActive : null]}
            onPress={() => void router.replace(item.route as never)}
          >
            <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{item.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ManageHubCard({
  item,
}: {
  item: ManageScreenItem;
}) {
  const router = useRouter();
  const tone = getManageCardTone(item.key);

  return (
    <Pressable style={styles.gridCard} onPress={() => void router.push(item.route as never)}>
      <View
        style={[
          styles.gridIcon,
          {
            backgroundColor: tone.iconBg,
            borderColor: tone.iconBorder,
          },
        ]}
      >
        <Feather name={item.icon} size={18} color={tone.iconColor} />
      </View>
      <View style={styles.gridCopy}>
        <Text style={styles.gridTitle}>{item.title}</Text>
        <Text style={styles.gridSubtitle}>{item.subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#A7988A" />
    </Pressable>
  );
}

export function ManageScreenShell({
  title,
  subtitle,
  currentKey,
  group,
  children,
}: {
  title: string;
  subtitle: string;
  currentKey: ManageScreenKey;
  group: ManageScreenItem["group"];
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { allowed, isHydrated, role } = useManageOwnerGuard();

  if (!isHydrated || !allowed) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: getAdminHeaderTopPadding(insets.top),
              paddingBottom: 112 + getAdminBottomBarPadding(insets.bottom),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable style={styles.headerButton} onPress={() => void router.replace("/(admin)/manage")}>
              <Feather name="chevron-left" size={22} color={palette.text} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            </View>
            <Pressable style={styles.headerButton} onPress={() => void router.push("/(admin)/settings")}>
              <Feather name="settings" size={20} color={palette.text} />
            </Pressable>
          </View>

          <ManageModuleTabs currentKey={currentKey} group={group} />

          {children}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: getAdminBottomBarPadding(insets.bottom) }]}>
          <AdminBottomNav
            current="profile"
            role={role}
            onNavigate={(target: AdminNavTarget) => void router.replace(getAdminNavHref(target, role))}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    paddingHorizontal: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.sub,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  tabPill: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  tabPillActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  tabText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "600",
    color: "#6B5D50",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  gridCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#2A1E14",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  gridIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gridCopy: {
    flex: 1,
    gap: 4,
  },
  gridTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: palette.text,
  },
  gridSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.sub,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingTop: 8,
  },
});

export const manageStyles = styles;
