import type {
  CustomerContentPost,
  CustomerMembershipTier,
  ExploreGalleryItem,
  ExploreProduct,
  ExploreStorefront,
  ExploreTeamMember,
  LookbookItem,
  Locale,
  MarketingOfferCard,
} from "@nails/shared";
import { formatLocalizedDurationLabel, resolveLocalizedField } from "@nails/shared";

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
  return dictionary[normalizeVietnamese(text)] ?? text;
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
    return dictionary[normalizeVietnamese(text)] ?? text;
  }
  return restoreVietnameseText(text, invertDictionary(dictionary));
}

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
  "chat luong cao": "High quality",
  "tan tam": "Attentive",
  "chuyen nghiep": "Professional",
};

const GALLERY_TITLE_DICTIONARY: Record<string, string> = {
  "khong gian storefront": "Storefront space",
  "ban tiep don": "Reception desk",
  "mau french chic": "French Chic look",
  "team tai cua hang": "In-store team",
};

const ROLE_DICTIONARY: Record<string, string> = {
  "ky thuat vien nail": "Nail Technician",
  "nail artist": "Nail Artist",
  "nhan vien tu van": "Beauty Consultant",
  "quan ly cua hang": "Store Manager",
};

const PRODUCT_TYPE_DICTIONARY: Record<string, string> = {
  "son gel": "Gel polish",
  "phu kien": "Accessories",
  "cham soc mong": "Nail care",
  "cham soc tay": "Hand care",
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
  return pickLocalizedText(locale, hint, USAGE_HINT_DICTIONARY);
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
  return pickLocalizedText(locale, description, {
    "khong gian lam nail am cung, nhieu mau hot trend va ky thuat vien theo sat tung lich hen.": "A warm nail studio with trending looks and technicians who follow each appointment closely.",
  });
}

export function localizeStorefrontHighlight(locale: Locale, highlight: string) {
  return pickLocalizedText(locale, highlight, STORE_HIGHLIGHT_DICTIONARY) ?? highlight;
}

export function localizeOpeningHours(locale: Locale, value: string | null | undefined) {
  return pickLocalizedText(locale, value, {
    "mo cua moi ngay: 09:00 - 21:00": "Open daily: 09:00 - 21:00",
  });
}

export function localizeGalleryTitle(locale: Locale, title: string | null | undefined) {
  return pickLocalizedText(locale, title, GALLERY_TITLE_DICTIONARY);
}

export function localizeRoleLabel(locale: Locale, roleLabel: string | null | undefined) {
  return pickLocalizedText(locale, roleLabel, ROLE_DICTIONARY);
}

export function localizeProductType(locale: Locale, productType: string | null | undefined) {
  return pickLocalizedText(locale, productType, PRODUCT_TYPE_DICTIONARY);
}

export function localizeNotificationTitle(locale: Locale, title: string) {
  return pickLocalizedText(locale, title, NOTIFICATION_TITLE_DICTIONARY) ?? title;
}

export function localizeNotificationBody(locale: Locale, body: string) {
  return pickLocalizedText(locale, body, NOTIFICATION_BODY_DICTIONARY) ?? body;
}

const LOOKBOOK_TITLE_DICTIONARY: Record<string, string> = {
  "nail han quoc": "Korean Nail",
  "mau han quoc": "Korean Nail",
  "mau french chic": "French Chic",
  "mau luxury gel": "Luxury Gel",
};

const LOOKBOOK_BLURB_DICTIONARY: Record<string, string> = {
  "nen nude trong veo ket hop diem nhan kim loai gon gang va do bong nhe.": "Sheer nude base with clean metallic accents and a glossy finish.",
  "form mong toi gian voi nen den bong va diem pha le hien dai.": "Minimal nail shape with glossy black polish and modern crystal details.",
};

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

export function localizeLookbookItem(locale: Locale, item: LookbookItem) {
  const title = resolveLocalizedField(
    locale,
    pickLocalizedText(locale, item.title, LOOKBOOK_TITLE_DICTIONARY) ?? item.title,
    item.translations,
    "name",
  ) ?? item.title;
  const blurb = resolveLocalizedField(
    locale,
    pickLocalizedText(locale, item.blurb, LOOKBOOK_BLURB_DICTIONARY) ?? item.blurb,
    item.translations,
    "short_description",
  ) ?? item.blurb;
  const tone = resolveLocalizedField(
    locale,
    pickLocalizedText(locale, item.tone, LOOKBOOK_TONE_DICTIONARY) ?? item.tone,
    item.translations,
    "lookbook_tone",
  ) ?? item.tone;
  const badge = resolveLocalizedField(
    locale,
    pickLocalizedText(locale, item.badge, LOOKBOOK_BADGE_DICTIONARY) ?? item.badge,
    item.translations,
    "lookbook_badge",
  ) ?? item.badge;
  const durationLabel = resolveLocalizedField(
    locale,
    item.durationLabel ?? formatLocalizedDurationLabel(locale, item.durationMin),
    item.translations,
    "duration_label",
  ) ?? formatLocalizedDurationLabel(locale, item.durationMin);

  return {
    ...item,
    title,
    blurb,
    tone,
    badge,
    durationLabel,
  };
}

