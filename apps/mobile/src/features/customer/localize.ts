import type {
  CustomerContentPost,
  CustomerExplorePayload,
  CustomerFavoriteService,
  CustomerHomeFeedPayload,
  CustomerMembershipTier,
  ExploreStat,
  ExploreGalleryItem,
  ExploreProduct,
  ExploreStorefront,
  ExploreTeamMember,
  LookbookItem,
  LocalizedTextValue,
  Locale,
  MarketingOfferCard,
} from "@nails/shared";
import {
  formatLocalizedDurationLabel,
  formatLookbookPrice,
  listMissingLocalizedFields,
  parseLocalizedTextValue,
} from "@nails/shared";

function normalizeVietnamese(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function pickEnglishText(locale: Locale, value: string | null | undefined, dictionary: Record<string, string>) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || locale !== "en") return text || null;
  return dictionary[normalizeVietnamese(text)] ?? null;
}

function invertDictionary(dictionary: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(dictionary).map(([viKey, enValue]) => [normalizeVietnamese(enValue), viKey]),
  ) as Record<string, string>;
}

function restoreVietnameseText(value: string, dictionary: Record<string, string>) {
  const normalized = normalizeVietnamese(value);
  const matchedKey = dictionary[normalized];
  return matchedKey ?? value;
}

function pickLocalizedText(locale: Locale, value: string | null | undefined, dictionary: Record<string, string>) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return text || null;
  if (locale === "en") {
    return dictionary[normalizeVietnamese(text)] ?? null;
  }
  return restoreVietnameseText(text, invertDictionary(dictionary));
}

function containsLikelyVietnameseText(value: string) {
  const text = value.trim();
  if (!text) return false;
  if (containsLikelyEnglishText(text)) {
    return false;
  }
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) {
    return true;
  }

  const normalized = normalizeVietnamese(text);
  return /\b(dich vu|mo cua|tat ca ngay|danh gia|khong gian|san pham|uu dai|giam|sinh nhat|dau duong|son gel|dua mong|cham soc|phu kien|cua hang|cua tiem|nhan su|nhan vien|chu cua hang|quan ly|noi bat|sang trong|nhe nhang|ca tinh|don gian|ben mau|bao ve|duong am|bo co|em tay|mem da|anh khoi|mat meo|mau|mong|tay|da)\b/.test(normalized);
}

function containsLikelyEnglishText(value: string) {
  const text = value.trim().toLowerCase();
  if (!text) return false;
  return /\b(the|and|for|with|from|into|your|our|open|every|all|day|days|reviews?|offers?|beauty|service|services|quality|trusted|member|members|booking|polished|experience|luxurious|journey|complimentary|receive|perfect|designed)\b/.test(text);
}

function safeEnglishFallback(value: string | null | undefined) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || containsLikelyVietnameseText(text)) return null;
  return text;
}

function safeTextForLocale(locale: Locale, value: string | null | undefined, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  if (locale === "en" && containsLikelyVietnameseText(text)) return fallback;
  return text;
}

function resolveDynamicText(
  locale: Locale,
  baseValue: string | null | undefined,
  translations: LocalizedTextValue | null | undefined,
  field: string,
  legacyFallback?: string | null,
  missingEnglishFallback?: string | null,
) {
  const parsed = parseLocalizedTextValue(translations);
  const direct = parsed?.[locale]?.[field];
  if (typeof direct === "string" && direct.trim()) {
    if (locale !== "en" || !containsLikelyVietnameseText(direct)) return direct;
  }

  if (locale === "en") {
    return safeEnglishFallback(legacyFallback) ?? missingEnglishFallback ?? null;
  }

  const defaultLocaleFallback = parsed?.vi?.[field];
  if (typeof defaultLocaleFallback === "string" && defaultLocaleFallback.trim()) {
    return defaultLocaleFallback;
  }

  return legacyFallback ?? baseValue ?? null;
}

function resolveDynamicStringArray(
  locale: Locale,
  baseValue: string[] | null | undefined,
  translations: LocalizedTextValue | null | undefined,
  field: string,
  legacyFallback?: string[] | null,
  missingEnglishFallback?: string[] | null,
) {
  const parsed = parseLocalizedTextValue(translations);
  const direct = parsed?.[locale]?.[field];
  if (Array.isArray(direct)) {
    if (locale !== "en" || !direct.some((item) => typeof item === "string" && containsLikelyVietnameseText(item))) {
      return direct;
    }
  }

  if (locale === "en") {
    return legacyFallback ?? missingEnglishFallback ?? null;
  }

  const defaultLocaleFallback = parsed?.vi?.[field];
  if (Array.isArray(defaultLocaleFallback)) return defaultLocaleFallback;

  return legacyFallback ?? baseValue ?? null;
}

