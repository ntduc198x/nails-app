import type { LookbookService } from "@/src/hooks/use-lookbook-services";

export const FALLBACK_SERVICES: LookbookService[] = [
  {
    id: "luxury-gel",
    title: "Luxury Gel",
    category: "sang-trong",
    blurb: "Minimal nail shape with glossy black polish and modern crystal details.",
    tone: "Soft",
    price: "350,000 VND",
    image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1200",
    aspectRatio: 1.28,
  },
  {
    id: "nail-art-design",
    title: "Nail Art Design",
    category: "noi-bat",
    blurb: "Silver gray with milky white accents for a polished, brighter-hand finish.",
    tone: "Standout",
    price: "500,000 VND",
    image: "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?q=80&w=1200",
    aspectRatio: 0.98,
  },
  {
    id: "nail-han-quoc",
    category: "don-gian",
    title: "Korean Nail",
    blurb: "Sheer nude base with clean metallic accents and a glossy finish.",
    tone: "Soft",
    price: "400,000 VND",
    image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=1200",
    aspectRatio: 1.16,
  },
  {
    id: "french-chic",
    category: "sang-trong",
    title: "French Chic",
    blurb: "Thin French tips with rosy beige tones for date nights and everyday wear.",
    tone: "Luxury",
    price: "300,000 VND",
    image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=1200",
    aspectRatio: 1.24,
  },
  {
    id: "matcha-mood",
    category: "ca-tinh",
    title: "Matcha Mood",
    blurb: "Olive green shades with mini stickers for an edgy but still soft set.",
    tone: "Edgy",
    price: "380,000 VND",
    image: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?q=80&w=1200",
    aspectRatio: 1.06,
  },
  {
    id: "milky-glow",
    category: "don-gian",
    title: "Milky Glow",
    blurb: "Pearl glow overlay with subtle details to brighten the hands.",
    tone: "Minimal",
    price: "320,000 VND",
    image: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?q=80&w=1200",
    aspectRatio: 1.14,
  },
];

export const CATEGORY_ITEMS = [
  { key: "all" },
  { key: "don-gian" },
  { key: "sang-trong" },
  { key: "ca-tinh" },
  { key: "noi-bat" },
] as const;

export const QUICK_CONTACTS = [
  { label: "Hotline", value: "0916 080 398", actionLabel: "Call", href: "tel:0916080398" },
  { label: "Messenger", value: "m.me/chambeautyyy", actionLabel: "Chat", href: "https://m.me/chambeautyyy" },
  { label: "Instagram", value: "@cham.beautyy", actionLabel: "View", href: "https://www.instagram.com/cham.beautyy" },
] as const;

export const QUICK_CONTACTS_CARD = [
  {
    label: "Hotline",
    value: "0916 080 398",
    actionLabel: "Call",
    href: "tel:0916080398",
    icon: "phone-call",
    actionIcon: "phone",
  },
  {
    label: "Messenger",
    value: "m.me/chambeautyyy",
    actionLabel: "Chat",
    href: "https://m.me/chambeautyyy",
    icon: "message-circle",
    actionIcon: "message-circle",
  },
  {
    label: "Instagram",
    value: "@cham.beautyy",
    actionLabel: "View",
    href: "https://www.instagram.com/cham.beautyy",
    icon: "instagram",
    actionIcon: "external-link",
  },
] as const;

export const EXPLORE_STATS = [
  { id: "services", label: "Services", value: "6 looks", icon: "shopping-bag" },
  { id: "customers", label: "Customers", value: "2k+", icon: "users" },
  { id: "experience", label: "Experience", value: "6+ years", icon: "calendar" },
  { id: "offers", label: "Offers", value: "4 new", icon: "tag" },
] as const;

export const EXPLORE_SHOP_PRODUCTS = [
  {
    id: "product-1",
    title: "Silver Nail Charm",
    price: "79,000 VND",
    image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=1200",
  },
  {
    id: "product-2",
    title: "Milky Nude Gel Polish",
    price: "149,000 VND",
    image: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?q=80&w=1200",
  },
  {
    id: "product-3",
    title: "Cuticle Care Oil",
    price: "95,000 VND",
    image: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?q=80&w=1200",
  },
  {
    id: "product-4",
    title: "Nail Box Accessory Set",
    price: "169,000 VND",
    image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1200",
  },
] as const;

export const EXPLORE_TEAM = [
  {
    id: "staff-1",
    name: "Linh Chi",
    role: "Nail Artist",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800",
  },
  {
    id: "staff-2",
    name: "Thao Vy",
    role: "Nail Artist",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=800",
  },
  {
    id: "staff-3",
    name: "Quynh Anh",
    role: "Nail Artist",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800",
  },
  {
    id: "staff-4",
    name: "Minh Thu",
    role: "Nail Artist",
    image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?q=80&w=800",
  },
] as const;

