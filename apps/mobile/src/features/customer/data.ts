import type { LookbookService } from "@/src/hooks/use-lookbook-services";

export const FALLBACK_SERVICES: LookbookService[] = [
  {
    id: "luxury-gel",
    title: "Luxury Gel",
    category: "sang-trong",
    blurb: "Form móng tối giản, nền đen bóng và chi tiết đá béo hiện đại.",
    tone: "Nhẹ nhàng",
    price: "350.000đ",
    image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1200",
    aspectRatio: 1.28,
  },
  {
    id: "nail-art-design",
    title: "Nail Art Design",
    category: "noi-bat",
    blurb: "Phối màu xám bạc và white milk cho layout sang trọng, sáng da.",
    tone: "Nổi bật",
    price: "500.000đ",
    image: "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?q=80&w=1200",
    aspectRatio: 0.98,
  },
  {
    id: "nail-han-quoc",
    category: "don-gian",
    title: "Nail Hàn Quốc",
    blurb: "Base nude trong veo, điểm nhấn phụ kiện kim loại nhỏ và sáng.",
    tone: "Nhẹ nhàng",
    price: "400.000đ",
    image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=1200",
    aspectRatio: 1.16,
  },
  {
    id: "french-chic",
    category: "sang-trong",
    title: "French Chic",
    blurb: "French mỏng và gam beige hồng, hợp hẹn hò và đi làm mỗi ngày.",
    tone: "Sang trọng",
    price: "300.000đ",
    image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=1200",
    aspectRatio: 1.24,
  },
  {
    id: "matcha-mood",
    category: "ca-tinh",
    title: "Matcha Mood",
    blurb: "Gam xanh olive mix sticker mini cho bộ móng cá tính nhưng vẫn mềm.",
    tone: "Cá tính",
    price: "380.000đ",
    image: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?q=80&w=1200",
    aspectRatio: 1.06,
  },
  {
    id: "milky-glow",
    category: "don-gian",
    title: "Milky Glow",
    blurb: "Overlay ánh ngọc trai và những điểm nhấn nhỏ cho da tay sáng hơn.",
    tone: "Đơn giản",
    price: "320.000đ",
    image: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?q=80&w=1200",
    aspectRatio: 1.14,
  },
];

export const CATEGORY_ITEMS = [
  { key: "all", label: "Tất cả" },
  { key: "don-gian", label: "Đơn giản" },
  { key: "sang-trong", label: "Sang trọng" },
  { key: "ca-tinh", label: "Cá tính" },
  { key: "noi-bat", label: "Nổi bật" },
] as const;

export const QUICK_CONTACTS = [
  { label: "Hotline", value: "0916 080 398", actionLabel: "Gọi", href: "tel:0916080398" },
  { label: "Messenger", value: "m.me/chambeautyyy", actionLabel: "Chat", href: "https://m.me/chambeautyyy" },
  { label: "Instagram", value: "@cham.beautyy", actionLabel: "Xem", href: "https://www.instagram.com/cham.beautyy" },
] as const;

export const QUICK_CONTACTS_CARD = [
  {
    label: "Hotline",
    value: "0916 080 398",
    actionLabel: "Gọi",
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
    actionLabel: "Xem",
    href: "https://www.instagram.com/cham.beautyy",
    icon: "instagram",
    actionIcon: "external-link",
  },
] as const;

export const EXPLORE_STATS = [
  { id: "services", label: "Dịch vụ", value: "6 mẫu", icon: "shopping-bag" },
  { id: "customers", label: "Khách hàng", value: "2k+", icon: "users" },
  { id: "experience", label: "Kinh nghiệm", value: "+6 năm", icon: "calendar" },
  { id: "offers", label: "Ưu đãi", value: "4 mới", icon: "tag" },
] as const;

export const EXPLORE_SHOP_PRODUCTS = [
  {
    id: "product-1",
    title: "Charm đính móng ánh bạc",
    price: "79.000đ",
    image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=1200",
  },
  {
    id: "product-2",
    title: "Sơn gel nude milk",
    price: "149.000đ",
    image: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?q=80&w=1200",
  },
  {
    id: "product-3",
    title: "Dầu dưỡng viền móng",
    price: "95.000đ",
    image: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?q=80&w=1200",
  },
  {
    id: "product-4",
    title: "Set phụ kiện nail box",
    price: "169.000đ",
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
    name: "Thảo Vy",
    role: "Nail Artist",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=800",
  },
  {
    id: "staff-3",
    name: "Quỳnh Anh",
    role: "Nail Artist",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800",
  },
  {
    id: "staff-4",
    name: "Minh Thư",
    role: "Nail Artist",
    image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?q=80&w=800",
  },
] as const;

