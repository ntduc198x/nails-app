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
        <ActivityIndicator color="#2f241d" />
        <Text style={styles.label}>{t("appBootLoading")}</Text>
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
    gap: 12,
    padding: 24,
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