const EN_FALLBACKS = {
  serviceTitle: "Service",
  serviceDescription: "Service details coming soon.",
  storefrontName: "Storefront",
  storefrontCategory: "Nail & Beauty",
  storefrontDescription: "Store information coming soon.",
  storefrontAddress: "Address coming soon.",
  storefrontReviews: "Reviews",
  openingHours: "Opening hours coming soon.",
  highlight: "Trusted studio",
  productName: "Product",
  productSubtitle: "Product details coming soon.",
  productPrice: "Contact for price",
  productType: "Item",
  teamRole: "Team member",
  teamBio: "Team details coming soon.",
  galleryTitle: "Gallery image",
  offerTitle: "Offer",
  offerDescription: "Offer details coming soon.",
  offerBadge: "Offer",
  postTitle: "Update",
  postSummary: "Update details coming soon.",
  postBody: "Update details coming soon.",
  sourcePlatform: "Update",
};

const PERK_DICTIONARY: Record<string, string> = {
  "tich diem doi qua": "Collect points for rewards",
  "uu dai sinh nhat": "Birthday perks",
  "qua tang sinh nhat": "Birthday gifts",
  "uu tien dat lich": "Priority booking",
  "uu tien khung gio dep": "Priority time slots",
  "uu tien ky thuat vien": "Priority technician access",
  "giam gia dac biet": "Special discounts",
  "voucher theo hang": "Tier-based vouchers",
  "mien phi add-on": "Free add-ons",
  "combo cham soc tay": "Hand care add-on",
  "qua tang theo hang": "Tier-exclusive gifts",
  "uu dai theo hang": "Tier-based perks",
};

const STORE_HIGHLIGHT_DICTIONARY: Record<string, string> = {
  "uy tin": "Trusted",
  "studio uy tin": "Trusted studio",
  "salon uy tin": "Trusted salon",
  "chat luong": "Quality",
  "chat luong cao": "High quality",
  "tan tam": "Attentive",
  "tu van tan tam": "Thoughtful consultation",
  "chuyen nghiep": "Professional",
  "ky thuat chuan": "Skilled technicians",
  "ve sinh chuan": "Hygienic tools",
  "san pham chinh hang": "Authentic products",
  "dat lich linh hoat": "Flexible booking",
};

const STOREFRONT_DESCRIPTION_DICTIONARY: Record<string, string> = {
  "khong gian storefront cho mobile explore, gom lookbook, doi ngu, san pham va thong tin cua hang.":
    "A mobile Explore storefront with lookbook styles, team, products, and store details.",
  "khong gian cua tiem cho mobile explore, gom lookbook, doi ngu, san pham va thong tin cua hang.":
    "A mobile Explore storefront with lookbook styles, team, products, and store details.",
  "khong gian cua tiem cho mobile explore, gom lookbook, doi ngu, san pham va thong tin cua tiem.":
    "A mobile Explore storefront with lookbook styles, team, products, and store details.",
};

const STOREFRONT_REVIEWS_DICTIONARY: Record<string, string> = {
  "128 danh gia": "128 reviews",
};

const STOREFRONT_ADDRESS_DICTIONARY: Record<string, string> = {
  "38a ngach 358/40 bui xuong trach, khuong dinh, thanh xuan, ha noi":
    "38A, Alley 358/40 Bui Xuong Trach, Khuong Dinh, Thanh Xuan, Hanoi",
};

const OPENING_HOURS_DICTIONARY: Record<string, string> = {
  "mo cua: 09:00 - 21:00 (tat ca ngay)": "Open: 09:00 - 21:00 (Every day)",
};

const GALLERY_TITLE_DICTIONARY: Record<string, string> = {
  "khong gian storefront": "Storefront space",
  "khong gian cua tiem": "Storefront space",
  "khong gian cua hang": "Storefront space",
  "ban tiep don": "Reception desk",
  "mau french chic": "French chic look",
  "mau milky glow": "Milky glow look",
  "team tai cua hang": "In-store team",
  "nhan su cua tiem": "In-store team",
  "nhan su cua hang": "In-store team",
  "goc decor anh kim": "Metallic decor corner",
};

const ROLE_LABEL_DICTIONARY: Record<string, string> = {
  "chu cua hang": "Owner",
  "quan ly": "Manager",
  "nhan vien": "Staff",
  "nail artist": "Nail Artist",
};

const PRODUCT_TYPE_DICTIONARY: Record<string, string> = {
  accessory: "Accessory",
  care: "Care",
  gel: "Gel",
  polish: "Polish",
  tool: "Tool",
};

