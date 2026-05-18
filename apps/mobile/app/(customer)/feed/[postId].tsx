import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { CustomerCachedImage } from "@/src/features/customer/cached-image";
import { CustomerScreen, CustomerTopActions, SurfaceCard } from "@/src/features/customer/ui";
import { premiumTheme } from "@/src/design/premium-theme";

const { colors, radius } = premiumTheme;

function getParam(
  params: ReturnType<typeof useLocalSearchParams>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function CustomerFeedDetailScreen() {
  const params = useLocalSearchParams();
  const title = getParam(params, "title");
  const summary = getParam(params, "summary");
  const body = getParam(params, "body");
  const coverImageUrl = getParam(params, "coverImageUrl");
  const coverImagePreviewUrl = getParam(params, "coverImagePreviewUrl");
  const sourcePlatform = getParam(params, "sourcePlatform");

  return (
    <CustomerScreen hideHeader title={title || "Chi tiết feed"} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(customer)/(tabs)");
            }
          }}
        >
          <Feather color={colors.text} name="chevron-left" size={22} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>{title || "Chi tiết feed"}</Text>
        <CustomerTopActions />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {coverImageUrl ? (
          <SurfaceCard style={styles.heroCard}>
            <CustomerCachedImage
              alt={title || "Feed image"}
              source={{ uri: coverImagePreviewUrl || coverImageUrl }}
              intent="preview"
              resizeMode="cover"
              style={styles.heroImage}
            />
          </SurfaceCard>
        ) : null}

        <SurfaceCard style={styles.articleCard}>
          {sourcePlatform ? <Text style={styles.platformTag}>{sourcePlatform}</Text> : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
          <Text style={styles.bodyText}>{body || summary || "Nội dung đang được cập nhật."}</Text>
        </SurfaceCard>
      </ScrollView>
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 0,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    marginHorizontal: 12,
  },
  body: {
    gap: 14,
    paddingBottom: 140,
  },
  heroCard: {
    padding: 10,
  },
  heroImage: {
    borderRadius: 20,
    height: 240,
    width: "100%",
  },
  articleCard: {
    gap: 12,
    padding: 18,
  },
  platformTag: {
    alignSelf: "flex-start",
    backgroundColor: "#fff7ef",
    borderRadius: radius.pill,
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 30,
  },
  summary: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  bodyText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
});
