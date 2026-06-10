import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { normalizeLocale, translate, type Locale, type TranslationKey } from "@nails/shared";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/src/providers/session-provider";

const LOCALE_STORAGE_KEY = "customer-preferences:locale";

export default function AuthCallbackScreen() {
  const { isHydrated } = useSession();
  const [locale, setLocale] = useState<Locale>("vi");
  const t = useMemo(
    () => (key: TranslationKey<"mobileAuth">) => translate(locale, "mobileAuth", key),
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

  if (isHydrated) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#4a3424" />
      <Text style={styles.title}>{t("callbackCompletingTitle")}</Text>
      <Text style={styles.subtitle}>{t("callbackCompletingSubtitle")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff8f0",
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    color: "#3d3027",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#74665b",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