const PRODUCT_NAME_DICTIONARY: Record<string, string> = {
  "charm dinh mong anh bac": "Silver Nail Charms",
  "son gel nude milk": "Milk Nude Gel Polish",
  "dau duong vien mong": "Cuticle Oil",
  "set phu kien nail box": "Nail Accessory Box",
  "dau duong mong cham": "Cham Nail Care Oil",
  "son gel premium": "Premium Gel Polish",
  "base gel cham": "Cham Base Gel",
  "top gel no-wipe cham": "Cham No-Wipe Top Gel",
  "bo co nail art": "Nail Art Brush Set",
  "dua mong cao cap": "Premium Nail File",
  "kem duong tay": "Hand Cream",
  "cay day da": "Cuticle Pusher",
};

const PRODUCT_SUBTITLE_DICTIONARY: Record<string, string> = {
  "phu kien ban tai cua hang": "In-store accessories",
  "phu kien ban tai cua tiem": "In-store accessories",
  "tong mau de phoi lookbook": "Easy shades to match lookbook styles",
  "cham soc sau khi lam mong": "After-service nail care",
  "goi phu kien cho layout sang trong": "Accessories for a luxury layout",
  "duong am - bong khoe - huong nhe": "Moisturizing - healthy shine - light scent",
  "ben mau - len form chuan - an toan": "Long-lasting - clean shape - safe",
  "bao ve nen mong - tang do bam": "Protects natural nails - improves adhesion",
  "bong dep - khong luu gel - sieu ben": "Glossy finish - no sticky layer - extra durable",
  "bo co chuan salon cho ve net va dap gel": "Salon-grade brushes for line art and gel work",
  "em tay - chuan form - diu voi mong": "Comfortable grip - clean shaping - gentle on nails",
  "mem da - giu am - huong thanh": "Softens skin - locks in moisture - fresh scent",
  "chuan salon - ben chac - de thao tac": "Salon-grade - sturdy - easy to use",
};

const LOOKBOOK_NAME_DICTIONARY: Record<string, string> = {
  "mau clean nude han": "Korean Clean Nude",
  "mau cat eye khoi": "Smoky Cat Eye",
  "mau mat meo anh khoi": "Smoky Cat Eye",
  "mau french chrome": "French Chrome",
  "mau cherry red gloss": "Cherry Red Gloss",
  "mau mocha glazed": "Mocha Glazed",
  "mau charm han sang": "Korean Charm Luxury",
};

const LOOKBOOK_BLURB_DICTIONARY: Record<string, string> = {
  "tone nude sua trong treo, hop cong so va di choi hang ngay.": "A sheer milk-nude tone for workdays and everyday outings.",
  "hieu ung mat meo anh khoi sang tay, noi bat duoi anh den.": "A smoky cat-eye effect that looks polished and stands out under light.",
  "mau mat meo anh khoi": "A smoky cat-eye effect that looks polished and stands out under light.",
  "french dau mong ket hop anh chrome toi gian, thanh lich va hien dai.":
    "Minimal chrome French tips with an elegant, modern finish.",
  "do cherry bong guong, ton da va cuc hop mua le hoi.": "Glossy cherry red that flatters the skin and fits festive looks.",
  "sac nau sua phu glaze nhe, sang nhung khong pho.": "Soft milk-brown glaze that feels refined without being loud.",
  "thiet ke dinh charm nho gon, hop chup anh va di tiec.": "Compact charm details made for photos and evening plans.",
  "cap nhat tu menu cham beauty": "Updated from the CHAM BEAUTY menu",
};

const OFFER_TITLE_DICTIONARY: Record<string, string> = {
  "giam 20%": "20% off",
  "giam 10%": "10% off",
  "giam 30k": "30k off",
  "uu dai sinh nhat": "Birthday offer",
};

const OFFER_DESCRIPTION_DICTIONARY: Record<string, string> = {
  "tat ca dich vu nail art": "All nail art services",
  "cho don tu 500k": "For orders from 500k",
  "cho dich vu tu 300k": "For services from 300k",
};

const USAGE_HINT_DICTIONARY: Record<string, string> = {
  "dung khi dat lich hoac bao truc tiep cho cua hang de duoc ap dung.": "Use this when booking or mention it directly at the store for assistance.",
  "dung khi dat lich": "Use when booking",
  "bao ma bronze50k khi dat lich hoac truoc luc checkout de cua hang xac nhan uu dai.":
    "Mention code BRONZE50K when booking or before checkout so the store can confirm the offer.",
  "dung uu dai bronze": "Use Bronze offer",
  "dung uu dai silver": "Use Silver offer",
  "dat lich voi uu dai gold": "Book with Gold offer",
};

const NOTIFICATION_TITLE_DICTIONARY: Record<string, string> = {
  "dat lich da xac nhan": "Booking confirmed",
  "nhac lich hen": "Appointment reminder",
  "uu dai dac biet": "Special offer",
  "danh gia dich vu": "Rate your service",
};

