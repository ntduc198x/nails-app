import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { normalizeLocale, translate, type Locale, type TranslationKey } from "@nails/shared";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { premiumTheme } from "@/src/design/premium-theme";
import { mobileEnv } from "@/src/lib/env";

const { colors } = premiumTheme;
const LOCALE_STORAGE_KEY = "customer-preferences:locale";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token.trim() : "";
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>("vi");
  const [message, setMessage] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isUsed, setIsUsed] = useState(false);
  const t = useMemo(
    () => (key: TranslationKey<"mobileAuth">, nextParams?: Record<string, string | number>) =>
      translate(locale, "mobileAuth", key, nextParams),
    [locale],
  );

  const submitLabel = useMemo(() => {
    if (isSubmitting) return t("resetConfirming");
    return t("resetConfirmAction");
  }, [isSubmitting, t]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const storedLocale = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
      const nextLocale = normalizeLocale(storedLocale);
      if (mounted) {
        setLocale(nextLocale);
        setMessage(translate(nextLocale, "mobileAuth", "resetPreparing"));
      }
    })();

    async function validateResetToken() {
      try {
        if (!token) {
          throw new Error(t("invalidRecoveryLink"));
        }

        const response = await fetch(
          `${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/api/auth/password-reset/status?token=${encodeURIComponent(token)}`,
          { method: "GET" },
        );
        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; status?: "pending" | "expired" | "used" | "invalid"; error?: string }
          | null;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || t("invalidRecoveryToken"));
        }

        if (!mounted) return;

        setError(null);
        setIsReady(payload.status === "pending");
        setIsUsed(payload.status === "used");

        if (payload.status === "pending") {
          setMessage(t("resetReady"));
          return;
        }

        if (payload.status === "used") {
          setMessage(t("resetAlreadyUsed"));
          return;
        }

        if (payload.status === "expired") {
          setMessage("");
          setError(t("resetExpired"));
          return;
        }

        setMessage("");
        setError(t("invalidRecoveryToken"));
      } catch (nextError) {
        if (!mounted) return;
        setError(nextError instanceof Error ? nextError.message : t("invalidRecoveryToken"));
        setMessage("");
      } finally {
        if (mounted) {
          setIsPreparing(false);
        }
      }
    }

    void validateResetToken();

    return () => {
      mounted = false;
    };
  }, [t, token]);

  async function handleSubmit() {
    if (!token) {
      setError(t("invalidRecoveryLink"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/api/auth/password-reset/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; status?: "pending" | "expired" | "used" | "invalid"; error?: string }
        | null;

      if (!response.ok || !payload?.success) {
        if (payload?.status === "used") {
          setIsUsed(true);
          setIsReady(false);
          setMessage(t("resetAlreadyUsed"));
          return;
        }
        if (payload?.status === "expired") {
          throw new Error(t("resetExpired"));
        }
        if (payload?.status === "invalid") {
          throw new Error(payload.error || t("invalidRecoveryToken"));
        }
        throw new Error(payload?.error || translate(locale, "errors", "passwordChangeFailed"));
      }

      setIsUsed(true);
      setIsReady(false);
      setMessage(t("resetSuccess"));
      Alert.alert(t("resetSuccessAlertTitle"), t("resetSuccessAlertBody"), [
        {
          text: t("backToLogin"),
          onPress: () => router.replace("/(auth)/sign-in"),
        },
      ]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : translate(locale, "errors", "passwordChangeFailed"));
    } finally {
      setIsSubmitting(false);
    }
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
            {message ? <Text style={styles.helper}>{message}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.infoCard}>
              <Feather color="#7B6D63" name="mail" size={18} />
              <Text style={styles.infoCardText}>{t("resetEmailNotice")}</Text>
            </View>

            <Pressable
              style={[styles.primaryButton, (!isReady || isPreparing || isSubmitting) ? styles.primaryButtonDisabled : null]}
              disabled={!isReady || isPreparing || isSubmitting}
              onPress={() => void handleSubmit()}
            >
              <Text style={styles.primaryButtonText}>{submitLabel}</Text>
            </Pressable>

            {isUsed ? <Text style={styles.helper}>{t("resetLoginHint")}</Text> : null}

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
  container: {
    flex: 1,
    backgroundColor: "#FCFAF8",
  },
  keyboardShell: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 28,
    justifyContent: "center",
    gap: 18,
  },
  brandMark: {
    alignSelf: "center",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#231815",
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: "#F8E3D0",
    fontSize: 26,
    fontWeight: "800",
  },
  brand: {
    textAlign: "center",
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  brandSub: {
    textAlign: "center",
    color: "#8A7B6F",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.2,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: "#EFE5DB",
    gap: 14,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  helper: {
    color: "#7B6D63",
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    color: "#B43A3A",
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: "#FFF1F1",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7DDD2",
    backgroundColor: "#FFFDFB",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  infoCardText: {
    flex: 1,
    color: "#7B6D63",
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryAction: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  secondaryActionText: {
    color: "#7B6D63",
    fontSize: 14,
    fontWeight: "700",
  },
});
