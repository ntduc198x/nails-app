import { Redirect, router } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { formatViDate, formatViDateTime } from "@nails/shared";
import { useGuestBooking } from "@/src/hooks/use-guest-booking";
import { SessionActions, useSession } from "@/src/providers/session-provider";

const FEATURED_SERVICES = [
  {
    title: "Luxury Gel",
    description: "Son gel ben mau, sach form, hop lich hen trong ngay.",
  },
  {
    title: "Nail Art Design",
    description: "Design diem nhan cho su kien, tiec va lookbook mua he.",
  },
  {
    title: "Spa & Care",
    description: "Cham soc tay chan va duong da sau khi lam mong.",
  },
  {
    title: "Go mong & Cham soc",
    description: "Reset bo mong gon gang truoc khi vao set moi.",
  },
];

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  );
}

export default function CustomerHomeScreen() {
  const { role, user } = useSession();
  const { dateOptions, fieldErrors, isSubmitting, reset, submit, submitError, successResult, timeSlots, updateValue, values } =
    useGuestBooking();

  if (role) {
    return <Redirect href="/(admin)" />;
  }

  const selectedSlotLabel = values.selectedDate && values.selectedTime ? `${values.selectedDate} ${values.selectedTime}` : "Chon ngay va gio";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroShell}>
            <View style={styles.heroAccentLarge} />
            <View style={styles.heroAccentSmall} />
            <Text style={styles.heroEyebrow}>Cham Beauty Mobile</Text>
            <Text style={styles.heroTitle}>Dat lich nhanh nhu mobile web, nhung la native.</Text>
            <Text style={styles.heroDescription}>
              Giup khach vang lai gui booking request nhanh, ro va de bam tren dien thoai. Flow van di qua backend hien tai va giu Telegram side effect o server.
            </Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillLabel}>Hom nay</Text>
                <Text style={styles.metaPillValue}>{formatViDate(new Date())}</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillLabel}>Session</Text>
                <Text style={styles.metaPillValue}>{user?.email ?? "guest-public"}</Text>
              </View>
            </View>
          </View>

          {successResult ? (
            <View style={styles.successCard}>
              <SectionTitle
                eyebrow="Booking Sent"
                title="Yeu cau dat lich da duoc gui"
                description="Salon se xem lich va lien he lai voi ban de xac nhan trong som nhat."
              />

              <View style={styles.successInfoGrid}>
                <View style={styles.successInfoTile}>
                  <Text style={styles.successInfoLabel}>Thoi gian</Text>
                  <Text style={styles.successInfoValue}>{formatViDateTime(`${values.selectedDate}T${values.selectedTime}:00`)}</Text>
                </View>
                <View style={styles.successInfoTile}>
                  <Text style={styles.successInfoLabel}>Ma yeu cau</Text>
                  <Text style={styles.successInfoValue}>{successResult.bookingRequestId ?? "Dang dong bo"}</Text>
                </View>
              </View>

              <View style={styles.inlineActions}>
                <Pressable style={styles.primaryButton} onPress={reset}>
                  <Text style={styles.primaryButtonText}>Tao yeu cau moi</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => router.push("/(auth)/sign-in")}>
                  <Text style={styles.secondaryButtonText}>Nhan vien dang nhap</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.panelCard}>
                <SectionTitle
                  eyebrow="Lookbook"
                  title="Dich vu noi bat"
                  description="Chon nhanh mot service de dien san form booking."
                />

                <View style={styles.featuredGrid}>
                  {FEATURED_SERVICES.map((service) => {
                    const active = values.requestedService === service.title;
                    return (
                      <Pressable
                        key={service.title}
                        style={[styles.featureCard, active ? styles.featureCardActive : null]}
                        onPress={() => updateValue("requestedService", active ? "" : service.title)}
                      >
                        <Text style={[styles.featureTitle, active ? styles.featureTitleActive : null]}>{service.title}</Text>
                        <Text style={[styles.featureDescription, active ? styles.featureDescriptionActive : null]}>
                          {service.description}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.panelCard}>
                <SectionTitle
                  eyebrow="Booking Form"
                  title="Thong tin khach"
                  description="Form duoc chia thanh tung block de touch tren mobile de hon mobile web."
                />

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
                  placeholder="Dich vu mong muon"
                  placeholderTextColor="#8f7d6c"
                  style={styles.input}
                  value={values.requestedService}
                  onChangeText={(value) => updateValue("requestedService", value)}
                />

                <TextInput
                  placeholder="Nhan vien uu tien (neu co)"
                  placeholderTextColor="#8f7d6c"
                  style={styles.input}
                  value={values.preferredStaff}
                  onChangeText={(value) => updateValue("preferredStaff", value)}
                />
              </View>

              <View style={styles.panelCard}>
                <SectionTitle
                  eyebrow="Schedule"
                  title="Ngay va gio hen"
                  description={`Khung da chon: ${selectedSlotLabel}`}
                />

                <Text style={styles.fieldLabel}>Ngay hen</Text>
                <View style={styles.chipWrap}>
                  {dateOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[styles.chip, values.selectedDate === option.value ? styles.chipActive : null]}
                      onPress={() => updateValue("selectedDate", option.value)}
                    >
                      <Text style={[styles.chipText, values.selectedDate === option.value ? styles.chipTextActive : null]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {fieldErrors.selectedDate ? <Text style={styles.errorText}>{fieldErrors.selectedDate}</Text> : null}

                <Text style={styles.fieldLabel}>Khung gio</Text>
                <View style={styles.chipWrap}>
                  {timeSlots.map((slot) => (
                    <Pressable
                      key={slot}
                      style={[styles.chip, values.selectedTime === slot ? styles.chipActive : null]}
                      onPress={() => updateValue("selectedTime", slot)}
                    >
                      <Text style={[styles.chipText, values.selectedTime === slot ? styles.chipTextActive : null]}>
                        {slot}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {fieldErrors.selectedTime ? <Text style={styles.errorText}>{fieldErrors.selectedTime}</Text> : null}
              </View>

              <View style={styles.panelCard}>
                <SectionTitle
                  eyebrow="Notes"
                  title="Luu y them"
                  description="Thong tin them se giup salon xac nhan booking nhanh hon."
                />

                <TextInput
                  multiline
                  numberOfLines={5}
                  placeholder="Mo ta mong muon, mau son, note ve lich hoac luu y dac biet..."
                  placeholderTextColor="#8f7d6c"
                  style={[styles.input, styles.noteInput]}
                  textAlignVertical="top"
                  value={values.note}
                  onChangeText={(value) => updateValue("note", value)}
                />

                {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
              </View>

              <View style={styles.infoStrip}>
                <Text style={styles.infoStripEyebrow}>Nhan vien / Admin</Text>
                <Text style={styles.infoStripBody}>
                  Can vao admin shell? Dang nhap tu day de xem queue, appointments va checkout.
                </Text>
                <Pressable style={styles.inlineLinkButton} onPress={() => router.push("/(auth)/sign-in")}>
                  <Text style={styles.inlineLinkButtonText}>Mo staff sign-in</Text>
                </Pressable>
              </View>
            </>
          )}

          {user?.email ? <SessionActions /> : null}
        </ScrollView>

        {!successResult ? (
          <View style={styles.stickyActionBar}>
            <View style={styles.stickyMeta}>
              <Text style={styles.stickyMetaLabel}>Booking request</Text>
              <Text style={styles.stickyMetaValue}>{selectedSlotLabel}</Text>
            </View>
            <View style={styles.stickyActions}>
              <Pressable style={styles.stickySecondaryButton} onPress={() => router.push("/(auth)/sign-in")}>
                <Text style={styles.stickySecondaryButtonText}>Sign in</Text>
              </Pressable>
              <Pressable disabled={isSubmitting} style={styles.stickyPrimaryButton} onPress={() => void submit()}>
                <Text style={styles.stickyPrimaryButtonText}>{isSubmitting ? "Dang gui..." : "Gui booking"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8efe6",
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 124,
    gap: 18,
  },
  heroShell: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#2d2018",
    borderRadius: 28,
    padding: 22,
    gap: 12,
  },
  heroAccentLarge: {
    position: "absolute",
    top: -36,
    right: -12,
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: "#8f5d3b",
    opacity: 0.2,
  },
  heroAccentSmall: {
    position: "absolute",
    bottom: -28,
    left: -14,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: "#f1caa8",
    opacity: 0.14,
  },
  heroEyebrow: {
    color: "#f3c59c",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: "#fff6ef",
    fontSize: 31,
    lineHeight: 37,
    fontWeight: "800",
  },
  heroDescription: {
    color: "#ecd8c6",
    fontSize: 15,
    lineHeight: 22,
  },
  heroMetaRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  metaPill: {
    minWidth: "47%",
    flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  metaPillLabel: {
    color: "#caa98d",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metaPillValue: {
    color: "#fff6ef",
    fontSize: 14,
    fontWeight: "600",
  },
  panelCard: {
    backgroundColor: "#fffaf5",
    borderRadius: 26,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "#eadbc8",
    shadowColor: "#5d4f46",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  sectionHeading: {
    gap: 6,
  },
  sectionEyebrow: {
    color: "#9a6b3f",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionTitle: {
    color: "#2f241d",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  sectionDescription: {
    color: "#67584d",
    fontSize: 14,
    lineHeight: 21,
  },
  featuredGrid: {
    gap: 10,
  },
  featureCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#fff3e7",
    borderWidth: 1,
    borderColor: "#eadbc8",
    gap: 8,
  },
  featureCardActive: {
    backgroundColor: "#2f241d",
    borderColor: "#2f241d",
  },
  featureTitle: {
    color: "#2f241d",
    fontSize: 17,
    fontWeight: "700",
  },
  featureTitleActive: {
    color: "#fffaf5",
  },
  featureDescription: {
    color: "#6c5a4c",
    fontSize: 13,
    lineHeight: 19,
  },
  featureDescriptionActive: {
    color: "#e5d6c8",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eadbc8",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#2b1d12",
    fontSize: 15,
  },
  noteInput: {
    minHeight: 112,
  },
  fieldLabel: {
    color: "#2f241d",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#dcc8b5",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "#fff7ee",
  },
  chipActive: {
    backgroundColor: "#2f241d",
    borderColor: "#2f241d",
  },
  chipText: {
    color: "#6f5947",
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#fff",
  },
  successCard: {
    backgroundColor: "#fffdf8",
    borderRadius: 26,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "#cfe3cf",
  },
  successInfoGrid: {
    gap: 10,
  },
  successInfoTile: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#f3faf3",
    borderWidth: 1,
    borderColor: "#d7ead7",
    gap: 6,
  },
  successInfoLabel: {
    color: "#567156",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  successInfoValue: {
    color: "#234123",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  inlineActions: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#2f241d",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#d5c3b1",
    backgroundColor: "#fff",
  },
  secondaryButtonText: {
    color: "#5d4f46",
    textAlign: "center",
    fontWeight: "700",
  },
  infoStrip: {
    borderRadius: 22,
    backgroundColor: "#f0e1d2",
    borderWidth: 1,
    borderColor: "#e2cfbc",
    padding: 18,
    gap: 8,
  },
  infoStripEyebrow: {
    color: "#8e6546",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoStripBody: {
    color: "#4f4034",
    fontSize: 14,
    lineHeight: 21,
  },
  inlineLinkButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  inlineLinkButtonText: {
    color: "#7d5334",
    fontSize: 14,
    fontWeight: "800",
  },
  stickyActionBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
    borderRadius: 24,
    padding: 14,
    backgroundColor: "rgba(255,250,245,0.98)",
    borderWidth: 1,
    borderColor: "#eadbc8",
    shadowColor: "#34251d",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    gap: 12,
  },
  stickyMeta: {
    gap: 4,
  },
  stickyMetaLabel: {
    color: "#8b6a54",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  stickyMetaValue: {
    color: "#2f241d",
    fontSize: 14,
    fontWeight: "700",
  },
  stickyActions: {
    flexDirection: "row",
    gap: 10,
  },
  stickySecondaryButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d5c3b1",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  stickySecondaryButtonText: {
    color: "#5d4f46",
    textAlign: "center",
    fontWeight: "700",
  },
  stickyPrimaryButton: {
    flex: 1.4,
    borderRadius: 16,
    backgroundColor: "#2f241d",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  stickyPrimaryButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "800",
  },
  errorText: {
    color: "#9f2d2d",
    lineHeight: 20,
  },
});
