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
  resolveManualLocalizedArray,
  resolveManualLocalizedText,
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

const MANUAL_TRANSLATION_PENDING = "Translation pending";

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
  return resolveManualDynamicText(
    locale,
    value,
    translations,
    field,
    field === "name" ? EN_FALLBACKS.serviceTitle : EN_FALLBACKS.serviceDescription,
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

function resolveManualDynamicText(
  locale: Locale,
  baseValue: string | null | undefined,
  translations: LocalizedTextValue | null | undefined,
  field: string,
  placeholder = MANUAL_TRANSLATION_PENDING,
) {
  const resolved = resolveManualLocalizedText(locale, baseValue, translations, field);
  if (locale === "en") {
    return resolved.missing ? placeholder : resolved.value;
  }
  return resolved.value;
}

function resolveManualDynamicStringArray(
  locale: Locale,
  baseValue: string[] | null | undefined,
  translations: LocalizedTextValue | null | undefined,
  field: string,
  placeholder = MANUAL_TRANSLATION_PENDING,
) {
  const resolved = resolveManualLocalizedArray(locale, baseValue, translations, field);
  if (locale === "en") {
    return resolved.missing || resolved.value.length === 0 ? [placeholder] : resolved.value;
  }
  return resolved.value;
}

export function localizeLookbookItem(locale: Locale, item: LookbookItem) {
  const title = resolveManualDynamicText(locale, item.title, item.translations, "name", EN_FALLBACKS.serviceTitle) ?? item.title;
  const blurb = resolveManualDynamicText(locale, item.blurb, item.translations, "short_description", EN_FALLBACKS.serviceDescription) ?? item.blurb;
  const tone = resolveManualDynamicText(locale, item.tone, item.translations, "lookbook_tone", MANUAL_TRANSLATION_PENDING) ?? item.tone;
  const badge = resolveManualDynamicText(locale, item.badge, item.translations, "lookbook_badge", MANUAL_TRANSLATION_PENDING) ?? item.badge;
  const durationLabel =
    resolveManualDynamicText(
      locale,
      item.durationLabel ?? formatLocalizedDurationLabel(locale, item.durationMin),
      item.translations,
      "duration_label",
      MANUAL_TRANSLATION_PENDING,
    ) ?? formatLocalizedDurationLabel(locale, item.durationMin);
  const fallbackPrice = item.basePrice != null ? formatLookbookPrice(item.basePrice, locale) : item.price;
  const price =
    resolveManualDynamicText(
      locale,
      fallbackPrice,
      item.translations,
      "price_label",
      EN_FALLBACKS.productPrice,
    ) ?? fallbackPrice;

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
  const translated = ((post.translations ?? post.metadata?.translations) ?? null) as LocalizedTextValue | null;

  return {
    ...post,
    title: resolveManualDynamicText(locale, post.title, post.translations ?? translated, "title", EN_FALLBACKS.postTitle) ?? post.title,
    summary: resolveManualDynamicText(locale, post.summary, post.translations ?? translated, "summary", EN_FALLBACKS.postSummary) ?? post.summary,
    body: resolveManualDynamicText(locale, post.body, post.translations ?? translated, "body", EN_FALLBACKS.postBody) ?? post.body,
    sourcePlatform:
      resolveManualDynamicText(
        locale,
        post.sourcePlatform,
        post.translations ?? translated,
        "source_platform",
        EN_FALLBACKS.sourcePlatform,
      ) ?? post.sourcePlatform,
  };
}

export function localizeStorefront(locale: Locale, storefront: ExploreStorefront | null) {
  if (!storefront) return null;

  const localizedHighlights = resolveManualDynamicStringArray(
    locale,
    storefront.highlights,
    storefront.translations,
    "highlights",
    EN_FALLBACKS.highlight,
  );

  return {
    ...storefront,
    name: resolveManualDynamicText(locale, storefront.name, storefront.translations, "name", EN_FALLBACKS.storefrontName) ?? storefront.name,
    category:
      resolveManualDynamicText(locale, storefront.category, storefront.translations, "category", EN_FALLBACKS.storefrontCategory) ??
      storefront.category,
    description:
      resolveManualDynamicText(
        locale,
        storefront.description,
        storefront.translations,
        "description",
        EN_FALLBACKS.storefrontDescription,
      ) ?? storefront.description,
    reviewsLabel:
      resolveManualDynamicText(
        locale,
        storefront.reviewsLabel,
        storefront.translations,
        "reviews_label",
        EN_FALLBACKS.storefrontReviews,
      ) ?? storefront.reviewsLabel,
    addressLine:
      resolveManualDynamicText(
        locale,
        storefront.addressLine,
        storefront.translations,
        "address_line",
        EN_FALLBACKS.storefrontAddress,
      ) ?? storefront.addressLine,
    openingHours:
      resolveManualDynamicText(
        locale,
        storefront.openingHours,
        storefront.translations,
        "opening_hours",
        EN_FALLBACKS.openingHours,
      ) ?? storefront.openingHours,
    highlights: localizedHighlights,
  };
}

export function localizeTeamMember(locale: Locale, member: ExploreTeamMember) {
  return {
    ...member,
    displayName:
      resolveManualDynamicText(locale, member.displayName, member.translations, "display_name", MANUAL_TRANSLATION_PENDING) ??
      member.displayName,
    roleLabel:
      resolveManualDynamicText(locale, member.roleLabel, member.translations, "role_label", EN_FALLBACKS.teamRole) ??
      member.roleLabel,
    bio: resolveManualDynamicText(locale, member.bio, member.translations, "bio", EN_FALLBACKS.teamBio) ?? member.bio,
  };
}

export function localizeGalleryItem(locale: Locale, item: ExploreGalleryItem) {
  return {
    ...item,
    title: resolveManualDynamicText(locale, item.title, item.translations, "title", EN_FALLBACKS.galleryTitle) ?? item.title,
  };
}

export function localizeProduct(locale: Locale, item: ExploreProduct) {
  return {
    ...item,
    name: resolveManualDynamicText(locale, item.name, item.translations, "name", EN_FALLBACKS.productName) ?? item.name,
    subtitle:
      resolveManualDynamicText(locale, item.subtitle, item.translations, "subtitle", EN_FALLBACKS.productSubtitle) ??
      item.subtitle,
    priceLabel:
      resolveManualDynamicText(locale, item.priceLabel, item.translations, "price_label", EN_FALLBACKS.productPrice) ??
      item.priceLabel,
    productType:
      resolveManualDynamicText(locale, item.productType, item.translations, "product_type", EN_FALLBACKS.productType) ??
      item.productType,
  };
}

export function localizeOfferCard<T extends MarketingOfferCard>(locale: Locale, offer: T): T {
  return {
    ...offer,
    title: resolveManualDynamicText(locale, offer.title, offer.translations, "title", EN_FALLBACKS.offerTitle) ?? offer.title,
    description:
      resolveManualDynamicText(
        locale,
        offer.description,
        offer.translations,
        "description",
        EN_FALLBACKS.offerDescription,
      ) ?? offer.description,
    badge: resolveManualDynamicText(locale, offer.badge, offer.translations, "badge", EN_FALLBACKS.offerBadge) ?? offer.badge,
  } as T;
}

export function localizeFavoriteService(locale: Locale, service: CustomerFavoriteService): CustomerFavoriteService {
  return {
    ...service,
    name: resolveManualDynamicText(locale, service.name, service.translations, "name", EN_FALLBACKS.serviceTitle) ?? service.name,
    summary:
      resolveManualDynamicText(
        locale,
        service.summary,
        service.translations,
        "short_description",
        EN_FALLBACKS.serviceDescription,
      ) ?? service.summary,
    priceLabel:
      resolveManualDynamicText(
        locale,
        service.priceLabel,
        service.translations,
        "price_label",
        EN_FALLBACKS.productPrice,
      ) ?? service.priceLabel,
    durationLabel:
      resolveManualDynamicText(
        locale,
        service.durationLabel,
        service.translations,
        "duration_label",
        MANUAL_TRANSLATION_PENDING,
      ) ?? service.durationLabel,
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
