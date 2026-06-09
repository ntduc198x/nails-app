import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { normalizeLocale, translate, type Locale, type TranslationKey } from "@nails/shared";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { premiumTheme } from "@/src/design/premium-theme";
import { mobileEnv } from "@/src/lib/env";

const { colors } = premiumTheme;
const LOCALE_STORAGE_KEY = "customer-preferences:locale";

function buildResetWebUrl(token: string) {
  const baseUrl = (mobileEnv.passwordResetUrl || mobileEnv.apiBaseUrl).replace(/\/$/, "");
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token.trim() : "";
  const [locale, setLocale] = useState<Locale>("vi");
  const t = useMemo(
    () => (key: TranslationKey<"mobileAuth">, nextParams?: Record<string, string | number>) =>
      translate(locale, "mobileAuth", key, nextParams),
    [locale],
  );

  useEffect(() => {
    void (async () => {
      const storedLocale = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
      setLocale(normalizeLocale(storedLocale));
    })();
  }, []);

  const resetWebUrl = token ? buildResetWebUrl(token) : null;

  async function handleOpenWeb() {
    if (!resetWebUrl) {
      return;
    }

    await Linking.openURL(resetWebUrl);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.keyboardShell}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>C</Text>
          </View>
          <Text style={styles.brand}>CHAM BEAUTY</Text>
          <Text style={styles.brandSub}>RESET PASSWORD</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("resetTitle")}</Text>
            <Text style={styles.helper}>
              {token ? t("resetWebFirstNotice") : t("invalidRecoveryLink")}
            </Text>

            <View style={styles.infoCard}>
              <Feather color="#7B6D63" name="globe" size={18} />
              <Text style={styles.infoCardText}>{t("resetWebFirstHelp")}</Text>
            </View>

            <Pressable
              style={[styles.primaryButton, !resetWebUrl ? styles.primaryButtonDisabled : null]}
              disabled={!resetWebUrl}
              onPress={() => void handleOpenWeb()}
            >
              <Text style={styles.primaryButtonText}>{t("resetOpenWebAction")}</Text>
            </Pressable>

            <Pressable onPress={() => router.replace("/(auth)/sign-in")} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>{t("backToLogin")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: "#4B3425",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 1.8,
    textAlign: "center",
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "#E9DDD3",
    borderRadius: 999,
    height: 64,
    justifyContent: "center",
    marginBottom: 16,
    width: 64,
  },
  brandMarkText: {
    color: "#7B4B2A",
    fontSize: 28,
    fontWeight: "800",
  },
  brandSub: {
    color: "#7B6D63",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.4,
    marginBottom: 28,
    marginTop: 6,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E6DDD6",
    borderRadius: 28,
    borderWidth: 1,
    gap: 18,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  cardTitle: {
    color: "#24160F",
    fontSize: 23,
    fontWeight: "800",
  },
  container: {
    backgroundColor: "#F6EFE9",
    flex: 1,
  },
  helper: {
    color: "#6C5343",
    fontSize: 14,
    lineHeight: 22,
  },
  infoCard: {
    alignItems: "flex-start",
    backgroundColor: "#F9F4EF",
    borderColor: "#EFE3D8",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoCardText: {
    color: "#6C5343",
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  keyboardShell: {
    flex: 1,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#3C2415",
    borderRadius: 18,
    paddingVertical: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  secondaryAction: {
    alignItems: "center",
    paddingVertical: 4,
  },
  secondaryActionText: {
    color: "#6C5343",
    fontSize: 14,
    fontWeight: "700",
  },
});