const NOTIFICATION_BODY_DICTIONARY: Record<string, string> = {
  "cam on ban da ghe tham. hay de lai danh gia de chung toi cai thien.": "Thanks for visiting us. Leave a review to help us improve.",
};

export function localizeTierName(locale: Locale, name: string | null | undefined, code?: string | null) {
  const text = typeof name === "string" ? name.trim() : "";
  if (!text) return text;

  if (locale === "vi") {
    switch ((code || text).trim().toUpperCase()) {
      case "REGULAR":
        return "Thành viên thường";
      case "BRONZE":
        return "Bronze";
      case "SILVER":
        return "Silver";
      case "GOLD":
        return "Gold";
      case "PLATINUM":
        return "Platinum";
      case "DIAMOND":
        return "Diamond";
      default:
        return restoreVietnameseText(text, invertDictionary({
          "thanh vien thuong": "Standard member",
          bronze: "Bronze",
          silver: "Silver",
          gold: "Gold",
          platinum: "Platinum",
          diamond: "Diamond",
          "member gold": "Gold member",
        }));
    }
  }

  switch ((code || text).trim().toUpperCase()) {
    case "REGULAR":
      return "Standard member";
    case "BRONZE":
      return "Bronze";
    case "SILVER":
      return "Silver";
    case "GOLD":
      return "Gold";
    case "PLATINUM":
      return "Platinum";
    case "DIAMOND":
      return "Diamond";
    default:
      return pickEnglishText(locale, text, {
        "thanh vien thuong": "Standard member",
        bronze: "Bronze",
        silver: "Silver",
        gold: "Gold",
        platinum: "Platinum",
        diamond: "Diamond",
        "member gold": "Gold member",
      }) ?? text;
  }
}

export function localizeTierDescription(locale: Locale, tier: Pick<CustomerMembershipTier, "code" | "description">) {
  if (locale === "vi") {
    switch ((tier.code || "").trim().toUpperCase()) {
      case "BRONZE":
        return "Hạng khởi đầu dành cho khách mới bắt đầu tích lũy quyền lợi thành viên.";
      case "SILVER":
        return "Phù hợp với khách quay lại đều và bắt đầu nhận thêm ưu tiên.";
      case "GOLD":
        return "Dành cho khách thân thiết với quyền lợi rõ ràng và trải nghiệm tốt hơn.";
      case "PLATINUM":
        return "Hạng cao cấp với nhiều ưu tiên hơn trong lịch hẹn và quà tặng.";
      case "DIAMOND":
        return "Hạng cao nhất với đặc quyền nổi bật và trải nghiệm chăm sóc ưu tiên.";
      default:
        return tier.description;
    }
  }

  switch ((tier.code || "").trim().toUpperCase()) {
    case "BRONZE":
      return "The starting tier for customers just beginning to accumulate membership perks.";
    case "SILVER":
      return "A good fit for returning customers who are starting to receive extra priority.";
    case "GOLD":
      return "Designed for loyal customers with clearer perks and a better overall experience.";
    case "PLATINUM":
      return "A premium tier with stronger appointment priority and better gifts.";
    case "DIAMOND":
      return "The highest tier with standout privileges and priority care.";
    default:
      return tier.description;
  }
}

export function localizeTierPerk(locale: Locale, perk: string) {
  return pickLocalizedText(locale, perk, PERK_DICTIONARY) ?? perk;
}

export function localizeOfferTitle(locale: Locale, title: string) {
  return pickLocalizedText(locale, title, OFFER_TITLE_DICTIONARY) ?? title;
}

export function localizeOfferDescription(locale: Locale, description: string | null | undefined) {
  return pickLocalizedText(locale, description, OFFER_DESCRIPTION_DICTIONARY);
}

export function localizeUsageHint(locale: Locale, hint: string | null | undefined) {
  const localized = pickLocalizedText(locale, hint, USAGE_HINT_DICTIONARY);
  if (localized) return localized;
  return locale === "en" ? safeEnglishFallback(hint) : (typeof hint === "string" ? hint.trim() || null : null);
}

export function localizeDynamicServiceText(
  locale: Locale,
  value: string | null | undefined,
  translations: LocalizedTextValue | null | undefined,
  field: "name" | "short_description" = "name",
) {
  const fallback = field === "name" ? EN_FALLBACKS.serviceTitle : EN_FALLBACKS.serviceDescription;
  const dictionaryFallback =
    field === "name"
      ? pickLocalizedText(locale, value, LOOKBOOK_NAME_DICTIONARY)
      : pickLocalizedText(locale, value, LOOKBOOK_BLURB_DICTIONARY);
  return (
    resolveDynamicText(locale, value, translations, field, dictionaryFallback, fallback) ??
    safeTextForLocale(locale, value, fallback)
  );
}