export const EXPLORE_STORE_INFO = {
  name: "CHAM BEAUTY",
  category: "Nail & Beauty",
  rating: "4.9",
  reviews: "128 đánh giá",
  coverImage: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1200",
  highlights: ["Uy tín", "Chất lượng", "Tận tâm"],
  address: "38A ngách 358/40 Bùi Xương Trạch, Khương Định, Thanh Xuân, Hà Nội",
  openingHours: "Mở cửa: 09:00 - 21:00 (Tất cả ngày)",
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
    title: "Chrome olive và cat-eye nude đang là tông màu được đặt nhiều nhất tuần này",
    body: "Khách hàng đang ưu tiên tông nude sáng tay, mix thêm chi tiết chrome mỏng để vẫn dễ đi làm mỗi ngày.",
  },
  {
    id: "news-2",
    tag: "Ưu đãi",
    title: "Cham Beauty mở thêm combo nail art premium + spa tay trong khung giờ sáng",
    body: "Booking trước 11:00 sẽ được free spa tay và ưu tiên chọn slot kỹ thuật viên.",
  },
  {
    id: "news-3",
    tag: "Cập nhật",
    title: "Lookbook tháng này thêm nhiều form French mới hợp layout ảnh Pinterest",
    body: "Đã cập nhật thêm các mẫu French Chic, milky glow và olive mood để bạn lưu nhanh sang màn Khám phá.",
  },
] as const;

export const HOME_SHORTCUTS = [
  { id: "shortcut-1", title: "Mẫu hot hôm nay", detail: "Mở màn Khám phá để xem trend hiện tại", href: "/(customer)/explore" },
  { id: "shortcut-2", title: "Đặt lịch nhanh", detail: "Gửi yêu cầu và chọn khung giờ phù hợp", href: "/(customer)/booking" },
  { id: "shortcut-3", title: "Ưu đãi thành viên", detail: "Voucher mới và điểm tích lũy hiện tại", href: "/(customer)/offers" },
] as const;

export const OFFERS = [
  { id: "offer-20", title: "Giảm 20%", detail: "Tất cả dịch vụ nail art", expiry: "HSD: 30/04/2026" },
  { id: "offer-10", title: "Giảm 10%", detail: "Cho đơn từ 500k", expiry: "HSD: 15/05/2026" },
  { id: "offer-30k", title: "Giảm 30k", detail: "Cho dịch vụ từ 300k", expiry: "HSD: 01/05/2026" },
] as const;

export const MEMBERSHIP = {
  brand: "CHAM BEAUTY",
  tier: "Member Gold",
  points: "1.250",
  progress: 0.62,
  renewal: "Bạn cần thêm 750 điểm để lên hạng Platinum",
  perks: ["Tích điểm đổi quà", "Ưu đãi sinh nhật", "Ưu tiên đặt lịch", "Giảm giá đặc biệt"],
};

export const UPCOMING_BOOKINGS = [
  { id: "upcoming-1", title: "Luxury Gel", slot: "09:00 24/04/2026", staff: "Bùi Thị Tuyết" },
  { id: "upcoming-2", title: "French Chic", slot: "14:30 27/04/2026", staff: "Võ Hà Linh" },
] as const;

export const UPCOMING_BOOKING_CARDS = [
  {
    id: "upcoming-card-1",
    title: "Luxury Gel",
    slot: "09:00 - 24/04/2026",
    staff: "Bùi Thị Tuyết",
    image: FALLBACK_SERVICES[0].image,
  },
  {
    id: "upcoming-card-2",
    title: "French Chic",
    slot: "14:30 - 27/04/2026",
    staff: "Võ Hà Linh",
    image: FALLBACK_SERVICES[3].image,
  },
] as const;

export const BOOKING_HISTORY = [
  {
    id: "history-1",
    time: "19:00 18/04/2026",
    staff: "Nguyễn Khánh Ly",
    service: "Nail Art Design",
    status: "Đã xác nhận",
    tone: "success",
  },
  {
    id: "history-2",
    time: "14:00 15/04/2026",
    staff: "Võ Hà Linh",
    service: "French Chic",
    status: "Đã đến",
    tone: "success",
  },
  {
    id: "history-3",
    time: "10:30 10/04/2026",
    staff: "Bùi Thúy An",
    service: "Nail Hàn Quốc",
    status: "Đã hủy",
    tone: "danger",
  },
  {
    id: "history-4",
    time: "13:00 05/04/2026",
    staff: "Trần Hà Linh",
    service: "Luxury Gel",
    status: "Đã đến",
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
    title: "Đặt lịch thành công",
    body: "Bạn đã đặt lịch với Nguyễn Khánh Ly vào 19:00 18/04",
    time: "2 phút trước",
    group: "Tất cả",
  },
  {
    id: "notify-2",
    icon: "📅",
    title: "Nhắc lịch hẹn",
    body: "Bạn có lịch hẹn vào 19:00 18/04 với Nguyễn Khánh Ly",
    time: "10 phút trước",
    group: "Hệ thống",
  },
  {
    id: "notify-3",
    icon: "🏷",
    title: "Ưu đãi đặc biệt",
    body: "Giảm 20% tất cả dịch vụ nail art trong tuần này!",
    time: "1 giờ trước",
    group: "Khuyến mãi",
  },
  {
    id: "notify-4",
    icon: "✉",
    title: "Đánh giá dịch vụ",
    body: "Cảm ơn bạn đã sử dụng dịch vụ. Hãy đánh giá để giúp chúng tôi cải thiện nhé!",
    time: "2 giờ trước",
    group: "Hệ thống",
  },
] as const;