export const EXPLORE_STORE_INFO = {
  name: "CHAM BEAUTY",
  category: "Nail & Beauty",
  rating: "4.9",
  reviews: "128 reviews",
  coverImage: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1200",
  highlights: ["Trusted", "High quality", "Attentive"],
  address: "38A ngách 358/40 Bùi Xương Trạch, Khương Định, Thanh Xuân, Hà Nội",
  openingHours: "Open daily: 09:00 - 21:00",
  mapImage: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?q=80&w=1200",
  mapUrl: "https://maps.app.goo.gl/Qu9oyq4emP3iWHDd6",
} as const;

export const EXPLORE_GALLERY = [
  {
    id: "gallery-1",
    title: "Khong gian storefront",
    image: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1200",
    kind: "salon",
  },
  {
    id: "gallery-2",
    title: "Ban tiep don",
    image: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?q=80&w=1200",
    kind: "decor",
  },
  {
    id: "gallery-3",
    title: "Mau french chic",
    image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=1200",
    kind: "work",
  },
  {
    id: "gallery-4",
    title: "Team tai cua hang",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800",
    kind: "team",
  },
] as const;

export const NEWS_ITEMS = [
  {
    id: "news-1",
    tag: "Hot trend",
    title: "Olive chrome and nude cat-eye are the most booked tones this week",
    body: "Customers are leaning toward bright nude shades with slim chrome accents that still feel wearable every day.",
  },
  {
    id: "news-2",
    tag: "Offers",
    title: "Cham Beauty added a premium nail art plus hand spa combo for morning slots",
    body: "Bookings before 11:00 include a complimentary hand spa and priority technician availability.",
  },
  {
    id: "news-3",
    tag: "Update",
    title: "This month’s lookbook adds more French styles inspired by Pinterest layouts",
    body: "Fresh French Chic, Milky Glow, and Olive Mood looks are now ready to save from Explore.",
  },
] as const;

export const HOME_SHORTCUTS = [
  { id: "shortcut-1", title: "Today’s hot looks", detail: "Open Explore to view current trends", href: "/(customer)/(tabs)/explore" },
  { id: "shortcut-2", title: "Quick booking", detail: "Send a request and pick the best time slot", href: "/(customer)/(tabs)/booking" },
  { id: "shortcut-3", title: "Member offers", detail: "New vouchers and current reward points", href: "/(customer)/offers" },
] as const;

export const OFFERS = [
  { id: "offer-20", title: "20% off", detail: "All nail art services", expiry: "Valid until: 30/04/2026" },
  { id: "offer-10", title: "10% off", detail: "For orders from 500k", expiry: "Valid until: 15/05/2026" },
  { id: "offer-30k", title: "30k off", detail: "For services from 300k", expiry: "Valid until: 01/05/2026" },
] as const;

export const MEMBERSHIP = {
  brand: "CHAM BEAUTY",
  tier: "Member Gold",
  points: "1.250",
  progress: 0.62,
  renewal: "You need 750 more points to reach Platinum",
  perks: ["Collect points for rewards", "Birthday perks", "Priority booking", "Special discounts"],
};

export const UPCOMING_BOOKINGS = [
  { id: "upcoming-1", title: "Luxury Gel", slot: "09:00 24/04/2026", staff: "Bui Thi Tuyet" },
  { id: "upcoming-2", title: "French Chic", slot: "14:30 27/04/2026", staff: "Vo Ha Linh" },
] as const;

export const UPCOMING_BOOKING_CARDS = [
  {
    id: "upcoming-card-1",
    title: "Luxury Gel",
    slot: "09:00 - 24/04/2026",
    staff: "Bui Thi Tuyet",
    image: FALLBACK_SERVICES[0].image,
  },
  {
    id: "upcoming-card-2",
    title: "French Chic",
    slot: "14:30 - 27/04/2026",
    staff: "Vo Ha Linh",
    image: FALLBACK_SERVICES[3].image,
  },
] as const;

export const BOOKING_HISTORY = [
  {
    id: "history-1",
    time: "19:00 18/04/2026",
    staff: "Nguyen Khanh Ly",
    service: "Nail Art Design",
    status: "Confirmed",
    tone: "success",
  },
  {
    id: "history-2",
    time: "14:00 15/04/2026",
    staff: "Vo Ha Linh",
    service: "French Chic",
    status: "Visited",
    tone: "success",
  },
  {
    id: "history-3",
    time: "10:30 10/04/2026",
    staff: "Bui Thuy An",
    service: "Korean Nail",
    status: "Cancelled",
    tone: "danger",
  },
  {
    id: "history-4",
    time: "13:00 05/04/2026",
    staff: "Tran Ha Linh",
    service: "Luxury Gel",
    status: "Visited",
    tone: "success",
  },
] as const;

export const FAVORITES = [
  { id: "favorite-1", serviceId: "nail-art-design", note: "Lookbook" },
  { id: "favorite-2", serviceId: "french-chic", note: "Lookbook" },
  { id: "favorite-3", serviceId: "nail-han-quoc", note: "Lookbook" },
  { id: "favorite-4", serviceId: "luxury-gel", note: "Lookbook" },
] as const;

