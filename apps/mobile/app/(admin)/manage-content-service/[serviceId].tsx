import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { Href } from "expo-router";
import type { LocalizedTextValue, MobileAdminMerchService, TranslationMetaValue } from "@nails/shared";
import { listAdminMerchServicesForMobile, updateAdminMerchServiceForMobile } from "@nails/shared";
import { CachedAppImage } from "@/src/components/cached-app-image";
import { uploadPickedAdminContentImage } from "@/src/features/admin/content-images";
import { buildManualAwareTranslationMeta } from "@/src/features/admin/dynamic-translation";
import { ManageScreenShell } from "@/src/features/admin/manage-ui";
import { dismissToHref } from "@/src/features/admin/navigation";
import { useAdminStrings } from "@/src/features/admin/strings";
import { AdminKeyboardTextInput } from "@/src/features/admin/ui";
import { clearCustomerFeedCache } from "@/src/lib/customer-feed-cache";
import { useAdminPreferences } from "@/src/providers/admin-preferences-provider";
import { mobileSupabase } from "@/src/lib/supabase";

const palette = {
  border: "#EADFD3",
  card: "#FFFFFF",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F5E9DD",
};

type MerchFormState = {
  id: string;
  name: string;
  nameEn: string;
  shortDescription: string;
  shortDescriptionEn: string;
  imageUrl: string;
  durationLabel: string;
  durationLabelEn: string;
  featuredInHome: boolean;
  featuredInExplore: boolean;
  displayOrderHome: string;
  displayOrderExplore: string;
  lookbookCategory: string;
  lookbookBadge: string;
  lookbookBadgeEn: string;
  lookbookTone: string;
  lookbookToneEn: string;
  translationMeta?: TranslationMetaValue | null;
};

function parseNumberInput(value: string) {
  return Number(value.replace(/[^\d.-]/g, "") || 0);
}

function getLocalizedText(translations: LocalizedTextValue | null | undefined, locale: "vi" | "en", field: string) {
  const value = translations?.[locale]?.[field];
  return typeof value === "string" ? value : "";
}

function putTextField(target: Record<string, string>, field: string, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) {
    target[field] = trimmed;
  }
}

function buildServiceTranslations(form: MerchFormState): LocalizedTextValue {
  const vi: Record<string, string> = {};
  const en: Record<string, string> = {};

  putTextField(vi, "name", form.name);
  putTextField(vi, "short_description", form.shortDescription);
  putTextField(vi, "duration_label", form.durationLabel);
  putTextField(vi, "lookbook_badge", form.lookbookBadge);
  putTextField(vi, "lookbook_tone", form.lookbookTone);

  putTextField(en, "name", form.nameEn);
  putTextField(en, "short_description", form.shortDescriptionEn);
  putTextField(en, "duration_label", form.durationLabelEn);
  putTextField(en, "lookbook_badge", form.lookbookBadgeEn);
  putTextField(en, "lookbook_tone", form.lookbookToneEn);

  return { vi, en };
}

function buildMerchForm(service: MobileAdminMerchService): MerchFormState {
  return {
    id: service.id,
    name: service.name,
    nameEn: getLocalizedText(service.translations, "en", "name"),
    shortDescription: service.shortDescription ?? "",
    shortDescriptionEn: getLocalizedText(service.translations, "en", "short_description"),
    imageUrl: service.imageUrl ?? "",
    durationLabel: service.durationLabel ?? "",
    durationLabelEn: getLocalizedText(service.translations, "en", "duration_label"),
    featuredInHome: service.featuredInHome,
    featuredInExplore: service.featuredInExplore,
    displayOrderHome: String(service.displayOrderHome ?? 0),
    displayOrderExplore: String(service.displayOrderExplore ?? 0),
    lookbookCategory: service.lookbookCategory ?? "",
    lookbookBadge: service.lookbookBadge ?? "",
    lookbookBadgeEn: getLocalizedText(service.translations, "en", "lookbook_badge"),
    lookbookTone: service.lookbookTone ?? "",
    lookbookToneEn: getLocalizedText(service.translations, "en", "lookbook_tone"),
    translationMeta: service.translationMeta ?? null,
  };
}

