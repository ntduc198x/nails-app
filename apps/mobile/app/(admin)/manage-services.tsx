import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createAdminServiceForMobile,
  deleteAdminServiceForMobile,
  formatVnd,
  listAdminServicesForMobile,
  type MobileAdminService,
  updateAdminServiceForMobile,
} from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";
import { ManageScreenShell, manageStyles } from "@/src/features/admin/manage-ui";
import { uploadPickedServiceImage } from "@/src/features/admin/services-data";

type ServiceFormState = {
  name: string;
  shortDescription: string;
  imageUrl: string;
  featuredInLookbook: boolean;
  durationInput: string;
  priceInput: string;
  vatInput: string;
  active: boolean;
};

const emptyCreateForm: ServiceFormState = {
  name: "",
  shortDescription: "",
  imageUrl: "",
  featuredInLookbook: false,
  durationInput: "",
  priceInput: "",
  vatInput: "",
  active: true,
};

const palette = {
  border: "#EADFD3",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F3E7DA",
  danger: "#C66043",
  dangerSoft: "#FBECE7",
  success: "#2B9E5F",
  successSoft: "#E8F6ED",
  infoSoft: "#EEF3FF",
  info: "#5373D9",
  warningSoft: "#FFF5DF",
  warning: "#C6921A",
  mutedSoft: "#F7F3EE",
};

function parseDigits(value: string) {
  return Number(value.replace(/\D/g, "") || 0);
}

function parseDecimal(value: string) {
  return Number(value.replace(/[^\d.]/g, "") || 0);
}

function serviceToFormState(row: MobileAdminService): ServiceFormState {
  return {
    name: row.name,
    shortDescription: row.shortDescription ?? "",
    imageUrl: row.imageUrl ?? "",
    featuredInLookbook: row.featuredInLookbook,
    durationInput: String(row.durationMin),
    priceInput: String(Math.round(row.basePrice)),
    vatInput: String(Math.round(row.vatRate * 100)),
    active: row.active,
  };
}

function Input({
  multiline = false,
  ...props
}: React.ComponentProps<typeof TextInput> & { multiline?: boolean }) {
  return (
    <TextInput
      {...props}
      multiline={multiline}
      placeholderTextColor="#B3A79B"
      style={[styles.input, multiline ? styles.textarea : null, props.style]}
    />
  );
}

