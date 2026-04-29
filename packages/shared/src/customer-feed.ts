export type LookbookRow = {
  id?: string | null;
  name?: string | null;
  short_description?: string | null;
  image_url?: string | null;
  duration_min?: number | null;
  base_price?: number | null;
  featured_in_lookbook?: boolean | null;
  featured_in_home?: boolean | null;
  featured_in_explore?: boolean | null;
  lookbook_category?: string | null;
  lookbook_badge?: string | null;
  lookbook_tone?: string | null;
  duration_label?: string | null;
  display_order_home?: number | null;
  display_order_explore?: number | null;
  created_at?: string | null;
};

export type LookbookItem = {
  id: string;
  title: string;
  blurb: string;
  category: string | null;
  tone: string;
  badge: string;
  price: string;
  image: string;
  durationMin: number | null;
  durationLabel: string | null;
  aspectRatio: number;
  displayOrder: number;
  createdAt: string | null;
};

export type CustomerContentPost = {
  id: string;
  title: string;
  summary: string;
  body: string;
  coverImageUrl: string | null;
  contentType: "trend" | "care" | "news" | "offer_hint";
  sourcePlatform: string;
  publishedAt: string | null;
  priority: number;
  metadata: Record<string, unknown>;
};

export type MarketingOfferCard = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  badge: string | null;
  startsAt: string | null;
  endsAt: string | null;
  metadata: Record<string, unknown>;
};

function inferLookbookTone(text: string) {
  const value = text.toLowerCase();

  if (
    value.includes("cat eye") ||
    value.includes("chrome") ||
    value.includes("flash") ||
    value.includes("art") ||
    value.includes("design")
  ) {
    return "Noi bat";
  }

  if (
    value.includes("french") ||
    value.includes("luxury") ||
    value.includes("glazed") ||
    value.includes("charm")
  ) {
    return "Sang trong";
  }

  if (
    value.includes("spa") ||
    value.includes("care") ||
    value.includes("duong") ||
    value.includes("phuc hoi")
  ) {
    return "Cham soc";
  }

  return "Nhe nhang";
}

function inferLookbookBadge(text: string) {
  const value = text.toLowerCase();

  if (value.includes("cat eye") || value.includes("chrome") || value.includes("flash")) {
    return "Hot";
  }

  if (value.includes("french") || value.includes("nude") || value.includes("milk")) {
    return "Trend";
  }

  if (value.includes("design") || value.includes("art") || value.includes("charm")) {
    return "Noi bat";
  }

  return "Lookbook";
}

export function formatLookbookPrice(value?: number | null) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value ?? 0))}d`;
}

function normalizeLookbookCategory(row: LookbookRow, classifiedText: string) {
  const explicit = row.lookbook_category?.trim();
  if (explicit) return explicit;

  const value = classifiedText.toLowerCase();

  if (value.includes("french") || value.includes("luxury") || value.includes("glazed") || value.includes("charm")) {
    return "sang-trong";
  }

  if (value.includes("cat eye") || value.includes("chrome") || value.includes("flash") || value.includes("art")) {
    return "noi-bat";
  }

  if (value.includes("olive") || value.includes("matcha") || value.includes("ombre")) {
    return "ca-tinh";
  }

  return "don-gian";
}

function getDisplayOrder(row: LookbookRow, context: "default" | "home" | "explore") {
  if (context === "home") {
    return Number(row.display_order_home ?? row.display_order_explore ?? 0);
  }

  if (context === "explore") {
    return Number(row.display_order_explore ?? row.display_order_home ?? 0);
  }

  return Number(row.display_order_home ?? row.display_order_explore ?? 0);
}

export function normalizeLookbookRows(
  rows: LookbookRow[],
  options: { context?: "default" | "home" | "explore" } = {},
): LookbookItem[] {
  const context = options.context ?? "default";

  return rows
    .filter((row) => row.name && row.image_url)
    .map((row) => {
      const title = String(row.name ?? "");
      const blurb =
        row.short_description?.trim() ||
        `Thoi gian ${Number(row.duration_min ?? 0)} phut, len form gon va dung chat lookbook cua tiem.`;
      const classifiedText = `${title} ${blurb}`;

      return {
        id: String(row.id ?? row.name),
        title,
        blurb,
        category: normalizeLookbookCategory(row, classifiedText),
        tone: row.lookbook_tone?.trim() || inferLookbookTone(classifiedText),
        badge: row.lookbook_badge?.trim() || inferLookbookBadge(classifiedText),
        price: formatLookbookPrice(row.base_price),
        image: String(row.image_url ?? ""),
        durationMin: row.duration_min ?? null,
        durationLabel: row.duration_label?.trim() || (row.duration_min ? `${row.duration_min} phut` : null),
        aspectRatio: 1.2,
        displayOrder: getDisplayOrder(row, context),
        createdAt: row.created_at ?? null,
      };
    })
    .sort((left, right) => {
      if (left.displayOrder !== right.displayOrder) {
        return left.displayOrder - right.displayOrder;
      }

      return left.title.localeCompare(right.title, "vi");
    });
}
