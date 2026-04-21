import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useSession } from "@/src/providers/session-provider";

export default function SignInScreen() {
  const { clearError, error, isBusy, isHydrated, role, requestPasswordReset, signIn, signUp } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (isHydrated && role) {
    return <Redirect href="/" />;
  }

  async function handleSubmit() {
    setMessage(null);
    clearError();

    if (mode === "signup") {
      await signUp({
        email,
        password,
        name,
        inviteCode,
      });
      setMessage("Dang ky thanh cong. Mobile session da duoc khoi tao.");
      return;
    }

    await signIn({ email, password });
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setMessage("Nhap email truoc khi gui yeu cau reset password.");
      return;
    }

    await requestPasswordReset(email);
    setMessage("Da gui email reset password. Kiem tra inbox cua ban.");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Week 2 Auth</Text>
        <Text style={styles.title}>Nails App Mobile</Text>
        <Text style={styles.description}>
          Dang nhap mobile da noi Supabase that, bootstrap role va app session nhu web.
        </Text>
        <Pressable style={styles.guestButton} onPress={() => router.push("/(customer)")}>
          <Text style={styles.guestButtonText}>Dat lich khach vang lai</Text>
        </Pressable>

        <View style={styles.modeSwitch}>
          <Pressable
            style={[styles.modeButton, mode === "login" ? styles.modeButtonActive : null]}
            onPress={() => {
              setMode("login");
              setMessage(null);
              clearError();
            }}
          >
            <Text style={[styles.modeButtonText, mode === "login" ? styles.modeButtonTextActive : null]}>Dang nhap</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === "signup" ? styles.modeButtonActive : null]}
            onPress={() => {
              setMode("signup");
              setMessage(null);
              clearError();
            }}
          >
            <Text style={[styles.modeButtonText, mode === "signup" ? styles.modeButtonTextActive : null]}>Dang ky</Text>
          </Pressable>
        </View>

        {mode === "signup" ? (
          <>
            <TextInput
              autoCapitalize="words"
              placeholder="Ten cua ban"
              placeholderTextColor="#9d8a79"
              style={styles.input}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              autoCapitalize="characters"
              placeholder="Ma moi"
              placeholderTextColor="#9d8a79"
              style={styles.input}
              value={inviteCode}
              onChangeText={(value) => setInviteCode(value.toUpperCase())}
            />
          </>
        ) : null}

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#9d8a79"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          secureTextEntry
          placeholder="Mat khau"
          placeholderTextColor="#9d8a79"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        <Pressable disabled={isBusy} style={styles.primaryButton} onPress={() => void handleSubmit()}>
          <Text style={styles.primaryButtonText}>
            {isBusy ? "Dang xu ly..." : mode === "login" ? "Dang nhap mobile" : "Tao tai khoan mobile"}
          </Text>
        </Pressable>

        {mode === "login" ? (
          <Pressable disabled={isBusy} style={styles.linkButton} onPress={() => void handlePasswordReset()}>
            <Text style={styles.linkButtonText}>Quen mat khau?</Text>
          </Pressable>
        ) : null}

        {message ? <Text style={styles.notice}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5efe6",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fffdf8",
    borderRadius: 24,
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: "#eadbc8",
  },
  eyebrow: {
    color: "#9a6b3f",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#3b2414",
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5c4738",
  },
  guestButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#f1e5d8",
  },
  guestButtonText: {
    color: "#5c4738",
    fontWeight: "600",
  },
  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "#f1e5d8",
    padding: 4,
    borderRadius: 14,
    gap: 6,
  },
  modeButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: "#fff",
  },
  modeButtonText: {
    color: "#6f5947",
    fontWeight: "600",
  },
  modeButtonTextActive: {
    color: "#2b1d12",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eadbc8",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#2b1d12",
  },
  primaryButton: {
    backgroundColor: "#3b2414",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  linkButton: {
    paddingVertical: 6,
    alignItems: "flex-end",
  },
  linkButtonText: {
    color: "#5c4738",
    textDecorationLine: "underline",
  },
  notice: {
    color: "#2f5b2f",
    lineHeight: 20,
  },
  error: {
    color: "#9f2d2d",
    lineHeight: 20,
  },
});