function MetricCard({
  icon,
  iconColor,
  iconSoft,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconSoft: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricRow}>
        <View style={[styles.metricIcon, { backgroundColor: iconSoft }]}>
          <Feather name={icon} size={15} color={iconColor} />
        </View>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Badge({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.badge, active ? styles.badgeActive : null]}
      onPress={onPress}
    >
      <Text style={[styles.badgeText, active ? styles.badgeTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function ServiceRowCard({
  editing,
  form,
  item,
  onCancelEdit,
  onChange,
  onMoveToTrash,
  onPickImage,
  onSave,
  onStartEdit,
  saving,
}: {
  editing: boolean;
  form: ServiceFormState | null;
  item: MobileAdminService;
  onCancelEdit: () => void;
  onChange: (patch: Partial<ServiceFormState>) => void;
  onMoveToTrash: () => void;
  onPickImage: () => void;
  onSave: () => void;
  onStartEdit: () => void;
  saving: boolean;
}) {
  return (
    <View style={styles.serviceCard}>
      <View style={styles.serviceHeaderRow}>
        <View style={styles.serviceIdentity}>
          {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.serviceThumb} /> : (
            <View style={[styles.serviceThumb, styles.serviceThumbFallback]}>
              <Feather name="image" size={16} color="#B8A999" />
            </View>
          )}
          <View style={styles.serviceCopy}>
            {editing && form ? (
              <Input
                value={form.name}
                onChangeText={(value) => onChange({ name: value })}
                placeholder="Tên dịch vụ"
                style={styles.editNameInput}
              />
            ) : (
              <>
                <View style={styles.serviceTitleRow}>
                  <Text style={styles.serviceTitle}>{item.name}</Text>
                  {item.featuredInLookbook ? (
                    <View style={[styles.statePill, styles.lookbookPill]}>
                      <Text style={[styles.statePillText, styles.lookbookPillText]}>Lookbook</Text>
                    </View>
                  ) : null}
                  <View style={[styles.statePill, item.active ? styles.activePill : styles.inactivePill]}>
                    <Text style={[styles.statePillText, item.active ? styles.activePillText : styles.inactivePillText]}>
                      {item.active ? "Đang dùng" : "Tạm ẩn"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.serviceSubtitle}>{item.shortDescription || "Chưa có mô tả ngắn."}</Text>
              </>
            )}
          </View>
        </View>
        {editing ? (
          <View style={styles.inlineActions}>
            <Pressable disabled={saving} onPress={onMoveToTrash} style={[styles.headerIconButton, styles.headerIconButtonDanger, saving ? styles.headerIconButtonDisabled : null]}>
              <Feather name="trash-2" size={14} color={palette.danger} />
            </Pressable>
            <Pressable onPress={onCancelEdit} style={styles.headerIconButton}>
              <Feather name="x" size={14} color={palette.sub} />
            </Pressable>
            <Pressable disabled={saving} onPress={onSave} style={[styles.headerIconButton, styles.headerIconButtonPrimary, saving ? styles.headerIconButtonDisabled : null]}>
              <Feather name={saving ? "loader" : "check"} size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onStartEdit} style={styles.headerIconButton}>
            <Feather name="edit-3" size={14} color={palette.accent} />
          </Pressable>
        )}
      </View>

      {editing && form ? (
        <View style={styles.editPanel}>
          <Input
            multiline
            numberOfLines={3}
            value={form.shortDescription}
            onChangeText={(value) => onChange({ shortDescription: value })}
            placeholder="Mô tả ngắn"
          />
          <View style={styles.threeColRow}>
            <Input
              value={form.priceInput}
              onChangeText={(value) => onChange({ priceInput: value.replace(/\D/g, "") })}
              keyboardType="number-pad"
              placeholder="Giá"
            />
            <Input
              value={form.durationInput}
              onChangeText={(value) => onChange({ durationInput: value.replace(/\D/g, "") })}
              keyboardType="number-pad"
              placeholder="Phút"
            />
            <Input
              value={form.vatInput}
              onChangeText={(value) => onChange({ vatInput: value.replace(/[^\d.]/g, "") })}
              keyboardType="decimal-pad"
              placeholder="VAT %"
            />
          </View>
          <Input
            value={form.imageUrl}
            onChangeText={(value) => onChange({ imageUrl: value })}
            placeholder="Ảnh URL"
          />
          <View style={styles.toggleRow}>
            <Badge
              active={form.featuredInLookbook}
              label="Đưa lên lookbook"
              onPress={() => onChange({ featuredInLookbook: !form.featuredInLookbook })}
            />
            <Badge
              active={form.active}
              label="Đang hoạt động"
              onPress={() => onChange({ active: !form.active })}
            />
            <Pressable style={styles.uploadPill} onPress={onPickImage}>
              <Feather name="upload" size={14} color={palette.sub} />
              <Text style={styles.uploadPillText}>Upload ảnh</Text>
            </Pressable>
          </View>
          {form.imageUrl ? (
            <View style={styles.previewRow}>
              <Image source={{ uri: form.imageUrl }} style={styles.previewThumb} />
              <Text style={styles.previewText}>Đã có ảnh preview</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.serviceMetaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>{formatVnd(item.basePrice)}</Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>{item.durationMin}p</Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>VAT {Math.round(item.vatRate * 100)}%</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function TrashRowCard({
  item,
  onDeleteForever,
  onRestore,
  saving,
}: {
  item: MobileAdminService;
  onDeleteForever: () => void;
  onRestore: () => void;
  saving: boolean;
}) {
  return (
    <View style={styles.trashCard}>
      <View style={styles.serviceTitleRow}>
        <Text style={styles.serviceTitle}>{item.name}</Text>
        <View style={[styles.statePill, styles.inactivePill]}>
          <Text style={[styles.statePillText, styles.inactivePillText]}>TRASH</Text>
        </View>
      </View>
      <Text style={styles.serviceSubtitle}>{item.shortDescription || "Chưa có mô tả ngắn."}</Text>
      <View style={styles.serviceMetaRow}>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>{formatVnd(item.basePrice)}</Text>
        </View>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>{item.durationMin}p</Text>
        </View>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>VAT {Math.round(item.vatRate * 100)}%</Text>
        </View>
      </View>
      <View style={styles.trashActions}>
        <Pressable disabled={saving} onPress={onRestore} style={styles.restoreButton}>
          <Text style={styles.restoreButtonText}>Khôi phục</Text>
        </Pressable>
        <Pressable disabled={saving} onPress={onDeleteForever} style={styles.deleteForeverButton}>
          <Text style={styles.deleteForeverButtonText}>Xóa hẳn</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminManageServicesScreen() {
  const [rows, setRows] = useState<MobileAdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<ServiceFormState>(emptyCreateForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ServiceFormState | null>(null);
  const [search, setSearch] = useState("");
  const [visibleSection, setVisibleSection] = useState<"services" | "lookbook" | "trash">("services");
  const [uploadingCreateImage, setUploadingCreateImage] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!mobileSupabase) {
      setError("Thiếu cấu hình Supabase mobile.");
      setLoading(false);
      return;
    }

    try {
      if (force || rows.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      setRows(await listAdminServicesForMobile(mobileSupabase));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không tải được dữ liệu dịch vụ.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rows.length]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load(true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [load]);

  const activeRows = useMemo(() => rows.filter((item) => item.active), [rows]);
  const serviceCount = useMemo(() => activeRows.filter((item) => !item.featuredInLookbook).length, [activeRows]);
  const lookbookCount = useMemo(() => activeRows.filter((item) => item.featuredInLookbook).length, [activeRows]);
  const trashRows = useMemo(() => rows.filter((item) => !item.active), [rows]);
  const keyword = search.trim().toLowerCase();
  const filteredServices = useMemo(
    () => activeRows.filter((item) => !item.featuredInLookbook && (!keyword || `${item.name} ${item.shortDescription ?? ""}`.toLowerCase().includes(keyword))),
    [activeRows, keyword],
  );
  const filteredLookbook = useMemo(
    () => activeRows.filter((item) => item.featuredInLookbook && (!keyword || `${item.name} ${item.shortDescription ?? ""}`.toLowerCase().includes(keyword))),
    [activeRows, keyword],
  );
  const filteredTrash = useMemo(
    () => trashRows.filter((item) => !keyword || `${item.name} ${item.shortDescription ?? ""}`.toLowerCase().includes(keyword)),
    [trashRows, keyword],
  );

  async function pickCreateImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      setUploadingCreateImage(true);
      setError(null);
      const uploaded = await uploadPickedServiceImage(
        result.assets[0],
        createForm.name || result.assets[0].fileName || undefined,
      );
      setCreateForm((prev) => ({ ...prev, imageUrl: uploaded.publicUrl }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Upload ảnh thất bại.");
    } finally {
      setUploadingCreateImage(false);
    }
  }

  async function pickEditImage() {
    if (!editForm) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      setUploadingEditImage(true);
      setError(null);
      const uploaded = await uploadPickedServiceImage(
        result.assets[0],
        editForm.name || result.assets[0].fileName || undefined,
      );
      setEditForm((prev) => (prev ? { ...prev, imageUrl: uploaded.publicUrl } : prev));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Upload ảnh thất bại.");
    } finally {
      setUploadingEditImage(false);
    }
  }

  async function submitCreate() {
    if (!mobileSupabase || submitting) return;
    if (!createForm.name.trim()) {
      setError("Vui lòng nhập tên dịch vụ.");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await createAdminServiceForMobile(mobileSupabase, {
        name: createForm.name.trim(),
        shortDescription: createForm.shortDescription.trim() || null,
        imageUrl: createForm.imageUrl.trim() || null,
        featuredInLookbook: createForm.featuredInLookbook,
        durationMin: parseDigits(createForm.durationInput),
        basePrice: parseDigits(createForm.priceInput),
        vatPercent: parseDecimal(createForm.vatInput),
      });
      const nextSection = createForm.featuredInLookbook ? "lookbook" : "services";
      setCreateForm(emptyCreateForm);
      setVisibleSection(nextSection);
      await load(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Thêm dịch vụ thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item: MobileAdminService) {
    setEditingId(item.id);
    setEditForm(serviceToFormState(item));
  }

  async function saveEdit() {
    if (!mobileSupabase || !editingId || !editForm || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      await updateAdminServiceForMobile(mobileSupabase, {
        id: editingId,
        name: editForm.name.trim(),
        shortDescription: editForm.shortDescription.trim() || null,
        imageUrl: editForm.imageUrl.trim() || null,
        featuredInLookbook: editForm.featuredInLookbook,
        durationMin: parseDigits(editForm.durationInput),
        basePrice: parseDigits(editForm.priceInput),
        vatPercent: parseDecimal(editForm.vatInput),
        active: editForm.active,
      });
      setEditingId(null);
      setEditForm(null);
      await load(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Cập nhật dịch vụ thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  function confirmMoveToTrash(item: MobileAdminService) {
    Alert.alert("Chuyển vào thùng rác", `Chuyển "${item.name}" vào thùng rác?`, [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Chuyển",
        style: "destructive",
        onPress: () => {
          void (async () => {
            if (!mobileSupabase) return;
            try {
              setSubmitting(true);
              setError(null);
              await updateAdminServiceForMobile(mobileSupabase, {
                id: item.id,
                name: item.name,
                shortDescription: item.shortDescription,
                imageUrl: item.imageUrl,
                featuredInLookbook: item.featuredInLookbook,
                durationMin: item.durationMin,
                basePrice: item.basePrice,
                vatPercent: item.vatRate * 100,
                active: false,
              });
              if (editingId === item.id) {
                setEditingId(null);
                setEditForm(null);
              }
              setVisibleSection("trash");
              await load(true);
            } catch (nextError) {
              setError(nextError instanceof Error ? nextError.message : "Chuyển vào thùng rác thất bại.");
            } finally {
              setSubmitting(false);
            }
          })();
        },
      },
    ]);
  }

  async function restoreFromTrash(item: MobileAdminService) {
    if (!mobileSupabase || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      await updateAdminServiceForMobile(mobileSupabase, {
        id: item.id,
        name: item.name,
        shortDescription: item.shortDescription,
        imageUrl: item.imageUrl,
        featuredInLookbook: item.featuredInLookbook,
        durationMin: item.durationMin,
        basePrice: item.basePrice,
        vatPercent: item.vatRate * 100,
        active: true,
      });
      setVisibleSection(item.featuredInLookbook ? "lookbook" : "services");
      await load(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Khôi phục dịch vụ thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDeleteForever(item: MobileAdminService) {
    Alert.alert("Xóa vĩnh viễn", `Xóa hẳn "${item.name}"?`, [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xóa hẳn",
        style: "destructive",
        onPress: () => {
          void (async () => {
            if (!mobileSupabase) return;
            try {
              setSubmitting(true);
              setError(null);
              await deleteAdminServiceForMobile(mobileSupabase, item.id);
              await load(true);
            } catch (nextError) {
              setError(nextError instanceof Error ? nextError.message : "Xóa vĩnh viễn thất bại.");
            } finally {
              setSubmitting(false);
            }
          })();
        },
      },
    ]);
  }

  const visibleRows = visibleSection === "services"
    ? filteredServices
    : visibleSection === "lookbook"
      ? filteredLookbook
      : filteredTrash;

  return (
    <ManageScreenShell
      title="Quản lý dịch vụ"
      subtitle="Chuẩn hóa danh mục dịch vụ, lookbook và thùng rác theo module web."
      currentKey="services"
      group="setup"
    >
      <View style={styles.summaryCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeadingWrap}>
            <Feather name="bar-chart-2" size={16} color={palette.sub} />
            <Text style={styles.sectionTitle}>Tổng quan</Text>
          </View>
        </View>
        <View style={styles.metricGrid}>
          <MetricCard icon="grid" iconColor="#FF6A5E" iconSoft="#FFF0EE" label="Tổng dịch vụ" value={activeRows.length} />
          <MetricCard icon="folder" iconColor={palette.info} iconSoft={palette.infoSoft} label="Dịch vụ" value={serviceCount} />
          <MetricCard icon="shopping-bag" iconColor={palette.warning} iconSoft={palette.warningSoft} label="Mẫu lookbook" value={lookbookCount} />
          <MetricCard icon="trash-2" iconColor={palette.success} iconSoft={palette.successSoft} label="Thùng rác" value={trashRows.length} />
        </View>
      </View>

      <View style={styles.formCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeadingWrap}>
            <Feather name="plus-circle" size={16} color={palette.accent} />
            <Text style={styles.sectionTitle}>Thêm dịch vụ mới</Text>
          </View>
          {(refreshing || loading) ? <ActivityIndicator size="small" color={palette.accent} /> : null}
        </View>

        <View style={styles.formRow}>
          <View style={styles.formFlex}>
            <Input value={createForm.name} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, name: value }))} placeholder="Tên dịch vụ" />
          </View>
          <View style={styles.formPrice}>
            <Input value={createForm.priceInput} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, priceInput: value.replace(/\D/g, "") }))} keyboardType="number-pad" placeholder="250000" />
          </View>
          <View style={styles.formDuration}>
            <Input value={createForm.durationInput} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, durationInput: value.replace(/\D/g, "") }))} keyboardType="number-pad" placeholder="45" />
          </View>
        </View>

        <View style={styles.formRow}>
          <View style={styles.formFlex}>
            <Input value={createForm.imageUrl} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, imageUrl: value }))} placeholder="Ảnh URL" />
          </View>
          <View style={styles.formVat}>
            <Input value={createForm.vatInput} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, vatInput: value.replace(/[^\d.]/g, "") }))} keyboardType="decimal-pad" placeholder="VAT %" />
          </View>
        </View>

        <Input multiline numberOfLines={4} value={createForm.shortDescription} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, shortDescription: value }))} placeholder="Mô tả ngắn" />

        <View style={styles.uploadBox}>
          <View style={styles.uploadHeader}>
            <View style={styles.uploadInfo}>
              <Feather name="image" size={16} color={palette.sub} />
              <View>
                <Text style={styles.uploadTitle}>Đưa lên lookbook</Text>
                <Text style={styles.uploadSubtitle}>{createForm.imageUrl ? "Đã có ảnh preview" : "Chưa có ảnh preview"}</Text>
              </View>
            </View>
            <View style={styles.uploadActions}>
              <Badge active={createForm.featuredInLookbook} label="Bật" onPress={() => setCreateForm((prev) => ({ ...prev, featuredInLookbook: !prev.featuredInLookbook }))} />
              <Pressable style={styles.uploadButton} onPress={() => void pickCreateImage()}>
                {uploadingCreateImage ? <ActivityIndicator size="small" color={palette.sub} /> : <Text style={styles.uploadButtonText}>Upload ảnh</Text>}
              </Pressable>
            </View>
          </View>
          {createForm.imageUrl ? (
            <View style={styles.previewRow}>
              <Image source={{ uri: createForm.imageUrl }} style={styles.previewThumb} />
              <Text style={styles.previewText}>Ảnh sẽ dùng cho lookbook/landing.</Text>
            </View>
          ) : null}
        </View>

        <Pressable disabled={submitting} style={[styles.primaryButton, submitting ? styles.primaryButtonDisabled : null]} onPress={() => void submitCreate()}>
          <Text style={styles.primaryButtonText}>{submitting ? "Đang thêm dịch vụ..." : "Thêm dịch vụ"}</Text>
        </Pressable>
      </View>

      {error ? <View style={styles.errorCard}><Feather name="alert-circle" size={16} color={palette.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}

      <View style={styles.linksCard}>
        <View style={styles.toggleRow}>
          <Badge active={visibleSection === "services"} label={`Dịch vụ (${serviceCount})`} onPress={() => setVisibleSection("services")} />
          <Badge active={visibleSection === "lookbook"} label={`Lookbook (${lookbookCount})`} onPress={() => setVisibleSection("lookbook")} />
          <Badge active={visibleSection === "trash"} label={`Thùng rác (${trashRows.length})`} onPress={() => setVisibleSection("trash")} />
        </View>
        <Input value={search} onChangeText={setSearch} placeholder="Tìm tên hoặc mô tả" />
      </View>

      <View style={styles.listCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeadingWrap}>
            <Feather name={visibleSection === "services" ? "folder" : visibleSection === "lookbook" ? "image" : "trash-2"} size={16} color={visibleSection === "lookbook" ? palette.warning : visibleSection === "trash" ? palette.success : palette.info} />
            <Text style={styles.sectionTitle}>{visibleSection === "services" ? "Dịch vụ" : visibleSection === "lookbook" ? "Mẫu lookbook" : "Thùng rác"}</Text>
          </View>
          <Text style={styles.sectionCount}>{visibleRows.length}</Text>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.emptyText}>Đang tải dữ liệu dịch vụ...</Text>
          </View>
        ) : visibleRows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{visibleSection === "trash" ? "Thùng rác đang trống." : "Không có mục nào khớp bộ lọc hiện tại."}</Text>
          </View>
        ) : visibleSection === "trash" ? (
          <View style={styles.listStack}>
            {filteredTrash.map((item) => (
              <TrashRowCard key={item.id} item={item} onDeleteForever={() => confirmDeleteForever(item)} onRestore={() => void restoreFromTrash(item)} saving={submitting} />
            ))}
          </View>
        ) : (
          <View style={styles.listStack}>
            {(visibleSection === "services" ? filteredServices : filteredLookbook).map((item) => (
              <ServiceRowCard
                key={item.id}
                editing={editingId === item.id}
                form={editingId === item.id ? editForm : null}
                item={item}
                onCancelEdit={() => { setEditingId(null); setEditForm(null); }}
                onChange={(patch) => setEditForm((prev) => (prev ? { ...prev, ...patch } : prev))}
                onMoveToTrash={() => confirmMoveToTrash(item)}
                onPickImage={() => void pickEditImage()}
                onSave={() => void saveEdit()}
                onStartEdit={() => startEdit(item)}
                saving={submitting || uploadingEditImage}
              />
            ))}
          </View>
        )}
      </View>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  ...manageStyles,
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: palette.text,
  },
  sectionCount: {
    minWidth: 24,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: palette.sub,
    textAlign: "right",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    width: "48.5%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FCFAF8",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  metricValue: {
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
  },
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
  },
  formFlex: {
    flex: 1,
  },
  formPrice: {
    width: 96,
  },
  formDuration: {
    width: 72,
  },
  formVat: {
    width: 82,
  },
  input: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 18,
    color: palette.text,
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  uploadBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: "dashed",
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  uploadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  uploadInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  uploadTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: palette.text,
  },
  uploadSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.sub,
  },
  uploadActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeActive: {
    backgroundColor: palette.accentSoft,
    borderColor: "#D9BA9A",
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.sub,
  },
  badgeTextActive: {
    color: palette.accent,
  },
  uploadButton: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.sub,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EDE6DE",
  },
  previewText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: palette.sub,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1D5CA",
    backgroundColor: palette.dangerSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: palette.danger,
  },
  linksCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  listCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: "dashed",
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 16,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.sub,
    textAlign: "center",
  },
  listStack: {
    gap: 12,
  },
  serviceCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  serviceHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  serviceIdentity: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  serviceThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  serviceThumbFallback: {
    backgroundColor: palette.mutedSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceCopy: {
    flex: 1,
    gap: 4,
  },
  serviceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  serviceTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: palette.text,
  },
  serviceSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.sub,
  },
  statePill: {
    minHeight: 20,
    borderRadius: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statePillText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
  },
  lookbookPill: {
    backgroundColor: palette.warningSoft,
  },
  lookbookPillText: {
    color: palette.warning,
  },
  activePill: {
    backgroundColor: palette.successSoft,
  },
  activePillText: {
    color: palette.success,
  },
  inactivePill: {
    backgroundColor: palette.mutedSoft,
  },
  inactivePillText: {
    color: palette.sub,
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconButtonDanger: {
    borderColor: "#F1D5CA",
    backgroundColor: palette.dangerSoft,
  },
  headerIconButtonPrimary: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  headerIconButtonDisabled: {
    opacity: 0.55,
  },
  editPanel: {
    borderRadius: 16,
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  editNameInput: {
    minHeight: 40,
    paddingVertical: 10,
  },
  threeColRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  uploadPill: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  uploadPillText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.sub,
  },
  serviceMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaChip: {
    minHeight: 24,
    borderRadius: 12,
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  metaChipText: {
    fontSize: 11,
    lineHeight: 14,
    color: "#695D52",
    fontWeight: "600",
  },
  trashCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  trashActions: {
    flexDirection: "row",
    gap: 10,
  },
  restoreButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  restoreButtonText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.sub,
  },
  deleteForeverButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1D5CA",
    backgroundColor: palette.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteForeverButtonText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.danger,
  },
});
