import type { LookbookItem, MarketingOfferCard } from "./customer-feed";
import type { Locale } from "./i18n";
import type { LocalizedTextValue, TranslationMetaValue } from "./localization";

export type ExploreStorefront = {
  id: string;
  branchId: string | null;
  branchName: string | null;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  coverImageUrl: string | null;
  logoImageUrl: string | null;
  rating: number | null;
  reviewsLabel: string | null;
  addressLine: string | null;
  mapUrl: string | null;
  openingHours: string | null;
  phone: string | null;
  messengerUrl: string | null;
  instagramUrl: string | null;
  highlights: string[];
  translations: LocalizedTextValue | null;
  translationMeta: TranslationMetaValue | null;
};

export type ExploreStat = {
  id: string;
  label: string;
  value: string;
  icon?: string | null;
};

export type ExploreProduct = {
  id: string;
  name: string;
  subtitle: string | null;
  priceLabel: string | null;
  imageUrl: string | null;
  productType: string | null;
  isFeatured: boolean;
  translations: LocalizedTextValue | null;
  translationMeta: TranslationMetaValue | null;
};

export type ExploreTeamMember = {
  id: string;
  displayName: string;
  roleLabel: string | null;
  avatarUrl: string | null;
  bio: string | null;
  translations: LocalizedTextValue | null;
  translationMeta: TranslationMetaValue | null;
};

export type ExploreGalleryItem = {
  id: string;
  title: string | null;
  imageUrl: string;
  kind: string | null;
  translations: LocalizedTextValue | null;
  translationMeta: TranslationMetaValue | null;
};

export type ExploreMapCard = {
  addressLine: string | null;
  openingHours: string | null;
  mapUrl: string | null;
  imageUrl: string | null;
};

export type CustomerExplorePayload = {
  storefront: ExploreStorefront | null;
  stats: ExploreStat[];
  featuredServices: LookbookItem[];
  products: ExploreProduct[];
  team: ExploreTeamMember[];
  gallery: ExploreGalleryItem[];
  offers: MarketingOfferCard[];
  map: ExploreMapCard | null;
};

export function buildExploreStats(input: {
  locale?: Locale;
  featuredServicesCount: number;
  teamCount: number;
  galleryCount: number;
  offersCount: number;
}): ExploreStat[] {
  const locale = input.locale ?? "vi";

  return [
    {
      id: "services",
      label: locale === "en" ? "Services" : "Dich vu",
      value: locale === "en" ? `${input.featuredServicesCount} looks` : `${input.featuredServicesCount} mau`,
      icon: "shopping-bag",
    },
    {
      id: "team",
      label: locale === "en" ? "Team" : "Nhan su",
      value: locale === "en" ? `${input.teamCount} people` : `${input.teamCount} nguoi`,
      icon: "users",
    },
    {
      id: "gallery",
      label: locale === "en" ? "Gallery" : "Khong gian",
      value: locale === "en" ? `${input.galleryCount} photos` : `${input.galleryCount} anh`,
      icon: "image",
    },
    {
      id: "offers",
      label: locale === "en" ? "Offers" : "Uu dai",
      value: locale === "en" ? `${input.offersCount} new` : `${input.offersCount} moi`,
      icon: "tag",
    },
  ];
}