export const NOTIFICATIONS = [
  {
    id: "notify-1",
    icon: "⏰",
    title: "Booking confirmed",
    body: "You booked with Nguyen Khanh Ly at 19:00 on 18/04.",
    time: "2 min ago",
    group: "All",
  },
  {
    id: "notify-2",
    icon: "📅",
    title: "Appointment reminder",
    body: "You have an appointment at 19:00 on 18/04 with Nguyen Khanh Ly.",
    time: "10 min ago",
    group: "System",
  },
  {
    id: "notify-3",
    icon: "🏷",
    title: "Special offer",
    body: "Get 20% off all nail art services this week.",
    time: "1 hour ago",
    group: "Promotions",
  },
  {
    id: "notify-4",
    icon: "✉",
    title: "Rate your service",
    body: "Thanks for visiting us. Leave a review to help us improve.",
    time: "2 hours ago",
    group: "System",
  },
] as const;

export const REVIEWS = [
  {
    id: "review-1",
    service: "Nail Art Design",
    staff: "Nguyen Khanh Ly",
    date: "18/04/2026",
    rating: 5,
    image: FALLBACK_SERVICES[1].image,
  },
  {
    id: "review-2",
    service: "French Chic",
    staff: "Vo Ha Linh",
    date: "15/04/2026",
    rating: 5,
    image: FALLBACK_SERVICES[3].image,
  },
  {
    id: "review-3",
    service: "Luxury Gel",
    staff: "Tran Ha Linh",
    date: "05/04/2026",
    rating: 4,
    image: FALLBACK_SERVICES[0].image,
  },
] as const;

export const PAYMENT_METHODS = [
  { id: "payment-1", title: "Cash", detail: "Pay at the counter" },
  { id: "payment-2", title: "Ví Momo", detail: "Cham Beauty shop" },
  { id: "payment-3", title: "ZaloPay", detail: "Quick link after booking" },
  { id: "payment-4", title: "Bank card", detail: "Supports Visa and Napas" },
] as const;

export const ADDRESSES = [
  { id: "address-1", title: "Home", detail: "123 ABC Street, District 1, Ho Chi Minh City", selected: true },
  { id: "address-2", title: "Office", detail: "456 DEF Street, District 3, Ho Chi Minh City", selected: false },
] as const;

export const SETTINGS = [
  { id: "setting-1", title: "Notifications", value: "On" },
  { id: "setting-2", title: "Sound", value: "Off" },
  { id: "setting-3", title: "Language", value: "English" },
  { id: "setting-4", title: "Display mode", value: "Light" },
] as const;

export const PROFILE_SUMMARY = {
  name: "Ducnt Nguyen",
  birthDate: "21/04/1998",
  phone: "0916 080 398",
  email: "linh.vo@example.com",
  address: "123 ABC Street, District 1, Ho Chi Minh City",
  editLabel: "Edit",
  avatar:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800",
  language: "English",
  passwordLabel: "Change password",
};

export const PROFILE_LINKS = [
  { id: "profile-link-1", title: "Personal info", href: "/(customer)/settings", detail: "" },
  { id: "profile-link-3", title: "Payment methods", href: "/(customer)/payment-methods", detail: "" },
  { id: "profile-link-4", title: "Security", href: "/(customer)/settings", detail: "" },
  { id: "profile-link-5", title: "Language", href: "/(customer)/settings", detail: "English" },
  { id: "profile-link-6", title: "Notification settings", href: "/(customer)/notifications", detail: "" },
  { id: "profile-link-7", title: "About the app", href: "/(customer)/settings", detail: "" },
  { id: "profile-link-8", title: "Sign out", href: "/(auth)/sign-in", detail: "" },
] as const;

export function matchesCategory(service: LookbookService, category: (typeof CATEGORY_ITEMS)[number]["key"]) {
  if (category === "all") return true;
  const haystack = `${service.title} ${service.tone} ${service.blurb} ${service.badge ?? ""}`.toLowerCase();
  const normalizedCategory = service.category?.toLowerCase() ?? "";
  const normalizedTone = service.tone.toLowerCase();
  const normalizedBadge = service.badge?.toLowerCase() ?? "";

  if (category === "noi-bat") {
    return (
      normalizedCategory === "noi-bat" ||
      normalizedBadge.includes("nổi bật") ||
      normalizedBadge.includes("noi bat") ||
      normalizedBadge.includes("standout") ||
      normalizedTone.includes("nổi bật") ||
      normalizedTone.includes("noi bat") ||
      normalizedTone.includes("standout") ||
      haystack.includes("art") ||
      haystack.includes("design")
    );
  }

  if (normalizedCategory === category) {
    return true;
  }

  if (category === "don-gian") {
    return normalizedTone.includes("nhẹ nhàng") || normalizedTone.includes("đơn giản") || normalizedTone.includes("soft") || normalizedTone.includes("minimal") || haystack.includes("milky");
  }

  if (category === "sang-trong") {
    return normalizedTone.includes("sang trọng") || normalizedTone.includes("luxury") || haystack.includes("french") || haystack.includes("luxury");
  }

  if (category === "ca-tinh") {
    return normalizedTone.includes("cá tính") || normalizedTone.includes("edgy") || haystack.includes("olive") || haystack.includes("matcha");
  }

  return true;
}
