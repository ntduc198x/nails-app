import { Redirect, Stack } from "expo-router";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { isCustomerRole } from "@nails/shared";
import { premiumTheme } from "@/src/design/premium-theme";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { CustomerPreferencesProvider, useCustomerPreferences, useCustomerTheme } from "@/src/providers/customer-preferences-provider";
import { useSession } from "@/src/providers/session-provider";

const { colors, radius, spacing } = premiumTheme;

type CustomerRenderBoundaryState = {
  errorMessage: string | null;
};

class CustomerRenderBoundary extends Component<{
  children: ReactNode;
  errorEyebrow: string;
  errorTitle: string;
  errorFallbackMessage: string;
}, CustomerRenderBoundaryState> {
  state: CustomerRenderBoundaryState = {
    errorMessage: null,
  };

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    void error;
    void errorInfo;
    this.setState({
      errorMessage: error.message || this.props.errorFallbackMessage,
    });
    // Keep the fallback UI visible in production builds.
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <View style={styles.errorContainer}>
          <StatusBar style="dark" />
          <View style={styles.errorCard}>
            <Text style={styles.errorEyebrow}>{this.props.errorEyebrow}</Text>
            <Text style={styles.errorTitle}>{this.props.errorTitle}</Text>
            <Text style={styles.errorMessage}>{this.state.errorMessage}</Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

function LocalizedCustomerBoundary({ children }: { children: ReactNode }) {
  const strings = useCustomerStrings();

  return (
    <CustomerRenderBoundary
      errorEyebrow={strings.customerShellErrorEyebrow}
      errorTitle={strings.customerShellErrorTitle}
      errorFallbackMessage={strings.customerShellRenderFailed}
    >
      {children}
    </CustomerRenderBoundary>
  );
}

function CustomerLayoutContent() {
  const { isHydrated, role } = useSession();
  const { colorScheme } = useCustomerPreferences();
  const theme = useCustomerTheme();
  const strings = useCustomerStrings();
  const { colors, radius, spacing } = theme;

  if (!isHydrated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl }]}>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, borderColor: colors.border, gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl }]}>
          <Text style={[styles.eyebrow, { color: colors.accentWarm }]}>{strings.customerShellErrorEyebrow}</Text>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.label, { color: colors.textSoft }]}>{strings.customerShellLoading}</Text>
        </View>
      </View>
    );
  }

  if (role && !isCustomerRole(role)) {
    return <Redirect href="/(admin)/(tabs)" />;
  }

  return (
    <>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function CustomerLayout() {
  return (
    <CustomerPreferencesProvider>
      <LocalizedCustomerBoundary>
        <CustomerLayoutContent />
      </LocalizedCustomerBoundary>
    </CustomerPreferencesProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  label: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  errorCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderColor: colors.border,
    borderWidth: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  errorEyebrow: {
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  errorTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  errorMessage: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
  },
});