export const REVIEWS = [
  {
    id: "review-1",
    service: "Nail Art Design",
    staff: "Nguyễn Khánh Ly",
    date: "18/04/2026",
    rating: 5,
    image: FALLBACK_SERVICES[1].image,
  },
  {
    id: "review-2",
    service: "French Chic",
    staff: "Võ Hà Linh",
    date: "15/04/2026",
    rating: 5,
    image: FALLBACK_SERVICES[3].image,
  },
  {
    id: "review-3",
    service: "Luxury Gel",
    staff: "Trần Hà Linh",
    date: "05/04/2026",
    rating: 4,
    image: FALLBACK_SERVICES[0].image,
  },
] as const;

export const PAYMENT_METHODS = [
  { id: "payment-1", title: "Tiền mặt", detail: "Thanh toán tại quầy" },
  { id: "payment-2", title: "Ví Momo", detail: "Cham Beauty shop" },
  { id: "payment-3", title: "ZaloPay", detail: "Liên kết nhanh sau booking" },
  { id: "payment-4", title: "Thẻ ngân hàng", detail: "Hỗ trợ Visa và Napas" },
] as const;

export const ADDRESSES = [
  { id: "address-1", title: "Nhà riêng", detail: "123 Đường ABC, Quận 1, TP. HCM", selected: true },
  { id: "address-2", title: "Công ty", detail: "456 Đường DEF, Quận 3, TP. HCM", selected: false },
] as const;

export const SETTINGS = [
  { id: "setting-1", title: "Nhận thông báo", value: "Bật" },
  { id: "setting-2", title: "Âm thanh", value: "Tắt" },
  { id: "setting-3", title: "Ngôn ngữ", value: "Tiếng Việt" },
  { id: "setting-4", title: "Chế độ hiển thị", value: "Sáng" },
] as const;

export const PROFILE_SUMMARY = {
  name: "Ducnt Nguyen",
  birthDate: "21/04/1998",
  phone: "0916 080 398",
  email: "linh.vo@example.com",
  address: "123 Đường ABC, Quận 1, TP. HCM",
  editLabel: "Chỉnh sửa",
  avatar:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800",
  language: "Tiếng Việt",
  passwordLabel: "Đổi mật khẩu",
};

export const PROFILE_LINKS = [
  { id: "profile-link-1", title: "Thông tin cá nhân", href: "/(customer)/settings", detail: "" },
  { id: "profile-link-2", title: "Địa chỉ", href: "/(customer)/addresses", detail: "" },
  { id: "profile-link-3", title: "Phương thức thanh toán", href: "/(customer)/payment-methods", detail: "" },
  { id: "profile-link-4", title: "Bảo mật", href: "/(customer)/settings", detail: "" },
  { id: "profile-link-5", title: "Ngôn ngữ", href: "/(customer)/settings", detail: "Tiếng Việt" },
  { id: "profile-link-6", title: "Cài đặt thông báo", href: "/(customer)/notifications", detail: "" },
  { id: "profile-link-7", title: "Giới thiệu ứng dụng", href: "/(customer)/settings", detail: "" },
  { id: "profile-link-8", title: "Đăng xuất", href: "/(auth)/sign-in", detail: "" },
] as const;

export function matchesCategory(service: LookbookService, category: (typeof CATEGORY_ITEMS)[number]["key"]) {
  if (category === "all") return true;
  if (service.category) return service.category === category;

  const haystack = `${service.title} ${service.tone} ${service.blurb}`.toLowerCase();

  if (category === "don-gian") {
    return haystack.includes("nhẹ nhàng") || haystack.includes("đơn giản") || haystack.includes("milky");
  }

  if (category === "sang-trong") {
    return haystack.includes("sang trọng") || haystack.includes("french") || haystack.includes("luxury");
  }

  if (category === "ca-tinh") {
    return haystack.includes("cá tính") || haystack.includes("olive") || haystack.includes("matcha");
  }

  if (category === "noi-bat") {
    return haystack.includes("nổi bật") || haystack.includes("art") || haystack.includes("design");
  }

  return true;
}