export function localizeStorefrontCategory(locale: Locale, category: string | null | undefined) {
  return pickLocalizedText(locale, category, {
    "nail & beauty": "Nail & Beauty",
    nail: "Nail",
    "nail - mi": "Nails & Lashes",
    "nail - beauty": "Nail & Beauty",
  });
}

export function localizeStorefrontDescription(locale: Locale, description: string | null | undefined) {
  return pickLocalizedText(locale, description, STOREFRONT_DESCRIPTION_DICTIONARY);
}

export function localizeStorefrontAddress(locale: Locale, address: string | null | undefined) {
  return pickLocalizedText(locale, address, STOREFRONT_ADDRESS_DICTIONARY);
}

export function localizeStorefrontHighlight(locale: Locale, highlight: string) {
  const localized = pickLocalizedText(locale, highlight, STORE_HIGHLIGHT_DICTIONARY);
  if (localized) return localized;
  if (locale === "en") return safeEnglishFallback(highlight) ?? EN_FALLBACKS.highlight;
  return highlight;
}

export function localizeOpeningHours(locale: Locale, value: string | null | undefined) {
  return pickLocalizedText(locale, value, OPENING_HOURS_DICTIONARY);
}

export function localizeGalleryTitle(locale: Locale, title: string | null | undefined) {
  return pickLocalizedText(locale, title, GALLERY_TITLE_DICTIONARY);
}

export function localizeRoleLabel(locale: Locale, roleLabel: string | null | undefined) {
  return pickLocalizedText(locale, roleLabel, ROLE_LABEL_DICTIONARY);
}

export function localizeProductType(locale: Locale, productType: string | null | undefined) {
  return pickLocalizedText(locale, productType, PRODUCT_TYPE_DICTIONARY);
}

export function localizeProductName(locale: Locale, name: string | null | undefined) {
  return pickLocalizedText(locale, name, PRODUCT_NAME_DICTIONARY);
}

export function localizeProductSubtitle(locale: Locale, subtitle: string | null | undefined) {
  return pickLocalizedText(locale, subtitle, PRODUCT_SUBTITLE_DICTIONARY);
}

export function localizeNotificationTitle(locale: Locale, title: string) {
  return pickLocalizedText(locale, title, NOTIFICATION_TITLE_DICTIONARY) ?? safeTextForLocale(locale, title, EN_FALLBACKS.postTitle);
}

export function localizeNotificationBody(locale: Locale, body: string) {
  return pickLocalizedText(locale, body, NOTIFICATION_BODY_DICTIONARY) ?? safeTextForLocale(locale, body, EN_FALLBACKS.postBody);
}

const LOOKBOOK_TONE_DICTIONARY: Record<string, string> = {
  "nhe nhang": "Soft",
  "don gian": "Minimal",
  "sang trong": "Luxury",
  "ca tinh": "Edgy",
  "noi bat": "Standout",
  "cham soc": "Care",
};

const LOOKBOOK_BADGE_DICTIONARY: Record<string, string> = {
  hot: "Hot",
  trend: "Trend",
  "noi bat": "Featured",
  lookbook: "Lookbook",
};

const SOURCE_PLATFORM_DICTIONARY: Record<string, string> = {
  "moi cap nhat": "Just updated",
  "hot trend": "Hot trend",
  "uu dai": "Offers",
  "cap nhat": "Update",
};

const POST_TITLE_DICTIONARY: Record<string, string> = {
  "3 mau nail hop dau tuan": "3 nail looks for the start of the week",
  "giu mau gel ben hon": "How to keep gel color fresh longer",
  "uu dai thanh vien trong thang": "Monthly member offers",
};

const POST_SUMMARY_DICTIONARY: Record<string, string> = {
  "goi y nhanh cac tone de di lam va di choi": "Quick shade ideas for workdays and casual plans.",
  "goi y nhanh cac tone de di lam va di choi.": "Quick shade ideas for workdays and casual plans.",
  "nhung cach cham soc don gian sau khi lam mong": "Simple aftercare tips after your nail appointment.",
  "nhung cach cham soc don gian sau khi lam mong.": "Simple aftercare tips after your nail appointment.",
  "kiem tra hang thanh vien de nhan uu dai phu hop": "Check your membership tier for matching offers.",
  "kiem tra hang thanh vien de nhan uu dai phu hop.": "Check your membership tier for matching offers.",
};

function localizePostTitle(locale: Locale, title: string | null | undefined) {
  return pickLocalizedText(locale, title, POST_TITLE_DICTIONARY);
}

function localizePostSummary(locale: Locale, summary: string | null | undefined) {
  return pickLocalizedText(locale, summary, POST_SUMMARY_DICTIONARY);
}

