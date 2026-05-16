import Feather from "@expo/vector-icons/Feather";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MANAGE_SCREEN_ITEMS, type ManageScreenItem, type ManageScreenKey } from "@/src/features/admin/manage";
import { dismissToHref, getAdminNavHref, isOwnerRole, type AdminNavTarget } from "@/src/features/admin/navigation";
import { AdminBottomNavDock, AdminHeaderActions, AdminKeyboardAwareScrollView, AdminTopSafeArea, ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE, ADMIN_CONTENT_TOP_GAP, ADMIN_KEYBOARD_ACTIVE_FIELD_CLEARANCE, useKeyboardVisible } from "@/src/features/admin/ui";
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
    case "content":
      return { iconBg: "#F5EFFC", iconBorder: "#E6DBF8", iconColor: "#8A63D2" };
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
    void router.push("/(admin)/shifts");
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
  hiddenTabKeys = [],
}: {
  currentKey: ManageScreenKey;
  group: ManageScreenItem["group"];
  hiddenTabKeys?: ManageScreenKey[];
}) {
  const router = useRouter();
  const tabs = getGroupTabs(group).filter((item) => !hiddenTabKeys.includes(item.key));

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
  backHref,
  activeTab = "profile",
  onRefresh,
  refreshing,
  showTabs = true,
  showBottomDock = true,
  showBackButton = true,
  hiddenTabKeys = [],
  children,
}: {
  title: string;
  subtitle: string;
  currentKey: ManageScreenKey;
  group: ManageScreenItem["group"];
  backHref?: Href;
  activeTab?: "booking" | "scheduling" | "checkout" | "profile";
  onRefresh?: (() => void) | null;
  refreshing?: boolean;
  showTabs?: boolean;
  showBottomDock?: boolean;
  showBackButton?: boolean;
  hiddenTabKeys?: ManageScreenKey[];
  children: ReactNode;
}) {
  const router = useRouter();
  const { role } = useSession();
  const keyboardVisible = useKeyboardVisible();

  return (
    <View style={styles.screen}>
      <AdminTopSafeArea style={styles.topChrome}>
        <View style={[styles.header, !showBackButton ? styles.headerNoBack : null]}>
          {showBackButton ? (
            <Pressable
              style={styles.headerButton}
              onPress={() => {
                dismissToHref(router, backHref ?? "/(admin)/manage");
              }}
            >
              <Feather name="chevron-left" size={22} color={palette.text} />
            </Pressable>
          ) : null}
          <View style={[styles.headerCopy, !showBackButton ? styles.headerCopyNoBack : null]}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </View>
          <View style={!showBackButton ? styles.headerActionsFloating : null}>
            <AdminHeaderActions onSettingsPress={() => void router.push("/(admin)/settings")} />
          </View>
        </View>

        {showTabs ? <ManageModuleTabs currentKey={currentKey} group={group} hiddenTabKeys={hiddenTabKeys} /> : null}
      </AdminTopSafeArea>

      <KeyboardAvoidingView
        style={styles.scrollRegion}
        enabled={Platform.OS === "android"}
        behavior="height"
      >
        <AdminKeyboardAwareScrollView
          contentContainerStyle={[
            styles.content,
            keyboardVisible ? { paddingBottom: ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE + ADMIN_KEYBOARD_ACTIVE_FIELD_CLEARANCE } : null,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentInsetAdjustmentBehavior="always"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={palette.accent}
                colors={[palette.accent]}
              />
            ) : undefined
          }
        >
          {children}
        </AdminKeyboardAwareScrollView>
      </KeyboardAvoidingView>

      {showBottomDock ? (
        <AdminBottomNavDock
          current={activeTab}
          role={role}
          onNavigate={(target: AdminNavTarget) => void router.replace(getAdminNavHref(target, role))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  scrollRegion: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: ADMIN_CONTENT_TOP_GAP,
    paddingBottom: ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE,
    gap: 16,
  },
  topChrome: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerNoBack: {
    alignItems: "flex-start",
    paddingRight: 84,
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
    gap: 4,
  },
  headerCopyNoBack: {
    flex: 0,
    width: "100%",
  },
  headerActionsFloating: {
    position: "absolute",
    right: 0,
    top: 0,
  },
  headerTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: -0.7,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 22,
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
    paddingHorizontal: 16,
    paddingTop: 6,
  },
});

export const manageStyles = styles;
