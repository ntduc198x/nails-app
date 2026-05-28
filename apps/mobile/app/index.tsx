import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { normalizeLocale, translate, isCustomerRole, type Locale, type TranslationKey } from "@nails/shared";
import { useSession } from "@/src/providers/session-provider";

const LOCALE_STORAGE_KEY = "customer-preferences:locale";

export default function IndexScreen() {
  const { error, isHydrated, role } = useSession();
  const [locale, setLocale] = useState<Locale>("vi");
  const t = useMemo(
    () => (key: TranslationKey<"customer">) => translate(locale, "customer", key),
    [locale],
  );

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
      if (mounted) {
        setLocale(normalizeLocale(stored));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!isHydrated) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingShell}>
          <View style={styles.loadingBadge}>
            <Text style={styles.loadingBadgeText}>N</Text>
          </View>
          <Text style={styles.loadingTitle}>Nails Studio</Text>
          <Text style={styles.loadingSubtitle}>{t("appBootLoading")}</Text>

          <View style={styles.loadingCard}>
            <View style={styles.loadingRow}>
              <View style={styles.loadingAvatar} />
              <View style={styles.loadingTextGroup}>
                <View style={[styles.loadingLine, styles.loadingLineShort]} />
                <View style={[styles.loadingLine, styles.loadingLineLong]} />
              </View>
            </View>
            <View style={styles.loadingProgressTrack}>
              <View style={styles.loadingProgressFill} />
            </View>
          </View>

          <View style={styles.loadingFooter}>
            <ActivityIndicator color="#8a6340" size="small" />
            <Text style={styles.loadingFooterText}>{t("appBootLoading")}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>{t("appBootErrorTitle")}</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.label}>{t("appBootErrorRetry")}</Text>
        <Redirect href="/sign-in" />
      </View>
    );
  }

  if (!role) {
    return <Redirect href="/sign-in" />;
  }

  if (isCustomerRole(role)) {
    return <Redirect href="/(customer)/(tabs)" />;
  }

  return <Redirect href="/(admin)/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff8f0",
    padding: 24,
  },
  loadingShell: {
    alignItems: "center",
    gap: 16,
    width: "100%",
    maxWidth: 320,
  },
  loadingBadge: {
    alignItems: "center",
    backgroundColor: "#2f241d",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    shadowColor: "#6f5138",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    width: 48,
  },
  loadingBadgeText: {
    color: "#fffaf4",
    fontSize: 22,
    fontWeight: "800",
  },
  loadingTitle: {
    color: "#2f241d",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  loadingSubtitle: {
    color: "#7d6a5a",
    fontSize: 14,
    textAlign: "center",
  },
  loadingCard: {
    backgroundColor: "#fffdf9",
    borderColor: "#f0e3d7",
    borderRadius: 26,
    borderWidth: 1,
    gap: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    width: "100%",
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  loadingAvatar: {
    backgroundColor: "#f4e7da",
    borderRadius: 18,
    height: 52,
    width: 52,
  },
  loadingTextGroup: {
    flex: 1,
    gap: 10,
  },
  loadingLine: {
    backgroundColor: "#efe2d5",
    borderRadius: 999,
    height: 10,
  },
  loadingLineShort: {
    width: "42%",
  },
  loadingLineLong: {
    width: "78%",
  },
  loadingProgressTrack: {
    backgroundColor: "#f2e6db",
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  loadingProgressFill: {
    backgroundColor: "#c89a72",
    borderRadius: 999,
    height: "100%",
    width: "56%",
  },
  loadingFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  loadingFooterText: {
    color: "#8a7869",
    fontSize: 13,
    fontWeight: "600",
  },
  label: {
    color: "#5d4f46",
    fontSize: 14,
    textAlign: "center",
  },
  errorTitle: {
    color: "#7f221e",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  errorText: {
    color: "#9f2d2d",
    lineHeight: 20,
    textAlign: "center",
  },
});