function formatEnglishPriceLabel(value: string | null | undefined) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (/contact|price/i.test(text)) return "Contact for price";

  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/đ/gi, " VND")
    .replace(/\bd\b/gi, "VND")
    .trim();

  if (!/VND/i.test(normalized)) return null;

  return normalized
    .replace(/\./g, ",")
    .replace(/\s*VND/i, " VND")
    .replace(/vnd/g, "VND")
    .trim();
}

export function localizeLookbookItem(locale: Locale, item: LookbookItem) {
  const title =
    resolveDynamicText(
      locale,
      item.title,
      item.translations,
      "name",
      pickLocalizedText(locale, item.title, LOOKBOOK_NAME_DICTIONARY),
      EN_FALLBACKS.serviceTitle,
    ) ??
    item.title;
  const blurb =
    resolveDynamicText(
      locale,
      item.blurb,
      item.translations,
      "short_description",
      pickLocalizedText(locale, item.blurb, LOOKBOOK_BLURB_DICTIONARY),
      EN_FALLBACKS.serviceDescription,
    ) ?? item.blurb;
  const tone =
    resolveDynamicText(
      locale,
      item.tone,
      item.translations,
      "lookbook_tone",
      pickLocalizedText(locale, item.tone, LOOKBOOK_TONE_DICTIONARY),
      EN_FALLBACKS.serviceTitle,
    ) ?? item.tone;
  const badge =
    resolveDynamicText(
      locale,
      item.badge,
      item.translations,
      "lookbook_badge",
      pickLocalizedText(locale, item.badge, LOOKBOOK_BADGE_DICTIONARY),
      null,
    ) ?? item.badge;
  const durationLabel = resolveDynamicText(
    locale,
    item.durationLabel ?? formatLocalizedDurationLabel(locale, item.durationMin),
    item.translations,
    "duration_label",
  ) ?? formatLocalizedDurationLabel(locale, item.durationMin);
  const fallbackPrice =
    item.basePrice != null ? formatLookbookPrice(item.basePrice, locale) : item.price;
  const price =
    resolveDynamicText(
      locale,
      fallbackPrice,
      item.translations,
      "price_label",
      formatEnglishPriceLabel(item.price),
      locale === "en" ? EN_FALLBACKS.productPrice : null,
    ) ??
    fallbackPrice;

  return {
    ...item,
    title,
    blurb,
    tone,
    badge,
    price,
    durationLabel,
  };
}

export function localizeExploreStat(locale: Locale, stat: ExploreStat): ExploreStat {
  const dictionary: Record<string, string> = {
    services: locale === "en" ? "Services" : "Dich vu",
    team: locale === "en" ? "Team" : "Nhan su",
    gallery: locale === "en" ? "Gallery" : "Khong gian",
    offers: locale === "en" ? "Offers" : "Uu dai",
  };

  return {
    ...stat,
    label: dictionary[stat.id] ?? stat.label,
  };
}

export function localizeContentPost(locale: Locale, post: CustomerContentPost) {
  const translated = ((post.translations ?? post.metadata?.translations) ?? null) as
    | { en?: { title?: string; summary?: string; body?: string; sourcePlatform?: string }; vi?: { title?: string; summary?: string; body?: string; sourcePlatform?: string } }
    | null;
  const preferred = locale === "en" ? translated?.en : translated?.vi;

  return {
    ...post,
    title:
      resolveDynamicText(
        locale,
        post.title,
        post.translations ?? translated,
        "title",
        localizePostTitle(locale, post.title) ?? preferred?.title?.trim() ?? null,
        EN_FALLBACKS.postTitle,
      ) ?? safeTextForLocale(locale, post.title, EN_FALLBACKS.postTitle),
    summary:
      resolveDynamicText(
        locale,
        post.summary,
        post.translations ?? translated,
        "summary",
        localizePostSummary(locale, post.summary) ?? preferred?.summary?.trim() ?? null,
        EN_FALLBACKS.postSummary,
      ) ?? safeTextForLocale(locale, post.summary, EN_FALLBACKS.postSummary),
    body:
      resolveDynamicText(
        locale,
        post.body,
        post.translations ?? translated,
        "body",
        localizePostSummary(locale, post.body) ?? preferred?.body?.trim() ?? null,
        EN_FALLBACKS.postBody,
      ) ?? safeTextForLocale(locale, post.body, EN_FALLBACKS.postBody),
    sourcePlatform:
      resolveDynamicText(
        locale,
        post.sourcePlatform,
        post.translations ?? translated,
        "source_platform",
        preferred?.sourcePlatform?.trim() || pickLocalizedText(locale, post.sourcePlatform, SOURCE_PLATFORM_DICTIONARY),
        EN_FALLBACKS.sourcePlatform,
      ) ?? safeTextForLocale(locale, post.sourcePlatform, EN_FALLBACKS.sourcePlatform),
  };
}

