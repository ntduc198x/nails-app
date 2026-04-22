import { Redirect, router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { formatViDateTime } from "@nails/shared";
import { MasonryGrid, type MasonryItem } from "@/src/components/masonry-grid";
import { useGuestBooking } from "@/src/hooks/use-guest-booking";
import { type LookbookService, useLookbookServices } from "@/src/hooks/use-lookbook-services";
import { SessionActions, useSession } from "@/src/providers/session-provider";

const FALLBACK_SERVICES: LookbookService[] = [
  {
    id: "luxury-gel",
    title: "Luxury Gel",
    blurb: "Form mong toi gian, nen den bong va chi tiet da beo hien dai.",
    tone: "Nhe nhang",
    price: "350.000d",
    image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1200",
    aspectRatio: 1.28,
  },
  {
    id: "nail-art-design",
    title: "Nail Art Design",
    blurb: "Phoi mau xam bac va white milk cho layout sang trong, sang da.",
    tone: "Noi bat",
    price: "500.000d",
    image: "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?q=80&w=1200",
    aspectRatio: 0.98,
  },
  {
    id: "nail-han-quoc",
    title: "Nail Han Quoc",
    blurb: "Base nude trong veo, diem nhan phu kien kim loai nho va sang.",
    tone: "Nhe nhang",
    price: "400.000d",
    image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=1200",
    aspectRatio: 1.16,
  },
  {
    id: "french-chic",
    title: "French Chic",
    blurb: "French mong va gam beige hong, hop hen ho va di lam moi ngay.",
    tone: "Sang trong",
    price: "300.000d",
    image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=1200",
    aspectRatio: 1.24,
  },
  {
    id: "matcha-mood",
    title: "Matcha Mood",
    blurb: "Gam xanh olive mix sticker mini cho bo mong ca tinh nhung van mem.",
    tone: "Ca tinh",
    price: "380.000d",
    image: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?q=80&w=1200",
    aspectRatio: 1.06,
  },
  {
    id: "milky-glow",
    title: "Milky Glow",
    blurb: "Overlay anh ngoc trai va nhung diem nhan nho cho da tay sang hon.",
    tone: "Don gian",
    price: "320.000d",
    image: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?q=80&w=1200",
    aspectRatio: 1.14,
  },
];

const CATEGORY_ITEMS = [
  { key: "all", label: "Tat ca" },
  { key: "don-gian", label: "Nail don gian" },
  { key: "sang-trong", label: "Nail sang trong" },
  { key: "ca-tinh", label: "Nail ca tinh" },
  { key: "noi-bat", label: "Nail noi bat" },
] as const;

const QUICK_CONTACTS = [
  {
    label: "Hotline",
    value: "0916 080 398",
    actionLabel: "Goi",
    onPress: () => void Linking.openURL("tel:0916080398"),
  },
  {
    label: "Messenger",
    value: "m.me/chambeautyyy",
    actionLabel: "Chat",
    onPress: () => void Linking.openURL("https://m.me/chambeautyyy"),
  },
] as const;

function formatBookingSlot(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return "Chon ngay gio phu hop";
  return formatViDateTime(`${dateValue}T${timeValue}:00`);
}

function matchesCategory(service: LookbookService, category: (typeof CATEGORY_ITEMS)[number]["key"]) {
  if (category === "all") return true;

  const haystack = `${service.title} ${service.tone} ${service.blurb}`.toLowerCase();

  if (category === "don-gian") {
    return haystack.includes("nhe nhang") || haystack.includes("don gian") || haystack.includes("milky");
  }

  if (category === "sang-trong") {
    return haystack.includes("sang trong") || haystack.includes("french") || haystack.includes("luxury");
  }

  if (category === "ca-tinh") {
    return haystack.includes("ca tinh") || haystack.includes("olive") || haystack.includes("matcha");
  }

  if (category === "noi-bat") {
    return haystack.includes("noi bat") || haystack.includes("art") || haystack.includes("design");
  }

  return true;
}

type ServiceCardProps = {
  item: LookbookService;
  onPress: () => void;
  onLongPress: () => void;
};

function ServiceCard({ item, onPress, onLongPress }: ServiceCardProps) {
  return (
    <Pressable style={styles.serviceCard} onPress={onPress} onLongPress={onLongPress}>
      <Image source={{ uri: item.image }} alt={item.title} style={[styles.serviceImage, { aspectRatio: item.aspectRatio ?? 1.15 }]} />

      <View style={styles.serviceBody}>
        <View style={styles.serviceHeading}>
          <Text numberOfLines={1} style={styles.serviceTitle}>
            {item.title}
          </Text>
          <Text style={styles.servicePrice}>{item.price}</Text>
        </View>

        <View style={styles.serviceFooter}>
          <View style={styles.authorRow}>
            <View style={styles.authorAvatar}>
              <Text style={styles.authorAvatarText}>C</Text>
            </View>
            <Text style={styles.authorText}>Cham Beauty</Text>
          </View>
          <Text style={styles.moreText}>...</Text>
        </View>
      </View>
    </Pressable>
  );
}

type BookingModalProps = {
  isSubmitting: boolean;
  isVisible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  fieldErrors: ReturnType<typeof useGuestBooking>["fieldErrors"];
  successResult: ReturnType<typeof useGuestBooking>["successResult"];
  submitError: string | null;
  updateValue: ReturnType<typeof useGuestBooking>["updateValue"];
  values: ReturnType<typeof useGuestBooking>["values"];
  timeSlots: string[];
  dateOptions: Array<{ value: string; label: string }>;
};

function BookingModal({
  dateOptions,
  fieldErrors,
  isSubmitting,
  isVisible,
  onClose,
  onSubmit,
  successResult,
  submitError,
  timeSlots,
  updateValue,
  values,
}: BookingModalProps) {
  const slotLabel = useMemo(
    () => formatBookingSlot(values.selectedDate, values.selectedTime),
    [values.selectedDate, values.selectedTime]
  );

  return (
    <Modal animationType="slide" transparent visible={isVisible} onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismissArea} onPress={onClose} />
        <View style={styles.sheetCard}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Text style={styles.sheetEyebrow}>Dat lich nhanh</Text>
              <Text style={styles.sheetTitle}>{values.requestedService || "Chon mau nail ban muon lam"}</Text>
              <Text style={styles.sheetSubtitle}>{slotLabel}</Text>
            </View>
            <Pressable style={styles.sheetCloseButton} onPress={onClose}>
              <Text style={styles.sheetCloseText}>Dong</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            {successResult ? (
              <View style={styles.successCard}>
                <Text style={styles.successTitle}>Da gui yeu cau thanh cong</Text>
                <Text style={styles.successText}>{slotLabel}</Text>
                <Text style={styles.successId}>{successResult.bookingRequestId ?? "Dang dong bo yeu cau"}</Text>
                <Pressable style={styles.submitButton} onPress={onClose}>
                  <Text style={styles.submitButtonText}>Xong</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.inlinePickerGroup}>
                  <Text style={styles.inlinePickerLabel}>Ngay</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineChipsRow}>
                    {dateOptions.map((option) => {
                      const active = option.value === values.selectedDate;
                      return (
                        <Pressable
                          key={option.value}
                          style={[styles.inlineChip, active ? styles.inlineChipActive : null]}
                          onPress={() => updateValue("selectedDate", option.value)}
                        >
                          <Text style={[styles.inlineChipText, active ? styles.inlineChipTextActive : null]}>{option.label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {fieldErrors.selectedDate ? <Text style={styles.errorText}>{fieldErrors.selectedDate}</Text> : null}
                </View>

                <View style={styles.inlinePickerGroup}>
                  <Text style={styles.inlinePickerLabel}>Gio</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineChipsRow}>
                    {timeSlots.map((slot) => {
                      const active = slot === values.selectedTime;
                      return (
                        <Pressable
                          key={slot}
                          style={[styles.inlineChip, active ? styles.inlineChipActive : null]}
                          onPress={() => updateValue("selectedTime", slot)}
                        >
                          <Text style={[styles.inlineChipText, active ? styles.inlineChipTextActive : null]}>{slot}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {fieldErrors.selectedTime ? <Text style={styles.errorText}>{fieldErrors.selectedTime}</Text> : null}
                </View>

                <TextInput
                  placeholder="Ten khach hang"
                  placeholderTextColor="#a19182"
                  style={styles.sheetInput}
                  value={values.customerName}
                  onChangeText={(value) => updateValue("customerName", value)}
                />
                {fieldErrors.customerName ? <Text style={styles.errorText}>{fieldErrors.customerName}</Text> : null}

                <TextInput
                  keyboardType="phone-pad"
                  placeholder="So dien thoai"
                  placeholderTextColor="#a19182"
                  style={styles.sheetInput}
                  value={values.customerPhone}
                  onChangeText={(value) => updateValue("customerPhone", value)}
                />
                {fieldErrors.customerPhone ? <Text style={styles.errorText}>{fieldErrors.customerPhone}</Text> : null}

                <TextInput
                  placeholder="Nhan vien uu tien"
                  placeholderTextColor="#a19182"
                  style={styles.sheetInput}
                  value={values.preferredStaff}
                  onChangeText={(value) => updateValue("preferredStaff", value)}
                />

                <TextInput
                  multiline
                  numberOfLines={4}
                  placeholder="Mau sac, form mong, luu y dac biet..."
                  placeholderTextColor="#a19182"
                  style={[styles.sheetInput, styles.sheetTextarea]}
                  textAlignVertical="top"
                  value={values.note}
                  onChangeText={(value) => updateValue("note", value)}
                />

                <View style={styles.contactQuickGrid}>
                  {QUICK_CONTACTS.map((item) => (
                    <Pressable key={item.label} style={styles.contactQuickCard} onPress={item.onPress}>
                      <Text style={styles.contactQuickLabel}>{item.label}</Text>
                      <Text style={styles.contactQuickValue}>{item.value}</Text>
                      <Text style={styles.contactQuickAction}>{item.actionLabel}</Text>
                    </Pressable>
                  ))}
                </View>

                {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

                <Pressable disabled={isSubmitting} style={styles.submitButton} onPress={onSubmit}>
                  <Text style={styles.submitButtonText}>{isSubmitting ? "Dang gui..." : "Gui yeu cau"}</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function CustomerHomeScreen() {
  const { role, user } = useSession();
  const { dateOptions, fieldErrors, isSubmitting, reset, submit, submitError, successResult, timeSlots, updateValue, values } =
    useGuestBooking();
  const { isLoading, refresh, services, source } = useLookbookServices(FALLBACK_SERVICES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORY_ITEMS)[number]["key"]>("all");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isBookingModalVisible, setIsBookingModalVisible] = useState(false);
  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return services.filter((service) => {
      const haystack = `${service.title} ${service.blurb} ${service.tone}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesQuery && matchesCategory(service, activeCategory);
    });
  }, [activeCategory, searchQuery, services]);

  if (role) {
    return <Redirect href="/(admin)" />;
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }

  function openBookingForService(service?: LookbookService) {
    if (service) {
      updateValue("requestedService", service.title);
      updateValue("note", values.note || service.blurb);
    }

    setIsBookingModalVisible(true);
  }

  async function handleSubmitBooking() {
    await submit();
  }

  function handleCloseBooking() {
    if (successResult) {
      reset();
    }
    setIsBookingModalVisible(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void handleRefresh()}
              tintColor="#3b2d23"
              colors={["#3b2d23"]}
              progressBackgroundColor="#fffaf4"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.brandText}>CHAM BEAUTY</Text>
            <Text style={styles.headerMeta}>
              {isLoading ? "Dang tai feed..." : `${filteredServices.length} mau nail`}
              {source === "fallback" ? " · local" : ""}
            </Text>
          </View>

          <View style={styles.searchShell}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              placeholder="Tim kiem mau nail, mau sac..."
              placeholderTextColor="#b4a89b"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Pressable style={styles.searchFilterButton} onPress={() => setActiveCategory("all")}>
              <Text style={styles.searchFilterText}>≋</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {CATEGORY_ITEMS.map((item) => {
              const active = item.key === activeCategory;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.filterChip, active ? styles.filterChipActive : null]}
                  onPress={() => setActiveCategory(item.key)}
                >
                  <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <MasonryGrid
            data={filteredServices as readonly (MasonryItem & LookbookService)[]}
            onItemLongPress={(item) => setLightboxImage(item.image)}
            renderItem={(item) => (
              <ServiceCard item={item as LookbookService} onPress={() => openBookingForService(item as LookbookService)} onLongPress={() => setLightboxImage(item.image)} />
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Khong tim thay mau phu hop</Text>
                <Text style={styles.emptyText}>Thu doi tu khoa tim kiem hoac chuyen sang nhom filter khac.</Text>
              </View>
            }
          />
        </ScrollView>

        <View style={styles.bottomBar}>
          <Pressable style={styles.bottomItem}>
            <Text style={[styles.bottomIcon, styles.bottomIconActive]}>⌂</Text>
            <Text style={[styles.bottomLabel, styles.bottomLabelActive]}>Trang chu</Text>
          </Pressable>

          <Pressable style={styles.bottomItem} onPress={() => setActiveCategory("noi-bat")}>
            <Text style={styles.bottomIcon}>⌗</Text>
            <Text style={styles.bottomLabel}>Kham pha</Text>
          </Pressable>

          <Pressable style={styles.plusButton} onPress={() => openBookingForService()}>
            <Text style={styles.plusButtonText}>+</Text>
          </Pressable>

          <Pressable style={styles.bottomItem} onPress={() => openBookingForService()}>
            <Text style={styles.bottomIcon}>⌚</Text>
            <Text style={styles.bottomLabel}>Dat lich</Text>
          </Pressable>

          <Pressable style={styles.bottomItem} onPress={() => (user ? setIsAccountModalVisible(true) : router.push("/(auth)/sign-in"))}>
            <Text style={styles.bottomIcon}>◌</Text>
            <Text style={styles.bottomLabel}>Ca nhan</Text>
          </Pressable>
        </View>
      </View>

      <BookingModal
        dateOptions={dateOptions}
        fieldErrors={fieldErrors}
        isSubmitting={isSubmitting}
        isVisible={isBookingModalVisible}
        onClose={handleCloseBooking}
        onSubmit={() => void handleSubmitBooking()}
        successResult={successResult}
        submitError={submitError}
        timeSlots={timeSlots}
        updateValue={updateValue}
        values={values}
      />

      <Modal animationType="slide" transparent visible={isAccountModalVisible} onRequestClose={() => setIsAccountModalVisible(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetDismissArea} onPress={() => setIsAccountModalVisible(false)} />
          <View style={styles.accountSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>Tai khoan</Text>
            {user ? (
              <SessionActions />
            ) : (
              <Pressable style={styles.submitButton} onPress={() => router.push("/(auth)/sign-in")}>
                <Text style={styles.submitButtonText}>Dang nhap</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!lightboxImage} transparent animationType="fade" onRequestClose={() => setLightboxImage(null)}>
        <View style={styles.lightboxBackdrop}>
          <Pressable style={styles.lightboxDismiss} onPress={() => setLightboxImage(null)}>
            <Text style={styles.lightboxDismissText}>Dong</Text>
          </Pressable>
          {lightboxImage ? (
            <Image source={{ uri: lightboxImage }} alt="Anh lookbook phong to" style={styles.lightboxImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff9f2",
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 18,
  },
  header: {
    gap: 4,
  },
  brandText: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 2.4,
    color: "#2e241e",
  },
  headerMeta: {
    fontSize: 13,
    color: "#9a8b7b",
    fontWeight: "600",
  },
  searchShell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#fbf3e9",
    borderWidth: 1,
    borderColor: "#e8d9c9",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchIcon: {
    fontSize: 22,
    color: "#3b2d23",
  },
  searchInput: {
    flex: 1,
    color: "#2e241e",
    fontSize: 16,
    paddingVertical: 4,
  },
  searchFilterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fffaf4",
    borderWidth: 1,
    borderColor: "#eadbc9",
  },
  searchFilterText: {
    fontSize: 20,
    color: "#3b2d23",
    marginTop: -1,
  },
  filterRow: {
    gap: 10,
    paddingRight: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#fffaf4",
    borderWidth: 1,
    borderColor: "#eadbc9",
  },
  filterChipActive: {
    backgroundColor: "#3b2d23",
    borderColor: "#3b2d23",
  },
  filterChipText: {
    color: "#6f5d4c",
    fontSize: 14,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#fffaf4",
  },
  serviceCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#efdfd1",
  },
  serviceImage: {
    width: "100%",
    backgroundColor: "#efe3d5",
  },
  serviceBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  serviceHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  serviceTitle: {
    flex: 1,
    color: "#2e241e",
    fontSize: 15,
    fontWeight: "800",
  },
  servicePrice: {
    color: "#a06e44",
    fontSize: 13,
    fontWeight: "800",
  },
  serviceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#3b2d23",
    alignItems: "center",
    justifyContent: "center",
  },
  authorAvatarText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  authorText: {
    color: "#6f5d4c",
    fontSize: 13,
    fontWeight: "600",
  },
  moreText: {
    color: "#3b2d23",
    fontSize: 22,
    lineHeight: 22,
  },
  emptyState: {
    marginTop: 28,
    borderRadius: 22,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#efdfd1",
    padding: 22,
    gap: 8,
  },
  emptyTitle: {
    color: "#2e241e",
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    color: "#857565",
    fontSize: 14,
    lineHeight: 20,
  },
  bottomBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 34,
    backgroundColor: "#fffaf4",
    borderWidth: 1,
    borderColor: "#eadbc9",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bottomItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 58,
  },
  bottomIcon: {
    fontSize: 20,
    color: "#8a7b6b",
    fontWeight: "700",
  },
  bottomIconActive: {
    color: "#2e241e",
  },
  bottomLabel: {
    color: "#8a7b6b",
    fontSize: 11,
    fontWeight: "600",
  },
  bottomLabelActive: {
    color: "#2e241e",
    fontWeight: "700",
  },
  plusButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3b2d23",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -26,
  },
  plusButtonText: {
    color: "#fffaf4",
    fontSize: 36,
    lineHeight: 38,
    fontWeight: "400",
    marginTop: -2,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(34, 26, 20, 0.35)",
    justifyContent: "flex-end",
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheetCard: {
    maxHeight: "88%",
    backgroundColor: "#fffaf4",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
  },
  accountSheet: {
    backgroundColor: "#fffaf4",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 54,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#ddcbbb",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  sheetHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sheetEyebrow: {
    color: "#9c6f48",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sheetTitle: {
    color: "#2e241e",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
  },
  sheetSubtitle: {
    color: "#7e6d5b",
    fontSize: 14,
    fontWeight: "600",
  },
  sheetCloseButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#f4eadf",
  },
  sheetCloseText: {
    color: "#3b2d23",
    fontWeight: "700",
  },
  sheetContent: {
    paddingTop: 18,
    gap: 14,
  },
  inlinePickerGroup: {
    gap: 10,
  },
  inlinePickerLabel: {
    color: "#2e241e",
    fontSize: 14,
    fontWeight: "800",
  },
  inlineChipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  inlineChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eadbc9",
  },
  inlineChipActive: {
    backgroundColor: "#3b2d23",
    borderColor: "#3b2d23",
  },
  inlineChipText: {
    color: "#6f5d4c",
    fontSize: 13,
    fontWeight: "700",
  },
  inlineChipTextActive: {
    color: "#fffaf4",
  },
  sheetInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eadbc9",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#2e241e",
    fontSize: 15,
  },
  sheetTextarea: {
    minHeight: 112,
  },
  contactQuickGrid: {
    flexDirection: "row",
    gap: 10,
  },
  contactQuickCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#3b2d23",
    padding: 14,
    gap: 5,
  },
  contactQuickLabel: {
    color: "#cdb79f",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  contactQuickValue: {
    color: "#fffaf4",
    fontSize: 14,
    fontWeight: "700",
  },
  contactQuickAction: {
    color: "#f0d5b7",
    fontSize: 13,
    fontWeight: "700",
  },
  submitButton: {
    borderRadius: 18,
    backgroundColor: "#3b2d23",
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  submitButtonText: {
    color: "#fffaf4",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
  },
  successCard: {
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eadbc9",
    padding: 18,
    gap: 10,
  },
  successTitle: {
    color: "#2e241e",
    fontSize: 20,
    fontWeight: "800",
  },
  successText: {
    color: "#6f5d4c",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  successId: {
    color: "#9c6f48",
    fontSize: 13,
    fontWeight: "700",
  },
  errorText: {
    color: "#c54b47",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 12, 8, 0.88)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  lightboxDismiss: {
    position: "absolute",
    top: 52,
    right: 18,
    zIndex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  lightboxDismissText: {
    color: "#fff",
    fontWeight: "700",
  },
  lightboxImage: {
    width: "100%",
    height: "72%",
    borderRadius: 24,
  },
});