export default function AdminManageContentServiceDetailScreen() {
  const params = useLocalSearchParams<{ serviceId?: string; context?: string; backHref?: string }>();
  const router = useRouter();
  const serviceId = typeof params.serviceId === "string" ? params.serviceId : "";
  const context = params.context === "home" ? "home" : "explore";
  const backHref = (typeof params.backHref === "string" ? params.backHref : "/(admin)/manage-content") as Href;
  const strings = useAdminStrings();
  const { locale } = useAdminPreferences();

  const [form, setForm] = useState<MerchFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadService = useCallback(async () => {
    if (!mobileSupabase) {
      setError(strings.serviceDetailMissingSupabase);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const services = await listAdminMerchServicesForMobile(mobileSupabase);
      const service = services.find((item) => item.id === serviceId);
      if (!service) throw new Error(strings.serviceDetailNotFound);
      setForm(buildMerchForm(service));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : strings.serviceDetailLoadFailed);
    } finally {
      setIsLoading(false);
    }
  }, [serviceId, strings.serviceDetailLoadFailed, strings.serviceDetailMissingSupabase, strings.serviceDetailNotFound]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadService();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadService]);

  const title = useMemo(() => (context === "home" ? strings.serviceDetailHomeTitle : strings.serviceDetailExploreTitle), [context, strings.serviceDetailExploreTitle, strings.serviceDetailHomeTitle]);

  async function pickAndUploadImage() {
    if (!form) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(strings.serviceDetailPermissionTitle, strings.serviceDetailPermissionBody);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      const uploaded = await uploadPickedAdminContentImage(result.assets[0], {
        folder: "storefront",
        baseName: form.name || "service",
      }, locale);
      setForm((current) => (current ? { ...current, imageUrl: uploaded.publicUrl } : current));
    } catch (nextError) {
      Alert.alert(strings.serviceDetailImageFailedTitle, nextError instanceof Error ? nextError.message : strings.offerDetailFallbackTryLater);
    }
  }

  async function handleSave() {
    if (!mobileSupabase || !form) return;
    setIsSaving(true);
    try {
      await updateAdminMerchServiceForMobile(mobileSupabase, {
        id: form.id,
        shortDescription: form.shortDescription,
        imageUrl: form.imageUrl,
        durationLabel: form.durationLabel,
        featuredInLookbook: form.featuredInHome || form.featuredInExplore,
        featuredInHome: form.featuredInHome,
        featuredInExplore: form.featuredInExplore,
        displayOrderHome: parseNumberInput(form.displayOrderHome),
        displayOrderExplore: parseNumberInput(form.displayOrderExplore),
        lookbookCategory: form.lookbookCategory,
        lookbookBadge: form.lookbookBadge,
        lookbookTone: form.lookbookTone,
        translations: buildServiceTranslations(form),
        translationMeta: buildManualAwareTranslationMeta(form.translationMeta ?? null, {
          name: form.nameEn,
          short_description: form.shortDescriptionEn,
          duration_label: form.durationLabelEn,
          lookbook_badge: form.lookbookBadgeEn,
          lookbook_tone: form.lookbookToneEn,
        }),
      });
      await clearCustomerFeedCache();
      dismissToHref(router, backHref);
    } catch (nextError) {
      Alert.alert(strings.serviceDetailSaveFailedTitle, nextError instanceof Error ? nextError.message : strings.offerDetailFallbackTryLater);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ManageScreenShell title={title} subtitle={strings.serviceDetailSubtitle} currentKey="content" group="setup" backHref={backHref} showTabs={false} showBottomDock={false}>
      <View style={styles.sectionCard}>
        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={palette.accent} />
            <Text style={styles.stateText}>{strings.serviceDetailLoading}</Text>
          </View>
        ) : error || !form ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{error ?? strings.serviceDetailEmpty}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadService()}>
              <Text style={styles.retryButtonText}>{strings.serviceDetailRetry}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.formColumn}>
            <View style={styles.headerBlock}>
              <Text style={styles.eyebrow}>{strings.serviceDetailTemplateLabel}</Text>
              <Text style={styles.serviceName}>{form.name}</Text>
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>English service name</Text>
              <AdminKeyboardTextInput placeholder="e.g. Korean Clean Nude" placeholderTextColor="#B4A89C" style={styles.input} value={form.nameEn} onChangeText={(value) => setForm((current) => (current ? { ...current, nameEn: value } : current))} />
            </View>
            {form.imageUrl ? <CachedAppImage source={{ uri: form.imageUrl }} style={styles.previewImage} alt={form.name} /> : null}
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>{strings.serviceDetailShortDescriptionLabel}</Text>
              <AdminKeyboardTextInput multiline scrollEnabled={false} placeholder={strings.serviceDetailShortDescriptionPlaceholder} placeholderTextColor="#B4A89C" style={[styles.input, styles.textarea]} textAlignVertical="top" value={form.shortDescription} onChangeText={(value) => setForm((current) => (current ? { ...current, shortDescription: value } : current))} />
              <AdminKeyboardTextInput multiline scrollEnabled={false} placeholder="English description shown to customers" placeholderTextColor="#B4A89C" style={[styles.input, styles.textarea]} textAlignVertical="top" value={form.shortDescriptionEn} onChangeText={(value) => setForm((current) => (current ? { ...current, shortDescriptionEn: value } : current))} />
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>{strings.serviceDetailImageLabel}</Text>
              <View style={styles.inlineRow}>
                <AdminKeyboardTextInput placeholder={strings.serviceDetailImagePlaceholder} placeholderTextColor="#B4A89C" style={[styles.input, styles.flexInput]} value={form.imageUrl} onChangeText={(value) => setForm((current) => (current ? { ...current, imageUrl: value } : current))} />
                <Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage()}>
                  <Feather name="upload" size={18} color={palette.accent} />
                  <Text style={styles.secondaryButtonText}>{strings.serviceDetailUploadButton}</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.inlineRow}>
              <View style={[styles.fieldBlock, styles.flexBlock]}>
                <Text style={styles.label}>{strings.serviceDetailDurationLabel}</Text>
                <AdminKeyboardTextInput placeholder={strings.serviceDetailDurationPlaceholder} placeholderTextColor="#B4A89C" style={styles.input} value={form.durationLabel} onChangeText={(value) => setForm((current) => (current ? { ...current, durationLabel: value } : current))} />
                <AdminKeyboardTextInput placeholder="English duration label, e.g. 90 min" placeholderTextColor="#B4A89C" style={styles.input} value={form.durationLabelEn} onChangeText={(value) => setForm((current) => (current ? { ...current, durationLabelEn: value } : current))} />
              </View>
              <View style={[styles.fieldBlock, styles.flexBlock]}>
                <Text style={styles.label}>{strings.serviceDetailDisplayOrderExploreLabel}</Text>
                <AdminKeyboardTextInput placeholder={strings.serviceDetailDisplayOrderPlaceholder} placeholderTextColor="#B4A89C" keyboardType="number-pad" style={styles.input} value={form.displayOrderExplore} onChangeText={(value) => setForm((current) => (current ? { ...current, displayOrderExplore: value } : current))} />
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>{strings.serviceDetailLookbookLabel}</Text>
              <AdminKeyboardTextInput placeholder={strings.serviceDetailLookbookCategoryPlaceholder} placeholderTextColor="#B4A89C" style={styles.input} value={form.lookbookCategory} onChangeText={(value) => setForm((current) => (current ? { ...current, lookbookCategory: value } : current))} />
              <AdminKeyboardTextInput placeholder={strings.serviceDetailLookbookBadgePlaceholder} placeholderTextColor="#B4A89C" style={styles.input} value={form.lookbookBadge} onChangeText={(value) => setForm((current) => (current ? { ...current, lookbookBadge: value } : current))} />
              <AdminKeyboardTextInput placeholder="English badge, e.g. Featured" placeholderTextColor="#B4A89C" style={styles.input} value={form.lookbookBadgeEn} onChangeText={(value) => setForm((current) => (current ? { ...current, lookbookBadgeEn: value } : current))} />
              <AdminKeyboardTextInput placeholder={strings.serviceDetailLookbookTonePlaceholder} placeholderTextColor="#B4A89C" style={styles.input} value={form.lookbookTone} onChangeText={(value) => setForm((current) => (current ? { ...current, lookbookTone: value } : current))} />
              <AdminKeyboardTextInput placeholder="English tone, e.g. Luxury" placeholderTextColor="#B4A89C" style={styles.input} value={form.lookbookToneEn} onChangeText={(value) => setForm((current) => (current ? { ...current, lookbookToneEn: value } : current))} />
            </View>
            <View style={styles.toggleRow}>
              <Pressable style={[styles.toggleChip, form.featuredInExplore ? styles.toggleChipActive : null]} onPress={() => setForm((current) => (current ? { ...current, featuredInExplore: !current.featuredInExplore } : current))}>
                <Text style={[styles.toggleText, form.featuredInExplore ? styles.toggleTextActive : null]}>{strings.serviceDetailFeaturedExplore}</Text>
              </Pressable>
              <Pressable style={[styles.toggleChip, form.featuredInHome ? styles.toggleChipActive : null]} onPress={() => setForm((current) => (current ? { ...current, featuredInHome: !current.featuredInHome } : current))}>
                <Text style={[styles.toggleText, form.featuredInHome ? styles.toggleTextActive : null]}>{strings.serviceDetailFeaturedHome}</Text>
              </Pressable>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => void handleSave()} disabled={isSaving}>
              <Text style={styles.primaryButtonText}>{isSaving ? strings.serviceDetailSavingButton : strings.serviceDetailSaveButton}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionCard: { borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, padding: 16, gap: 14 },
  formColumn: { gap: 14 },
  headerBlock: { gap: 4 },
  eyebrow: { fontSize: 12, lineHeight: 18, color: palette.sub, fontWeight: "600" },
  serviceName: { fontSize: 18, lineHeight: 24, color: palette.text, fontWeight: "800" },
  previewImage: { width: "100%", aspectRatio: 1.58, borderRadius: 18, backgroundColor: "#F4ECE2" },
  fieldBlock: { gap: 8 },
  label: { fontSize: 13, lineHeight: 18, color: palette.text, fontWeight: "700" },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingVertical: 13, color: palette.text, fontSize: 14 },
  textarea: { minHeight: 88 },
  inlineRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  flexInput: { flex: 1 },
  flexBlock: { flex: 1 },
  secondaryButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFF9F3" },
  secondaryButtonText: { color: palette.accent, fontSize: 13, fontWeight: "700" },
  toggleRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  toggleChip: { minHeight: 42, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFCF9", alignItems: "center", justifyContent: "center" },
  toggleChipActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  toggleText: { color: palette.sub, fontSize: 13, fontWeight: "700" },
  toggleTextActive: { color: palette.accent },
  primaryButton: { minHeight: 52, borderRadius: 18, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  stateCard: { borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFCF9", padding: 16, alignItems: "center", gap: 10 },
  stateText: { fontSize: 13, lineHeight: 18, color: palette.sub },
  errorText: { fontSize: 13, lineHeight: 18, color: "#C25A43", textAlign: "center" },
  retryButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" },
  retryButtonText: { color: palette.accent, fontSize: 13, fontWeight: "700" },
});