export function localizeStorefront(locale: Locale, storefront: ExploreStorefront | null) {
  if (!storefront) return null;

  const localizedHighlights =
    resolveDynamicStringArray(
      locale,
      storefront.highlights,
      storefront.translations,
      "highlights",
      null,
      [EN_FALLBACKS.highlight],
    ) ?? storefront.highlights;

  return {
    ...storefront,
    name:
      resolveDynamicText(locale, storefront.name, storefront.translations, "name", safeEnglishFallback(storefront.name), EN_FALLBACKS.storefrontName) ??
      safeTextForLocale(locale, storefront.name, EN_FALLBACKS.storefrontName),
    category: resolveDynamicText(
      locale,
      storefront.category,
      storefront.translations,
      "category",
      localizeStorefrontCategory(locale, storefront.category),
      EN_FALLBACKS.storefrontCategory,
    ),
    description: resolveDynamicText(
      locale,
      storefront.description,
      storefront.translations,
      "description",
      localizeStorefrontDescription(locale, storefront.description),
      EN_FALLBACKS.storefrontDescription,
    ),
    reviewsLabel: resolveDynamicText(
      locale,
      storefront.reviewsLabel,
      storefront.translations,
      "reviews_label",
      pickLocalizedText(locale, storefront.reviewsLabel, STOREFRONT_REVIEWS_DICTIONARY),
      EN_FALLBACKS.storefrontReviews,
    ),
    addressLine: resolveDynamicText(
      locale,
      storefront.addressLine,
      storefront.translations,
      "address_line",
      localizeStorefrontAddress(locale, storefront.addressLine),
      EN_FALLBACKS.storefrontAddress,
    ),
    openingHours: resolveDynamicText(
      locale,
      storefront.openingHours,
      storefront.translations,
      "opening_hours",
      localizeOpeningHours(locale, storefront.openingHours),
      EN_FALLBACKS.openingHours,
    ),
    highlights: (localizedHighlights.length ? localizedHighlights : [EN_FALLBACKS.highlight]).map((item) =>
      localizeStorefrontHighlight(locale, item),
    ),
  };
}

export function localizeTeamMember(locale: Locale, member: ExploreTeamMember) {
  return {
    ...member,
    displayName:
      resolveDynamicText(locale, member.displayName, member.translations, "display_name", null, member.displayName) ??
      safeTextForLocale(locale, member.displayName, EN_FALLBACKS.teamRole),
    roleLabel: resolveDynamicText(
      locale,
      member.roleLabel,
      member.translations,
      "role_label",
      localizeRoleLabel(locale, member.roleLabel),
      EN_FALLBACKS.teamRole,
    ),
    bio: resolveDynamicText(locale, member.bio, member.translations, "bio", null, EN_FALLBACKS.teamBio),
  };
}

export function localizeGalleryItem(locale: Locale, item: ExploreGalleryItem) {
  return {
    ...item,
    title: resolveDynamicText(locale, item.title, item.translations, "title", localizeGalleryTitle(locale, item.title), EN_FALLBACKS.galleryTitle),
  };
}

export function localizeProduct(locale: Locale, item: ExploreProduct) {
  return {
    ...item,
    name:
      resolveDynamicText(locale, item.name, item.translations, "name", localizeProductName(locale, item.name), EN_FALLBACKS.productName) ??
      safeTextForLocale(locale, item.name, EN_FALLBACKS.productName),
    subtitle: resolveDynamicText(
      locale,
      item.subtitle,
      item.translations,
      "subtitle",
      localizeProductSubtitle(locale, item.subtitle),
      EN_FALLBACKS.productSubtitle,
    ),
    priceLabel: resolveDynamicText(
      locale,
      item.priceLabel,
      item.translations,
      "price_label",
      formatEnglishPriceLabel(item.priceLabel),
      EN_FALLBACKS.productPrice,
    ),
    productType: resolveDynamicText(
      locale,
      item.productType,
      item.translations,
      "product_type",
      localizeProductType(locale, item.productType),
      EN_FALLBACKS.productType,
    ),
  };
}

export function localizeOfferCard<T extends MarketingOfferCard>(locale: Locale, offer: T): T {
  return {
    ...offer,
    title:
      resolveDynamicText(locale, offer.title, offer.translations, "title", localizeOfferTitle(locale, offer.title), EN_FALLBACKS.offerTitle) ??
      safeTextForLocale(locale, offer.title, EN_FALLBACKS.offerTitle),
    description:
      resolveDynamicText(
        locale,
        offer.description,
        offer.translations,
        "description",
        localizeOfferDescription(locale, offer.description),
        EN_FALLBACKS.offerDescription,
      ) ?? safeTextForLocale(locale, offer.description, EN_FALLBACKS.offerDescription),
    badge: resolveDynamicText(locale, offer.badge, offer.translations, "badge", null, EN_FALLBACKS.offerBadge),
  } as T;
}

