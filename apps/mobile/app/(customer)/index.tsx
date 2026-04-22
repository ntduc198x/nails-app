import { Redirect, router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { useGuestBooking } from "@/src/hooks/use-guest-booking";
import { type LookbookService, useLookbookServices } from "@/src/hooks/use-lookbook-services";
import { SessionActions, useSession } from "@/src/providers/session-provider";

const FALLBACK_SERVICES: LookbookService[] = [
  {
    id: "luxury-gel",
    title: "Luxury Gel",
    blurb: "Son gel cao cap, bong sach va gon tay.",
    tone: "Nhe nhang",
    price: "350.000d",
    image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1200",
  },
  {
    id: "nail-art-design",
    title: "Nail Art Design",
    blurb: "Set ve noi bat cho tiec, su kien va lookbook mua he.",
    tone: "Noi bat",
    price: "500.000d",
    image: "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?q=80&w=1200",
  },
  {
    id: "spa-care",
    title: "Spa & Care",
    blurb: "Cham da tay chan, duong am va phuc hoi sau khi lam mong.",
    tone: "Thu gian",
    price: "400.000d",
    image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=1200",
  },
  {
    id: "go-mong",
    title: "Go mong & Cham soc",
    blurb: "Reset bo mong gon gang truoc khi vao set moi.",
    tone: "Phuc hoi",
    price: "250.000d",
    image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=1200",
  },
];

const NAV_ITEMS = [
  { key: "services", label: "Dich vu" },
  { key: "booking", label: "Dat lich" },
  { key: "contact", label: "Lien he" },
] as const;

const CONTACT_ITEMS = [
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
  {
    label: "Instagram",
    value: "@cham.beautyy",
    actionLabel: "Xem",
    onPress: () => void Linking.openURL("https://www.instagram.com/cham.beautyy/"),
  },
];

const HERO_LINES = [
  "Moi bo mong deu duoc cham chut de hop voi gu rieng cua ban.",
  "Tinh te trong tung chi tiet, nhe nhang nhung van that sang.",
  "Dat lich nhanh, den dung hen va roi ve voi bo mong that dep.",
];

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function formatBookingSlot(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return "Chon ngay gio phu hop";
  return formatViDateTime(`${dateValue}T${timeValue}:00`);
}

export default function CustomerHomeScreen() {
  const { role, user } = useSession();
  const { dateOptions, fieldErrors, isSubmitting, reset, submit, submitError, successResult, timeSlots, updateValue, values } =
    useGuestBooking();
  const { isLoading: lookbookLoading, refresh: refreshLookbook, services: lookbookServices, source: lookbookSource } =
    useLookbookServices(FALLBACK_SERVICES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<(typeof NAV_ITEMS)[number]["key"]>("services");
  const [activeLookbookIndex, setActiveLookbookIndex] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const lookbookScrollerRef = useRef<ScrollView | null>(null);
  const [sectionOffsets, setSectionOffsets] = useState<Record<string, number>>({});
  const slotLabel = useMemo(() => formatBookingSlot(values.selectedDate, values.selectedTime), [values.selectedDate, values.selectedTime]);
  const selectedService = useMemo(
    () => lookbookServices.find((service) => service.title === values.requestedService),
    [lookbookServices, values.requestedService]
  );
  const serviceLabel = selectedService?.title ?? values.requestedService ?? "";
  const safeActiveLookbookIndex = Math.min(activeLookbookIndex, Math.max(lookbookServices.length - 1, 0));

  if (role) {
    return <Redirect href="/(admin)" />;
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refreshLookbook();
    } finally {
      setIsRefreshing(false);
    }
  }

  const registerSection =
    (key: string) =>
    (event: LayoutChangeEvent) => {
      const nextY = event.nativeEvent.layout.y;
      setSectionOffsets((current) => (current[key] === nextY ? current : { ...current, [key]: nextY }));
    };

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const currentY = event.nativeEvent.contentOffset.y + 180;
    const candidates = NAV_ITEMS.map((item) => ({
      key: item.key,
      y: sectionOffsets[item.key] ?? Number.POSITIVE_INFINITY,
    }))
      .filter((item) => Number.isFinite(item.y))
      .sort((left, right) => left.y - right.y);

    let current: { key: string; y: number } | undefined;
    for (const candidate of candidates) {
      if (candidate.y <= currentY) {
        current = candidate;
        continue;
      }
      break;
    }

    if (current && current.key !== activeSection) {
      setActiveSection(current.key as (typeof NAV_ITEMS)[number]["key"]);
    }
  }

  function jumpToSection(key: (typeof NAV_ITEMS)[number]["key"]) {
    setActiveSection(key);
    scrollRef.current?.scrollTo({
      y: Math.max(0, (sectionOffsets[key] ?? 0) - 18),
      animated: true,
    });
  }

  function handleLookbookScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const cardWidth = 296 + 14;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
    setActiveLookbookIndex(Math.max(0, Math.min(lookbookServices.length - 1, nextIndex)));
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void handleRefresh()}
              tintColor="#2f241d"
              colors={["#2f241d"]}
              progressBackgroundColor="#fffaf5"
            />
          }
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroShell}>
            <View style={styles.heroGlowLarge} />
            <View style={styles.heroGlowSmall} />
            <Text style={styles.heroEyebrow}>Cham Beauty</Text>
            <Text style={styles.heroTitle}>Nail studio nhe nhang, tinh te va dung chat rieng cua ban.</Text>

            <View style={styles.heroMessageStack}>
              {HERO_LINES.map((line) => (
                <View key={line} style={styles.heroMessagePill}>
                  <Text style={styles.heroMessageText}>{line}</Text>
                </View>
              ))}
            </View>

            <View style={styles.quickNavBar}>
              {NAV_ITEMS.map((item) => {
                const active = item.key === activeSection;
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.quickNavChip, active ? styles.quickNavChipActive : null]}
                    onPress={() => jumpToSection(item.key)}
                  >
                    <Text style={[styles.quickNavChipText, active ? styles.quickNavChipTextActive : null]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {successResult ? (
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>Yeu cau dat lich da duoc gui</Text>
              <Text style={styles.successSlot}>{slotLabel}</Text>
              <Text style={styles.successId}>{successResult.bookingRequestId ?? "Dang dong bo yeu cau"}</Text>

              <Pressable style={styles.primaryButton} onPress={reset}>
                <Text style={styles.primaryButtonText}>Tao yeu cau moi</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View onLayout={registerSection("services")} style={styles.panelCard}>
                <SectionTitle title="Dich vu lookbook" />

                <ScrollView
                  ref={lookbookScrollerRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={310}
                  decelerationRate="fast"
                  onScroll={handleLookbookScroll}
                  scrollEventThrottle={16}
                  contentContainerStyle={styles.lookbookRow}
                >
                  {lookbookServices.map((service) => {
                    const active = values.requestedService === service.title;

                    return (
                      <View key={service.id} style={[styles.lookbookCard, active ? styles.lookbookCardActive : null]}>
                        <Pressable onPress={() => setLightboxImage(service.image)}>
                          <Image source={{ uri: service.image }} alt={service.title} style={styles.lookbookImage} resizeMode="cover" />
                          <View style={styles.lookbookImageOverlay}>
                            <Text style={styles.lookbookTone}>{service.tone}</Text>
                            <Text style={styles.lookbookZoom}>Xem lon</Text>
                          </View>
                        </Pressable>

                        <View style={styles.lookbookBody}>
                          <View style={styles.lookbookHeader}>
                            <Text style={styles.lookbookTitle}>{service.title}</Text>
                            <Text style={styles.lookbookPrice}>{service.price}</Text>
                          </View>
                          <Text style={styles.lookbookDescription}>{service.blurb}</Text>

                          <Pressable
                            style={[styles.lookbookSelectButton, active ? styles.lookbookSelectButtonActive : null]}
                            onPress={() => {
                              updateValue("requestedService", active ? "" : service.title);
                              jumpToSection("booking");
                            }}
                          >
                            <Text style={[styles.lookbookSelectButtonText, active ? styles.lookbookSelectButtonTextActive : null]}>
                              {active ? "Da chon mau nay" : "Chon mau nay"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={styles.lookbookFooter}>
                  <View style={styles.lookbookDots}>
                    {lookbookServices.map((service, index) => (
                      <View key={service.id} style={[styles.lookbookDot, index === safeActiveLookbookIndex ? styles.lookbookDotActive : null]} />
                    ))}
                  </View>
                  <Text style={styles.lookbookMetaText}>
                    {lookbookLoading ? "Dang tai lookbook..." : lookbookSource === "fallback" ? "Dang hien fallback local" : "Dang hien du lieu tu DB"}
                  </Text>
                </View>
              </View>

              <View onLayout={registerSection("booking")} style={styles.panelCard}>
                <SectionTitle title="Dat lich" />

                <View style={styles.selectionStrip}>
                  <View style={styles.selectionCard}>
                    <Text style={styles.selectionValue}>{serviceLabel || "Chua chon mau dich vu"}</Text>
                  </View>
                  <View style={styles.selectionCard}>
                    <Text style={styles.selectionValue}>{slotLabel}</Text>
                  </View>
                </View>

                <View style={styles.scheduleHeaderRow}>
                  <Text style={styles.scheduleTitle}>Ngay gio</Text>
                  <Pressable style={styles.scheduleToggleButton} onPress={() => setScheduleExpanded((current) => !current)}>
                    <Text style={styles.scheduleToggleButtonText}>{scheduleExpanded ? "Thu gon" : "Mo lich hen"}</Text>
                  </Pressable>
                </View>

                {scheduleExpanded ? (
                  <View style={styles.schedulePanel}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.compactDateRow}
                    >
                      {dateOptions.map((option) => {
                        const active = values.selectedDate === option.value;
                        return (
                          <Pressable
                            key={option.value}
                            style={[styles.compactDateChip, active ? styles.compactDateChipActive : null]}
                            onPress={() => updateValue("selectedDate", option.value)}
                          >
                            <Text style={[styles.compactDateChipText, active ? styles.compactDateChipTextActive : null]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    {fieldErrors.selectedDate ? <Text style={styles.errorText}>{fieldErrors.selectedDate}</Text> : null}

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.compactTimeRow}
                    >
                      {timeSlots.map((slot) => {
                        const active = values.selectedTime === slot;
                        return (
                          <Pressable
                            key={slot}
                            style={[styles.compactTimeChip, active ? styles.compactTimeChipActive : null]}
                            onPress={() => updateValue("selectedTime", slot)}
                          >
                            <Text style={[styles.compactTimeChipText, active ? styles.compactTimeChipTextActive : null]}>{slot}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    {fieldErrors.selectedTime ? <Text style={styles.errorText}>{fieldErrors.selectedTime}</Text> : null}
                  </View>
                ) : null}

                <TextInput
                  placeholder="Ten khach hang"
                  placeholderTextColor="#8f7d6c"
                  style={styles.input}
                  value={values.customerName}
                  onChangeText={(value) => updateValue("customerName", value)}
                />
                {fieldErrors.customerName ? <Text style={styles.errorText}>{fieldErrors.customerName}</Text> : null}

                <TextInput
                  keyboardType="phone-pad"
                  placeholder="So dien thoai"
                  placeholderTextColor="#8f7d6c"
                  style={styles.input}
                  value={values.customerPhone}
                  onChangeText={(value) => updateValue("customerPhone", value)}
                />
                {fieldErrors.customerPhone ? <Text style={styles.errorText}>{fieldErrors.customerPhone}</Text> : null}

                <TextInput
                  placeholder="Nhan vien uu tien"
                  placeholderTextColor="#8f7d6c"
                  style={styles.input}
                  value={values.preferredStaff}
                  onChangeText={(value) => updateValue("preferredStaff", value)}
                />

                <TextInput
                  multiline
                  numberOfLines={4}
                  placeholder="Mau sac, nail art, luu y dac biet..."
                  placeholderTextColor="#8f7d6c"
                  style={[styles.input, styles.noteInput]}
                  textAlignVertical="top"
                  value={values.note}
                  onChangeText={(value) => updateValue("note", value)}
                />

                {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

                <Pressable disabled={isSubmitting} style={styles.primaryButton} onPress={() => void submit()}>
                  <Text style={styles.primaryButtonText}>{isSubmitting ? "Dang gui..." : "Gui yeu cau"}</Text>
                </Pressable>
              </View>

              <View onLayout={registerSection("contact")} style={styles.contactCard}>
                <SectionTitle title="Lien he nhanh" />

                <View style={styles.contactList}>
                  {CONTACT_ITEMS.map((item) => (
                    <View key={item.label} style={styles.contactItem}>
                      <View style={styles.contactCopy}>
                        <Text style={styles.contactLabel}>{item.label}</Text>
                        <Text style={styles.contactValue}>{item.value}</Text>
                      </View>
                      <Pressable style={styles.contactAction} onPress={item.onPress}>
                        <Text style={styles.contactActionText}>{item.actionLabel}</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>

                <View style={styles.contactHours}>
                  <Text style={styles.contactHoursText}>09:00 - 21:00 moi ngay</Text>
                </View>
              </View>
            </>
          )}

          {user?.email ? <SessionActions /> : null}
        </ScrollView>

        {!successResult ? (
          <View style={styles.stickyActionBar}>
            <Pressable style={styles.stickyLoginButton} onPress={() => router.push("/(auth)/sign-in")}>
              <Text style={styles.stickyLoginButtonText}>Dang nhap</Text>
            </Pressable>
            <Pressable style={styles.stickyScheduleButton} onPress={() => jumpToSection("booking")}>
              <Text style={styles.stickyScheduleButtonText}>{scheduleExpanded ? "Ve lich hen" : "Mo lich hen"}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Modal visible={!!lightboxImage} transparent animationType="fade" onRequestClose={() => setLightboxImage(null)}>
        <View style={styles.lightboxBackdrop}>
          <Pressable style={styles.lightboxClose} onPress={() => setLightboxImage(null)}>
            <Text style={styles.lightboxCloseText}>Dong</Text>
          </Pressable>
          {lightboxImage ? <Image source={{ uri: lightboxImage }} alt="Anh lookbook phong to" style={styles.lightboxImage} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6ede4",
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 104,
    gap: 16,
  },
  heroShell: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#2d2018",
    borderRadius: 28,
    padding: 20,
    gap: 14,
  },
  heroGlowLarge: {
    position: "absolute",
    top: -40,
    right: -6,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "#f1caa8",
    opacity: 0.18,
  },
  heroGlowSmall: {
    position: "absolute",
    bottom: -26,
    left: -14,
    width: 104,
    height: 104,
    borderRadius: 999,
    backgroundColor: "#8f5d3b",
    opacity: 0.22,
  },
  heroEyebrow: {
    color: "#efc39d",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: "#fff7f1",
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "800",
  },
  heroMessageStack: {
    gap: 8,
  },
  heroMessagePill: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  heroMessageText: {
    color: "#f3e5d7",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  quickNavBar: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  quickNavChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  quickNavChipActive: {
    backgroundColor: "#f0d3b7",
    borderColor: "#f0d3b7",
  },
  quickNavChipText: {
    color: "#f6e9dc",
    fontSize: 13,
    fontWeight: "700",
  },
  quickNavChipTextActive: {
    color: "#2d2018",
  },
  panelCard: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#eadbc8",
    gap: 14,
  },
  sectionTitle: {
    color: "#2f241d",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  lookbookStack: {
    gap: 14,
  },
  lookbookRow: {
    gap: 14,
    paddingRight: 12,
  },
  lookbookCard: {
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#fff3e6",
    borderWidth: 1,
    borderColor: "#eadbc8",
    width: 296,
  },
  lookbookCardActive: {
    borderColor: "#2f241d",
  },
  lookbookImage: {
    width: "100%",
    height: 220,
  },
  lookbookImageOverlay: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lookbookTone: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(47,36,29,0.78)",
  },
  lookbookZoom: {
    color: "#2f241d",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,250,245,0.92)",
  },
  lookbookBody: {
    padding: 16,
    gap: 10,
  },
  lookbookHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  lookbookTitle: {
    color: "#2f241d",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },
  lookbookPrice: {
    color: "#8b5b36",
    fontSize: 13,
    fontWeight: "800",
  },
  lookbookDescription: {
    color: "#69584b",
    fontSize: 14,
    lineHeight: 20,
  },
  lookbookSelectButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: "#2f241d",
  },
  lookbookSelectButtonActive: {
    backgroundColor: "#f0d3b7",
  },
  lookbookSelectButtonText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
  },
  lookbookSelectButtonTextActive: {
    color: "#2f241d",
  },
  lookbookFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  lookbookDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lookbookDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#d8c5b2",
  },
  lookbookDotActive: {
    width: 24,
    backgroundColor: "#2f241d",
  },
  lookbookMetaText: {
    color: "#8b5b36",
    fontSize: 12,
    fontWeight: "700",
  },
  selectionStrip: {
    gap: 10,
  },
  selectionCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#f3e3d4",
  },
  selectionValue: {
    color: "#2f241d",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  scheduleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  scheduleTitle: {
    color: "#2f241d",
    fontSize: 18,
    fontWeight: "800",
  },
  scheduleToggleButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#2f241d",
  },
  scheduleToggleButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  schedulePanel: {
    borderRadius: 22,
    paddingVertical: 6,
    gap: 12,
  },
  compactDateRow: {
    gap: 8,
    paddingRight: 8,
  },
  compactDateChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dcc8b5",
  },
  compactDateChipActive: {
    backgroundColor: "#2f241d",
    borderColor: "#2f241d",
  },
  compactDateChipText: {
    color: "#6f5947",
    fontSize: 13,
    fontWeight: "700",
  },
  compactDateChipTextActive: {
    color: "#fff",
  },
  compactTimeRow: {
    gap: 8,
    paddingRight: 8,
  },
  compactTimeChip: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dcc8b5",
  },
  compactTimeChipActive: {
    backgroundColor: "#2f241d",
    borderColor: "#2f241d",
  },
  compactTimeChipText: {
    color: "#6f5947",
    fontSize: 13,
    fontWeight: "700",
  },
  compactTimeChipTextActive: {
    color: "#fff",
  },
  input: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eadbc8",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#2f241d",
    fontSize: 15,
  },
  noteInput: {
    minHeight: 100,
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: "#2f241d",
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
  },
  contactCard: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: "#2f241d",
    gap: 14,
  },
  contactList: {
    gap: 10,
  },
  contactItem: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contactCopy: {
    flex: 1,
    gap: 4,
  },
  contactLabel: {
    color: "#d7b99f",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  contactValue: {
    color: "#fff7f1",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  contactAction: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f0d3b7",
  },
  contactActionText: {
    color: "#2f241d",
    fontSize: 12,
    fontWeight: "800",
  },
  contactHours: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  contactHoursText: {
    color: "#f3e5d7",
    fontSize: 13,
    fontWeight: "700",
  },
  successCard: {
    borderRadius: 26,
    padding: 20,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#dcead7",
    gap: 12,
  },
  successTitle: {
    color: "#234123",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  successSlot: {
    color: "#436142",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  successId: {
    color: "#6b7f69",
    fontSize: 13,
    fontWeight: "600",
  },
  stickyActionBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
    borderRadius: 24,
    padding: 12,
    backgroundColor: "rgba(255,250,245,0.98)",
    borderWidth: 1,
    borderColor: "#eadbc8",
    shadowColor: "#34251d",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    flexDirection: "row",
    gap: 10,
  },
  stickyLoginButton: {
    flex: 0.9,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d9c7b4",
  },
  stickyLoginButtonText: {
    color: "#5d4f46",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },
  stickyScheduleButton: {
    flex: 1.1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#2f241d",
  },
  stickyScheduleButtonText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "800",
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,14,11,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  lightboxClose: {
    position: "absolute",
    top: 56,
    right: 20,
    zIndex: 2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  lightboxCloseText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  lightboxImage: {
    width: "100%",
    height: "78%",
    borderRadius: 24,
  },
  errorText: {
    color: "#a02e2e",
    fontSize: 13,
    lineHeight: 19,
  },
});
