import type { LookbookItem, MarketingOfferCard } from "./customer-feed";

export type ExploreStorefront = {
  id: string;
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
};

export type ExploreTeamMember = {
  id: string;
  displayName: string;
  roleLabel: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

export type ExploreGalleryItem = {
  id: string;
  title: string | null;
  imageUrl: string;
  kind: string | null;
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
  featuredServicesCount: number;
  teamCount: number;
  galleryCount: number;
  offersCount: number;
}): ExploreStat[] {
  return [
    {
      id: "services",
      label: "Dich vu",
      value: `${input.featuredServicesCount} mau`,
      icon: "shopping-bag",
    },
    {
      id: "team",
      label: "Nhan su",
      value: `${input.teamCount} nguoi`,
      icon: "users",
    },
    {
      id: "gallery",
      label: "Khong gian",
      value: `${input.galleryCount} anh`,
      icon: "image",
    },
    {
      id: "offers",
      label: "Uu dai",
      value: `${input.offersCount} moi`,
      icon: "tag",
    },
  ];
}