export function localizeFavoriteService(locale: Locale, service: CustomerFavoriteService): CustomerFavoriteService {
  return {
    ...service,
    name:
      resolveDynamicText(locale, service.name, service.translations, "name", null, EN_FALLBACKS.serviceTitle) ??
      safeTextForLocale(locale, service.name, EN_FALLBACKS.serviceTitle),
    summary: resolveDynamicText(locale, service.summary, service.translations, "short_description", null, EN_FALLBACKS.serviceDescription),
    priceLabel: resolveDynamicText(
      locale,
      service.priceLabel,
      service.translations,
      "price_label",
      formatEnglishPriceLabel(service.priceLabel),
      EN_FALLBACKS.productPrice,
    ),
    durationLabel: resolveDynamicText(locale, service.durationLabel, service.translations, "duration_label"),
  };
}

export function localizeMembershipTier(locale: Locale, tier: CustomerMembershipTier | null) {
  if (!tier) return null;
  return {
    ...tier,
    name: localizeTierName(locale, tier.name, tier.code),
    description: localizeTierDescription(locale, tier),
    perks: tier.perks.map((perk) => localizeTierPerk(locale, perk)),
  };
}

export function localizeNotificationItem(
  locale: Locale,
  item: { title: string; body: string },
) {
  return {
    title: localizeNotificationTitle(locale, item.title),
    body: localizeNotificationBody(locale, item.body),
  };
}

const STOREFRONT_REQUIRED_FIELDS = ["name", "category", "description", "reviews_label", "address_line", "opening_hours", "highlights"] as const;
const OFFER_REQUIRED_FIELDS = ["title", "description", "badge"] as const;
const PRODUCT_REQUIRED_FIELDS = ["name", "subtitle", "price_label", "product_type"] as const;
const TEAM_REQUIRED_FIELDS = ["display_name", "role_label", "bio"] as const;
const GALLERY_REQUIRED_FIELDS = ["title"] as const;
const LOOKBOOK_REQUIRED_FIELDS = ["name", "short_description", "lookbook_badge", "lookbook_tone", "duration_label"] as const;
const CONTENT_POST_REQUIRED_FIELDS = ["title", "summary", "body", "source_platform"] as const;

function appendMissingFieldReport(
  issues: string[],
  locale: Locale,
  entityLabel: string,
  entityId: string,
  translations: LocalizedTextValue | null | undefined,
  requiredFields: readonly string[],
) {
  const missing = listMissingLocalizedFields(locale, translations ?? null, requiredFields as string[]);
  if (!missing.length) return;
  issues.push(`${entityLabel}:${entityId} -> ${missing.join(", ")}`);
}

export function collectHomeFeedLocalizationWarnings(locale: Locale, payload: CustomerHomeFeedPayload) {
  if (locale === "vi") return [];
  const issues: string[] = [];

  payload.lookbook.forEach((item) => {
    appendMissingFieldReport(issues, locale, "lookbook", item.id, item.translations, LOOKBOOK_REQUIRED_FIELDS);
  });
  payload.contentPosts.forEach((post) => {
    appendMissingFieldReport(issues, locale, "post", post.id, post.translations ?? post.metadata?.translations ?? null, CONTENT_POST_REQUIRED_FIELDS);
  });
  payload.offers.forEach((offer) => {
    appendMissingFieldReport(issues, locale, "offer", offer.id, offer.translations, OFFER_REQUIRED_FIELDS);
  });

  return issues;
}

export function collectExploreLocalizationWarnings(locale: Locale, payload: CustomerExplorePayload) {
  if (locale === "vi") return [];
  const issues: string[] = [];

  if (payload.storefront) {
    appendMissingFieldReport(
      issues,
      locale,
      "storefront",
      payload.storefront.id,
      payload.storefront.translations,
      STOREFRONT_REQUIRED_FIELDS,
    );
  }
  payload.featuredServices.forEach((service) => {
    appendMissingFieldReport(issues, locale, "service", service.id, service.translations, LOOKBOOK_REQUIRED_FIELDS);
  });
  payload.products.forEach((product) => {
    appendMissingFieldReport(issues, locale, "product", product.id, product.translations, PRODUCT_REQUIRED_FIELDS);
  });
  payload.team.forEach((member) => {
    appendMissingFieldReport(issues, locale, "team", member.id, member.translations, TEAM_REQUIRED_FIELDS);
  });
  payload.gallery.forEach((item) => {
    appendMissingFieldReport(issues, locale, "gallery", item.id, item.translations, GALLERY_REQUIRED_FIELDS);
  });
  payload.offers.forEach((offer) => {
    appendMissingFieldReport(issues, locale, "offer", offer.id, offer.translations, OFFER_REQUIRED_FIELDS);
  });

  return issues;
}