export function localizeContentPost(locale: Locale, post: CustomerContentPost) {
  const translated = ((post.translations ?? post.metadata?.translations) ?? null) as
    | { en?: { title?: string; summary?: string; body?: string; sourcePlatform?: string }; vi?: { title?: string; summary?: string; body?: string; sourcePlatform?: string } }
    | null;
  const preferred = locale === "en" ? translated?.en : translated?.vi;

  return {
    ...post,
    title: resolveLocalizedField(locale, preferred?.title?.trim() || post.title, post.translations ?? translated, "title") ?? post.title,
    summary:
      resolveLocalizedField(locale, preferred?.summary?.trim() || post.summary, post.translations ?? translated, "summary") ?? post.summary,
    body: resolveLocalizedField(locale, preferred?.body?.trim() || post.body, post.translations ?? translated, "body") ?? post.body,
    sourcePlatform:
      resolveLocalizedField(
        locale,
        preferred?.sourcePlatform?.trim() ||
          (pickLocalizedText(locale, post.sourcePlatform, SOURCE_PLATFORM_DICTIONARY) ?? post.sourcePlatform),
        post.translations ?? translated,
        "source_platform",
      ) ?? post.sourcePlatform,
  };
}

export function localizeStorefront(locale: Locale, storefront: ExploreStorefront | null) {
  if (!storefront) return null;

  return {
    ...storefront,
    name: resolveLocalizedField(locale, storefront.name, storefront.translations, "name") ?? storefront.name,
    category: resolveLocalizedField(
      locale,
      localizeStorefrontCategory(locale, storefront.category),
      storefront.translations,
      "category",
    ),
    description: resolveLocalizedField(
      locale,
      localizeStorefrontDescription(locale, storefront.description),
      storefront.translations,
      "description",
    ),
    reviewsLabel: resolveLocalizedField(locale, storefront.reviewsLabel, storefront.translations, "reviews_label"),
    openingHours: resolveLocalizedField(
      locale,
      localizeOpeningHours(locale, storefront.openingHours),
      storefront.translations,
      "opening_hours",
    ),
    highlights:
      resolveLocalizedField<string[] | null>(locale, storefront.highlights, storefront.translations, "highlights")?.map((item) =>
        localizeStorefrontHighlight(locale, item),
      ) ?? storefront.highlights.map((item) => localizeStorefrontHighlight(locale, item)),
  };
}

export function localizeTeamMember(locale: Locale, member: ExploreTeamMember) {
  return {
    ...member,
    displayName: resolveLocalizedField(locale, member.displayName, member.translations, "display_name") ?? member.displayName,
    roleLabel: resolveLocalizedField(locale, localizeRoleLabel(locale, member.roleLabel), member.translations, "role_label"),
    bio: resolveLocalizedField(locale, member.bio, member.translations, "bio"),
  };
}

export function localizeGalleryItem(locale: Locale, item: ExploreGalleryItem) {
  return {
    ...item,
    title: resolveLocalizedField(locale, localizeGalleryTitle(locale, item.title), item.translations, "title"),
  };
}

export function localizeProduct(locale: Locale, item: ExploreProduct) {
  return {
    ...item,
    name: resolveLocalizedField(locale, item.name, item.translations, "name") ?? item.name,
    subtitle: resolveLocalizedField(locale, item.subtitle, item.translations, "subtitle"),
    priceLabel: resolveLocalizedField(locale, item.priceLabel, item.translations, "price_label"),
    productType: resolveLocalizedField(
      locale,
      localizeProductType(locale, item.productType),
      item.translations,
      "product_type",
    ),
  };
}

export function localizeOfferCard<T extends MarketingOfferCard>(locale: Locale, offer: T): T {
  return {
    ...offer,
    title: resolveLocalizedField(locale, localizeOfferTitle(locale, offer.title), offer.translations, "title") ?? offer.title,
    description:
      resolveLocalizedField(
        locale,
        localizeOfferDescription(locale, offer.description) ?? offer.description,
        offer.translations,
        "description",
      ) ?? offer.description,
    badge: resolveLocalizedField(locale, offer.badge, offer.translations, "badge"),
  } as T;
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
