"use client";

import Link from "next/link";
import { AppLazyImage } from "@/components/app-lazy-image";
import { DeferredRender } from "@/components/deferred-render";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPublicBookingRequest } from "@/lib/landing-booking";
import type { HomeFeedPayload } from "@/lib/landing-content";
import { getCurrentAuthenticatedSummary } from "@/lib/web-auth";
import { AuthModal } from "@/components/landing/auth-modal";
import { ManageDateTimePicker } from "@/components/manage-datetime-picker";
import type { CustomerExplorePayload, ExploreProduct } from "@nails/shared";
import { formatViDate, isCustomerRole, type AuthenticatedUserSummary } from "@nails/shared";

type BookingFormState = {
  customerName: string;
  customerPhone: string;
  selectedService: string;
  selectedDate: string;
  selectedTime: string;
  selectedDateTime: string;
  note: string;
};

type Testimonial = {
  id: string;
  name: string;
  quote: string;
};

type LandingPageClientProps = {
  initialHomeFeed: HomeFeedPayload;
  initialExplore: CustomerExplorePayload;
};

type LandingMobileCarouselProps<T> = {
  items: T[];
  slide: number;
  onSelectSlide: (index: number) => void;
  labelPrefix: string;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  itemsPerSlide?: number;
};

type LandingDesktopCarouselProps<T> = {
  items: T[];
  slide: number;
  onSelectSlide: (index: number) => void;
  labelPrefix: string;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  itemsPerSlide: number;
  gridClassName: string;
  dotsClassName?: string;
};

const FALLBACK_TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    name: "Thu Hằng",
    quote: "Không gian đẹp, nhân viên nhẹ nhàng, làm móng rất kỹ và bền. Mình rất thích.",
  },
  {
    id: "t2",
    name: "Ngọc Trâm",
    quote: "Mẫu nail đẹp, giá hợp lý. Mình sẽ quay lại và tiếp tục ủng hộ Chạm.",
  },
  {
    id: "t3",
    name: "Kim Anh",
    quote: "Dịch vụ chuyên nghiệp, sạch sẽ, sản phẩm xịn. Rất đáng thử.",
  },
];

const REFERENCE_HERO_IMAGE = "https://i.ibb.co/Pvs1Ft21/Nail-v-ng-kim.png";
const DEFAULT_MAP_ADDRESS = "Chạm Beauty 38A Ngách 358/40 Bùi Xương Trạch, Khương Đình, Hà Nội";
const DEFAULT_MAP_URL = `https://www.google.com/maps?q=${encodeURIComponent(DEFAULT_MAP_ADDRESS)}`;

const initialBookingState: BookingFormState = {
  customerName: "",
  customerPhone: "",
  selectedService: "",
  selectedDate: "",
  selectedTime: "",
  selectedDateTime: "",
  note: "",
};

function normalizeHomeFeedPayload(payload?: Partial<HomeFeedPayload> | null): HomeFeedPayload {
  return {
    lookbook: payload?.lookbook ?? [],
    contentPosts: payload?.contentPosts ?? [],
    offers: payload?.offers ?? [],
  };
}

function normalizeExplorePayload(payload?: Partial<CustomerExplorePayload> | null): CustomerExplorePayload {
  return {
    storefront: payload?.storefront ?? null,
    stats: payload?.stats ?? [],
    featuredServices: payload?.featuredServices ?? [],
    products: payload?.products ?? [],
    team: payload?.team ?? [],
    gallery: payload?.gallery ?? [],
    offers: payload?.offers ?? [],
    map: payload?.map ?? null,
  };
}

function buildEmbedMapUrl(mapUrl?: string | null, addressLine?: string | null) {
  if (mapUrl) {
    try {
      const url = new URL(mapUrl);
      if (url.pathname.includes("/embed")) return mapUrl;
      const query = url.searchParams.get("q") ?? addressLine ?? "";
      if (query) return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
    } catch {
      return addressLine ? `https://www.google.com/maps?q=${encodeURIComponent(addressLine)}&z=16&output=embed` : null;
    }
  }

  return addressLine ? `https://www.google.com/maps?q=${encodeURIComponent(addressLine)}&z=16&output=embed` : null;
}

function ProductGridCard({ product }: { product: ExploreProduct }) {
  return (
    <article className="landing-showcase-product landing-showcase-motion-card">
      {product.imageUrl ? (
        <AppLazyImage
          alt={product.name}
          className="h-full w-full object-cover"
          height={560}
          sizes="(max-width: 768px) 50vw, 25vw"
          src={product.imageUrl}
          width={560}
        />
      ) : null}
      <div className="landing-showcase-product__body">
        <h4>{product.name}</h4>
        <strong>{product.priceLabel ?? "Liên hệ"}</strong>
      </div>
    </article>
  );
}

function getProfileInitials(summary: AuthenticatedUserSummary | null) {
  if (!summary) return "C";
  const source = (summary.displayName ?? summary.email ?? "Customer").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function chunkItems<T>(items: T[], chunkSize: number) {
  if (chunkSize <= 0) return [items];
  return Array.from({ length: Math.ceil(items.length / chunkSize) }, (_, index) =>
    items.slice(index * chunkSize, index * chunkSize + chunkSize),
  );
}

function chunkItemsLoopFilled<T>(items: T[], chunkSize: number) {
  const chunks = chunkItems(items, chunkSize);
  if (!chunks.length || !items.length) return chunks;

  return chunks.map((chunk) => {
    if (chunk.length >= chunkSize) return chunk;
    const filled = [...chunk];
    let sourceIndex = 0;
    while (filled.length < chunkSize) {
      filled.push(items[sourceIndex % items.length]);
      sourceIndex += 1;
    }
    return filled;
  });
}

function LandingMobileCarousel<T>({
  items,
  slide,
  onSelectSlide,
  labelPrefix,
  getItemKey,
  renderItem,
  itemsPerSlide = 2,
}: LandingMobileCarouselProps<T>) {
  const slides = useMemo(() => chunkItemsLoopFilled(items, itemsPerSlide), [items, itemsPerSlide]);

  if (!slides.length) return null;

  return (
    <>
      <div className="landing-showcase__mobile-carousel">
        <div
          className="landing-showcase__mobile-carousel-track"
          style={{
            width: `${slides.length * 100}%`,
            transform: `translateX(-${slide * (100 / slides.length)}%)`,
          }}
        >
          {slides.map((group, index) => (
            <div
              key={`${labelPrefix}-${index}`}
              className="landing-showcase__mobile-carousel-slide"
              style={{ width: `${100 / slides.length}%` }}
            >
              {group.map((item) => (
                <div key={`${getItemKey(item)}-${index}`}>{renderItem(item)}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="landing-showcase__mobile-carousel-dots">
          {slides.map((_, index) => (
            <button
              key={`${labelPrefix}-dot-${index}`}
              type="button"
              className={index === slide ? "is-active" : ""}
              onClick={() => onSelectSlide(index)}
              aria-label={`${labelPrefix} ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function LandingDesktopCarousel<T>({
  items,
  slide,
  onSelectSlide,
  labelPrefix,
  getItemKey,
  renderItem,
  itemsPerSlide,
  gridClassName,
  dotsClassName,
}: LandingDesktopCarouselProps<T>) {
  const slides = useMemo(() => chunkItemsLoopFilled(items, itemsPerSlide), [items, itemsPerSlide]);

  if (!slides.length) return null;

  return (
    <>
      <div className="landing-showcase__desktop-carousel">
        <div
          className="landing-showcase__desktop-carousel-track"
          style={{
            width: `${slides.length * 100}%`,
            transform: `translateX(-${slide * (100 / slides.length)}%)`,
          }}
        >
          {slides.map((group, index) => (
            <div
              key={`${labelPrefix}-${index}`}
              className="landing-showcase__desktop-carousel-slide"
              style={{ width: `${100 / slides.length}%` }}
            >
              <div className={gridClassName}>
                {group.map((item) => (
                  <div key={`${getItemKey(item)}-${index}`}>{renderItem(item)}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 ? (
        <div className={dotsClassName ?? "landing-showcase__services-dots"}>
          {slides.map((_, index) => (
            <button
              key={`${labelPrefix}-dot-${index}`}
              type="button"
              className={index === slide ? "is-active" : ""}
              onClick={() => onSelectSlide(index)}
              aria-label={`${labelPrefix} ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

export function LandingPageClient({ initialExplore, initialHomeFeed }: LandingPageClientProps) {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [homeFeed] = useState<HomeFeedPayload>(() => normalizeHomeFeedPayload(initialHomeFeed));
  const [explore] = useState<CustomerExplorePayload>(() => normalizeExplorePayload(initialExplore));
  const [bookingState, setBookingState] = useState<BookingFormState>(initialBookingState);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUserSummary | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [serviceDesktopSlide, setServiceDesktopSlide] = useState(0);
  const [serviceMobileSlide, setServiceMobileSlide] = useState(0);
  const [storyMobileSlide, setStoryMobileSlide] = useState(0);
  const [productMobileSlide, setProductMobileSlide] = useState(0);
  const [testimonialMobileSlide, setTestimonialMobileSlide] = useState(0);
  const [storyDesktopSlide, setStoryDesktopSlide] = useState(0);
  const [productDesktopSlide, setProductDesktopSlide] = useState(0);

  useEffect(() => {
    void getCurrentAuthenticatedSummary()
      .then((summary) => setCurrentUser(summary))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthResolved(true));
  }, []);

  const storefront = explore.storefront;
  const featuredServices = useMemo(
    () => (homeFeed.lookbook.length ? homeFeed.lookbook : explore.featuredServices).slice(0, 8),
    [explore.featuredServices, homeFeed.lookbook],
  );
  const serviceDesktopSlides = useMemo(() => chunkItemsLoopFilled(featuredServices, 4), [featuredServices]);
  const serviceMobileSlides = useMemo(() => chunkItems(featuredServices, 2), [featuredServices]);
  useEffect(() => {
    if (serviceDesktopSlides.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setServiceDesktopSlide((current) => (current + 1) % serviceDesktopSlides.length);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [serviceDesktopSlides.length]);

  useEffect(() => {
    if (serviceDesktopSlide >= serviceDesktopSlides.length) {
      setServiceDesktopSlide(0);
    }
  }, [serviceDesktopSlide, serviceDesktopSlides.length]);

  const stories = useMemo(() => homeFeed.contentPosts.slice(0, 3), [homeFeed.contentPosts]);
  const products = useMemo(() => explore.products.slice(0, 8), [explore.products]);
  const testimonials = FALLBACK_TESTIMONIALS;
  const storyDesktopSlides = useMemo(() => chunkItemsLoopFilled(stories, 3), [stories]);
  const productDesktopSlides = useMemo(() => chunkItemsLoopFilled(products, 4), [products]);
  const storyMobileSlides = useMemo(() => chunkItems(stories, 2), [stories]);
  const productMobileSlides = useMemo(() => chunkItems(products, 2), [products]);
  const testimonialMobileSlides = useMemo(() => chunkItems(testimonials, 2), [testimonials]);

  useEffect(() => {
    if (serviceMobileSlides.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setServiceMobileSlide((current) => (current + 1) % serviceMobileSlides.length);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [serviceMobileSlides.length]);

  useEffect(() => {
    if (storyMobileSlides.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setStoryMobileSlide((current) => (current + 1) % storyMobileSlides.length);
    }, 4600);

    return () => window.clearInterval(intervalId);
  }, [storyMobileSlides.length]);

  useEffect(() => {
    if (storyDesktopSlides.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setStoryDesktopSlide((current) => (current + 1) % storyDesktopSlides.length);
    }, 4600);

    return () => window.clearInterval(intervalId);
  }, [storyDesktopSlides.length]);

  useEffect(() => {
    if (productMobileSlides.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setProductMobileSlide((current) => (current + 1) % productMobileSlides.length);
    }, 4400);

    return () => window.clearInterval(intervalId);
  }, [productMobileSlides.length]);

  useEffect(() => {
    if (productDesktopSlides.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setProductDesktopSlide((current) => (current + 1) % productDesktopSlides.length);
    }, 4400);

    return () => window.clearInterval(intervalId);
  }, [productDesktopSlides.length]);

  useEffect(() => {
    if (testimonialMobileSlides.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setTestimonialMobileSlide((current) => (current + 1) % testimonialMobileSlides.length);
    }, 4800);

    return () => window.clearInterval(intervalId);
  }, [testimonialMobileSlides.length]);

  useEffect(() => {
    if (serviceMobileSlide >= serviceMobileSlides.length) {
      setServiceMobileSlide(0);
    }
  }, [serviceMobileSlide, serviceMobileSlides.length]);

  useEffect(() => {
    if (storyMobileSlide >= storyMobileSlides.length) {
      setStoryMobileSlide(0);
    }
  }, [storyMobileSlide, storyMobileSlides.length]);

  useEffect(() => {
    if (storyDesktopSlide >= storyDesktopSlides.length) {
      setStoryDesktopSlide(0);
    }
  }, [storyDesktopSlide, storyDesktopSlides.length]);

  useEffect(() => {
    if (productMobileSlide >= productMobileSlides.length) {
      setProductMobileSlide(0);
    }
  }, [productMobileSlide, productMobileSlides.length]);

  useEffect(() => {
    if (productDesktopSlide >= productDesktopSlides.length) {
      setProductDesktopSlide(0);
    }
  }, [productDesktopSlide, productDesktopSlides.length]);

  useEffect(() => {
    if (testimonialMobileSlide >= testimonialMobileSlides.length) {
      setTestimonialMobileSlide(0);
    }
  }, [testimonialMobileSlide, testimonialMobileSlides.length]);

  const heroImage =
    REFERENCE_HERO_IMAGE ??
    storefront?.coverImageUrl ??
    explore.gallery[0]?.imageUrl ??
    featuredServices[0]?.image ??
    "https://images.unsplash.com/photo-1604902396830-aca29e19b067?q=80&w=1400";

  const storyImage =
    storefront?.coverImageUrl ??
    explore.gallery[0]?.imageUrl ??
    explore.gallery[1]?.imageUrl ??
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=1200";

  const storyAccentImage =
    explore.gallery[1]?.imageUrl ??
    storefront?.coverImageUrl ??
    explore.gallery[0]?.imageUrl ??
    heroImage;

  const resolvedAddressLine = explore.map?.addressLine ?? storefront?.addressLine ?? DEFAULT_MAP_ADDRESS;
  const externalMapUrl = explore.map?.mapUrl ?? DEFAULT_MAP_URL;

  const mapEmbedUrl = useMemo(
    () => buildEmbedMapUrl(explore.map?.mapUrl, resolvedAddressLine),
    [explore.map?.mapUrl, resolvedAddressLine],
  );

  const trustSignals = [
    { label: "Mẫu độc quyền", value: `${featuredServices.length || 45}+` },
    { label: "Thợ lành nghề", value: `${explore.team.length || 6}` },
    { label: "Năm kinh nghiệm", value: "03+" },
    { label: "Vệ sinh an toàn", value: "100%" },
  ];

  function handleAuthCta() {
    if (currentUser) {
      router.push(isCustomerRole(currentUser.role) ? "/account" : "/manage");
      return;
    }

    setAuthOpen(true);
  }

  function updateBookingState<K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) {
    setBookingState((current) => ({ ...current, [key]: value }));
  }

  function handleBookingDateTimeChange(nextValue: string) {
    const nextDate = new Date(nextValue);
    if (Number.isNaN(nextDate.getTime())) return;
    if (nextDate.getTime() <= Date.now()) {
      setBookingError("Thời gian đặt lịch phải lớn hơn thời điểm hiện tại.");
      return;
    }

    setBookingError(null);
    updateBookingState("selectedDateTime", nextValue);
    updateBookingState("selectedDate", nextValue.slice(0, 10));
    updateBookingState(
      "selectedTime",
      `${String(nextDate.getHours()).padStart(2, "0")}:${String(nextDate.getMinutes()).padStart(2, "0")}`,
    );
  }

  function handleSelectService(serviceName: string) {
    updateBookingState("selectedService", serviceName);
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleBookingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBookingError(null);
    setBookingMessage(null);

    const { customerName, customerPhone, note, selectedDateTime, selectedService } = bookingState;
    if (!customerName.trim() || !customerPhone.trim() || !selectedDateTime) {
      setBookingError("Vui lòng nhập đủ họ tên, số điện thoại, ngày và giờ hẹn.");
      return;
    }

    setBookingSubmitting(true);

    try {
      const startAt = new Date(selectedDateTime);
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

      if (Number.isNaN(startAt.getTime())) {
        throw new Error("Thời gian đặt lịch không hợp lệ.");
      }
      if (startAt.getTime() <= Date.now()) {
        throw new Error("Thời gian đặt lịch phải lớn hơn thời điểm hiện tại.");
      }

      await createPublicBookingRequest({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        requestedService: selectedService || undefined,
        note: note.trim() || undefined,
        requestedStartAt: startAt.toISOString(),
        requestedEndAt: endAt.toISOString(),
        source: "landing_page",
      });

      setBookingState(initialBookingState);
      setBookingMessage("Đã gửi yêu cầu đặt lịch thành công. Chạm Beauty sẽ sớm xác nhận với bạn.");
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : "Không gửi được yêu cầu đặt lịch.");
    } finally {
      setBookingSubmitting(false);
    }
  }

  return (
    <>
      <main className="landing-showcase">
        <header className="landing-showcase__topbar">
          <div className="landing-showcase__topbar-inner">
            <div className="landing-showcase__brand">
              <span className="landing-showcase__brand-name">Chạm Beauty</span>
              <span className="landing-showcase__brand-sub">Nail & Beauty Studio</span>
            </div>

            <nav className="landing-showcase__nav">
              <a href="#services">Dịch vụ</a>
              <a href="#products">Sản phẩm</a>
              <a href="#stories">Blog</a>
              <a href="#contact">Liên hệ</a>
            </nav>

            <div className="landing-showcase__topbar-actions">
              {authResolved && currentUser && isCustomerRole(currentUser.role) ? (
                <Link href="/account" className="landing-showcase__account-chip">
                  <span className="landing-showcase__account-avatar">{getProfileInitials(currentUser)}</span>
                  <span className="landing-showcase__account-label">{currentUser.displayName?.trim() || "Cá nhân"}</span>
                </Link>
              ) : null}
              {authResolved && currentUser && !isCustomerRole(currentUser.role) ? (
                <button type="button" className="landing-showcase__login" onClick={handleAuthCta}>
                  Vào quản trị
                </button>
              ) : null}
              {authResolved && !currentUser ? (
                <button type="button" className="landing-showcase__login" onClick={handleAuthCta}>
                  Đăng ký / Đăng nhập
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <section className="landing-showcase__hero">
          <div className="landing-showcase__hero-copy landing-showcase-reveal landing-showcase-reveal--left">
            <span className="landing-showcase__eyebrow">Nail & Beauty Studio</span>
            <h1>
              CHAM
              <span>BEAUTY</span>
            </h1>
            <p>
              Chạm Beauty mang đến vẻ đẹp tinh tế, giúp bạn tự tin tỏa sáng trong mọi khoảnh khắc. Chúng tôi chú trọng
              từng chi tiết để mang lại trải nghiệm làm đẹp chỉn chu, thư giãn và sang trọng.
            </p>
            <div className="landing-showcase__hero-actions">
              <button
                type="button"
                className="landing-showcase__primary-btn"
                onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })}
              >
                Đặt lịch ngay
              </button>
              <button
                type="button"
                className="landing-showcase__secondary-btn"
                onClick={() => document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })}
              >
                Xem dịch vụ
              </button>
            </div>
          </div>

          <div className="landing-showcase__hero-visual landing-showcase-reveal landing-showcase-reveal--right">
            <span className="landing-showcase__hero-visual-halo" aria-hidden="true" />
            <span className="landing-showcase__hero-visual-sheen" aria-hidden="true" />
            <span className="landing-showcase__hero-visual-glow" aria-hidden="true" />
            <AppLazyImage
              alt={storefront?.name ?? "Chạm Beauty"}
              className="h-full w-full object-cover"
              height={1440}
              priority
              sizes="(max-width: 1024px) 92vw, 44vw"
              src={heroImage}
              width={1200}
            />
          </div>
        </section>

        <section className="landing-showcase__signals">
          {trustSignals.map((signal) => (
            <article key={signal.label} className="landing-showcase__signal landing-showcase-motion-card">
              <strong>{signal.value}</strong>
              <span>{signal.label}</span>
            </article>
          ))}
        </section>

        <section className="landing-showcase__section landing-showcase__section--story">
          <div className="landing-showcase__story-copy landing-showcase-reveal landing-showcase-reveal--left">
            <span className="landing-showcase__eyebrow">Câu chuyện</span>
            <h2>
              Câu chuyện của <em>Chạm</em>
            </h2>
            <p>
              “Chạm” không chỉ là tên thương hiệu, mà còn là cảm giác dịu nhẹ ngay từ lần đầu ghé tiệm. Chúng tôi tin
              rằng mỗi khách hàng đều xứng đáng với sự chăm chút tận tâm và tinh tế.
            </p>
            <p>
              Với tinh thần đó, Chạm Beauty không ngừng hoàn thiện để mang đến cho bạn trải nghiệm làm đẹp thư giãn,
              chỉn chu và khác biệt trong từng lần ghé thăm.
            </p>
            <div className="landing-showcase__story-metric">
              <strong>03+</strong>
              <span>Năm đồng hành cùng khách hàng</span>
            </div>
          </div>

          <div className="landing-showcase__story-visual landing-showcase-reveal landing-showcase-reveal--right">
            <AppLazyImage
              alt="Mặt tiền cửa tiệm Chạm Beauty"
              className="landing-showcase__story-visual-main"
              height={1200}
              priority
              sizes="(max-width: 1024px) 92vw, 42vw"
              src={storyImage}
              width={1200}
            />
            <AppLazyImage
              alt="Không gian cửa tiệm Chạm Beauty"
              className="landing-showcase__story-visual-float"
              height={720}
              sizes="(max-width: 1024px) 40vw, 20vw"
              src={storyAccentImage}
              width={720}
            />
          </div>
        </section>

        <section id="services" className="landing-showcase__section">
          <div className="landing-showcase__section-heading landing-showcase-reveal landing-showcase-reveal--up">
            <span className="landing-showcase__eyebrow">Dịch vụ nổi bật</span>
            <h2>Mùa Hè Rực Rỡ</h2>
            <span className="landing-section-subcopy">Xu hướng móng hè 2026 — lên tay sẵn sàng cho những lễ hội, vui chơi.</span>
          </div>

          <div id="pricing" className="landing-showcase__services-carousel landing-showcase__services-carousel--desktop">
            <LandingDesktopCarousel
              items={featuredServices}
              slide={serviceDesktopSlide}
              onSelectSlide={setServiceDesktopSlide}
              labelPrefix="Xem slide dịch vụ"
              getItemKey={(service) => service.id}
              gridClassName="landing-showcase__services-grid landing-showcase__services-grid--desktop-carousel"
              dotsClassName="landing-showcase__services-dots landing-showcase__services-dots--desktop"
              itemsPerSlide={4}
              renderItem={(service) => (
                <article className="landing-showcase__service-card landing-showcase-motion-card">
                  <div className="landing-showcase__service-image">
                    <AppLazyImage
                      alt={service.title}
                      className="h-full w-full object-cover"
                      height={720}
                      sizes="(max-width: 1024px) 25vw, 18vw"
                      src={service.image}
                      width={720}
                    />
                    <span>{service.badge}</span>
                  </div>
                  <div className="landing-showcase__service-body">
                    <h3>{service.title}</h3>
                    <p>{service.blurb}</p>
                    <div className="landing-showcase__service-footer">
                      <strong>{service.price}</strong>
                      <button type="button" onClick={() => handleSelectService(service.title)}>
                        Đặt lịch
                      </button>
                    </div>
                  </div>
                </article>
              )}
            />
          </div>

          <LandingMobileCarousel
            items={featuredServices}
            slide={serviceMobileSlide}
            onSelectSlide={setServiceMobileSlide}
            labelPrefix="Xem slide dịch vụ"
            getItemKey={(service) => service.id}
            renderItem={(service) => (
              <article className="landing-showcase__service-card landing-showcase-motion-card">
                <div className="landing-showcase__service-image">
                  <AppLazyImage
                    alt={service.title}
                    className="h-full w-full object-cover"
                    height={720}
                    sizes="(max-width: 1024px) 25vw, 18vw"
                    src={service.image}
                    width={720}
                  />
                  <span>{service.badge}</span>
                </div>
                <div className="landing-showcase__service-body">
                  <h3>{service.title}</h3>
                  <p>{service.blurb}</p>
                  <div className="landing-showcase__service-footer">
                    <strong>{service.price}</strong>
                    <button type="button" onClick={() => handleSelectService(service.title)}>
                      Đặt lịch
                    </button>
                  </div>
                </div>
              </article>
            )}
          />

          <div className="landing-showcase__section-cta">
            <button
              type="button"
              className="landing-showcase__text-btn"
              onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })}
            >
              Xem tất cả dịch vụ
            </button>
          </div>
        </section>

        <section id="stories" className="landing-showcase__section">
          <div className="landing-showcase__section-heading landing-showcase__section-heading--split landing-showcase-reveal landing-showcase-reveal--up">
            <div>
              <span className="landing-showcase__eyebrow">Blog & tips</span>
              <h2>Nội dung hữu ích</h2>
            </div>
            <Link href={stories[0] ? `/stories/${stories[0].id}` : "#"} className="landing-showcase__section-link">
              Xem tất cả bài viết
            </Link>
          </div>

          <LandingDesktopCarousel
            items={stories}
            slide={storyDesktopSlide}
            onSelectSlide={setStoryDesktopSlide}
            labelPrefix="Xem slide blog"
            getItemKey={(post) => post.id}
            gridClassName="landing-showcase__stories-grid landing-showcase__stories-grid--desktop-carousel"
            dotsClassName="landing-showcase__services-dots landing-showcase__services-dots--desktop"
            itemsPerSlide={3}
            renderItem={(post) => (
              <Link href={`/stories/${post.id}`} className="landing-showcase__story-card landing-showcase-motion-card">
                {post.coverImageUrl ? (
                  <AppLazyImage
                    alt={post.title}
                    className="h-full w-full object-cover"
                    height={720}
                    sizes="(max-width: 1024px) 33vw, 25vw"
                    src={post.coverImageUrl}
                    width={960}
                  />
                ) : null}
                <div className="landing-showcase__story-card-body">
                  <span>{post.publishedAt ? formatViDate(post.publishedAt) : "Mới cập nhật"}</span>
                  <h3>{post.title}</h3>
                  <p>{post.summary}</p>
                  <strong>Đọc chi tiết</strong>
                </div>
              </Link>
            )}
          />

          <LandingMobileCarousel
            items={stories}
            slide={storyMobileSlide}
            onSelectSlide={setStoryMobileSlide}
            labelPrefix="Xem slide blog"
            getItemKey={(post) => post.id}
            renderItem={(post) => (
              <Link href={`/stories/${post.id}`} className="landing-showcase__story-card landing-showcase-motion-card">
                {post.coverImageUrl ? (
                  <AppLazyImage
                    alt={post.title}
                    className="h-full w-full object-cover"
                    height={720}
                    sizes="(max-width: 1024px) 33vw, 25vw"
                    src={post.coverImageUrl}
                    width={960}
                  />
                ) : null}
                <div className="landing-showcase__story-card-body">
                  <span>{post.publishedAt ? formatViDate(post.publishedAt) : "Mới cập nhật"}</span>
                  <h3>{post.title}</h3>
                  <p>{post.summary}</p>
                  <strong>Đọc chi tiết</strong>
                </div>
              </Link>
            )}
          />
        </section>

        <section id="products" className="landing-showcase__section">
          <div className="landing-showcase__section-heading landing-showcase-reveal landing-showcase-reveal--up">
            <span className="landing-showcase__eyebrow">Store & Products</span>
            <h2>Sản phẩm được chọn lọc</h2>
          </div>

          <LandingDesktopCarousel
            items={products}
            slide={productDesktopSlide}
            onSelectSlide={setProductDesktopSlide}
            labelPrefix="Xem slide sản phẩm"
            getItemKey={(product) => product.id}
            gridClassName="landing-showcase__products-grid landing-showcase__products-grid--desktop-carousel"
            dotsClassName="landing-showcase__services-dots landing-showcase__services-dots--desktop"
            itemsPerSlide={4}
            renderItem={(product) => <ProductGridCard product={product} />}
          />

          <LandingMobileCarousel
            items={products}
            slide={productMobileSlide}
            onSelectSlide={setProductMobileSlide}
            labelPrefix="Xem slide sản phẩm"
            getItemKey={(product) => product.id}
            renderItem={(product) => <ProductGridCard product={product} />}
          />
        </section>

        <section className="landing-showcase__section">
          <div className="landing-showcase__section-heading landing-showcase-reveal landing-showcase-reveal--up">
            <span className="landing-showcase__eyebrow">Khách hàng nói gì</span>
          </div>

          <div className="landing-showcase__testimonials-grid landing-showcase__testimonials-grid--desktop">
            {testimonials.map((testimonial) => (
              <article key={testimonial.id} className="landing-showcase__testimonial landing-showcase-motion-card">
                <span>“</span>
                <p>{testimonial.quote}</p>
                <strong>— {testimonial.name}</strong>
              </article>
            ))}
          </div>

          <LandingMobileCarousel
            items={testimonials}
            slide={testimonialMobileSlide}
            onSelectSlide={setTestimonialMobileSlide}
            labelPrefix="Xem slide cảm nhận"
            getItemKey={(testimonial) => testimonial.id}
            renderItem={(testimonial) => (
              <article className="landing-showcase__testimonial landing-showcase-motion-card">
                <span>“</span>
                <p>{testimonial.quote}</p>
                <strong>— {testimonial.name}</strong>
              </article>
            )}
          />

          <div className="landing-showcase__dots landing-showcase__dots--desktop">
            <span className="is-active" />
            <span />
            <span />
          </div>
        </section>

        <section id="contact" className="landing-showcase__section landing-showcase__section--contact">
          <div className="landing-showcase__contact-info landing-showcase-reveal landing-showcase-reveal--left">
            <span className="landing-showcase__eyebrow">Bản đồ & thông tin</span>
            <ul>
              <li>{resolvedAddressLine}</li>
              <li>{storefront?.phone ?? "091 608 3098"}</li>
              <li>{storefront?.openingHours ?? "09:00 - 21:00 (tất cả các ngày)"}</li>
            </ul>

            <DeferredRender
              className="landing-showcase__map-card"
              fallback={<div className="h-full min-h-[260px] w-full bg-neutral-100" aria-hidden="true" />}
            >
              {mapEmbedUrl ? (
                <iframe
                  src={mapEmbedUrl}
                  title="Google Maps - Chạm Beauty"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <AppLazyImage
                  alt="Chạm Beauty map preview"
                  className="h-full w-full object-cover"
                  height={720}
                  sizes="(max-width: 1024px) 92vw, 40vw"
                  src={heroImage}
                  width={960}
                />
              )}
            </DeferredRender>

            <a href={externalMapUrl} target="_blank" rel="noreferrer" className="landing-showcase__map-link">
              Mở chỉ đường Google Maps
            </a>
          </div>

          <form id="booking" className="landing-showcase__booking landing-showcase-reveal landing-showcase-reveal--right" onSubmit={handleBookingSubmit}>
            <span className="landing-showcase__eyebrow">Đặt lịch ngay</span>
            <p>Đặt lịch nhanh chóng. Xác nhận sớm qua điện thoại.</p>

            <div className="landing-showcase__booking-grid">
              <input
                type="text"
                placeholder="Họ và tên"
                value={bookingState.customerName}
                onChange={(event) => updateBookingState("customerName", event.target.value)}
                required
              />
              <input
                type="tel"
                placeholder="Số điện thoại"
                value={bookingState.customerPhone}
                onChange={(event) => updateBookingState("customerPhone", event.target.value)}
                required
              />
              <select value={bookingState.selectedService} onChange={(event) => updateBookingState("selectedService", event.target.value)}>
                <option value="">Chọn dịch vụ</option>
                {featuredServices.map((service) => (
                  <option key={service.id} value={service.title}>
                    {service.title}
                  </option>
                ))}
              </select>
              <div className="landing-showcase__booking-field landing-showcase__booking-field--wide">
                <span className="landing-showcase__booking-picker-label">Chọn ngày giờ</span>
                <ManageDateTimePicker
                  label="Chọn ngày và giờ"
                  value={bookingState.selectedDateTime || undefined}
                  onChange={handleBookingDateTimeChange}
                  compact
                  theme="landing"
                />
              </div>
              <input type="hidden" value={bookingState.selectedDate} onChange={(event) => updateBookingState("selectedDate", event.target.value)} />
              <input type="hidden" value={bookingState.selectedTime} onChange={(event) => updateBookingState("selectedTime", event.target.value)} />
              <input
                type="text"
                placeholder="Ghi chú (nếu có)"
                className="landing-showcase__booking-note"
                value={bookingState.note}
                onChange={(event) => updateBookingState("note", event.target.value)}
              />
            </div>

            <button type="submit" className="landing-showcase__primary-btn landing-showcase__primary-btn--full" disabled={bookingSubmitting}>
              {bookingSubmitting ? "Đang gửi..." : "Xác nhận đặt lịch"}
            </button>

            {bookingMessage ? <p className="landing-showcase__booking-message landing-showcase__booking-message--success">{bookingMessage}</p> : null}
            {bookingError ? <p className="landing-showcase__booking-message landing-showcase__booking-message--error">{bookingError}</p> : null}
          </form>
        </section>

        <footer className="landing-showcase__footer-shell">
          <div className="landing-showcase__footer">
            <div className="landing-showcase__footer-brand">
              <span className="landing-showcase__footer-logo">Chạm Beauty</span>
              <p>
                Chạm Beauty mang đến trải nghiệm làm đẹp tinh tế, chỉn chu và chuyên nghiệp với không gian sang trọng
                cùng sản phẩm cao cấp.
              </p>
            </div>

            <div className="landing-showcase__footer-links">
              <h4>Liên kết</h4>
              <a href="#services">Dịch vụ</a>
              <a href="#products">Sản phẩm</a>
              <a href="#stories">Blog</a>
              <a href="#contact">Liên hệ</a>
            </div>

            <div className="landing-showcase__footer-info">
              <h4>Thông tin</h4>
              <p>{resolvedAddressLine}</p>
              <p>{storefront?.phone ?? "091 608 3098"}</p>
              <p>{storefront?.openingHours ?? "09:00 - 21:00 (tất cả các ngày)"}</p>
            </div>

            <div className="landing-showcase__footer-social">
              <h4>Theo dõi chúng tôi</h4>
              <div className="landing-showcase__footer-social-list">
                <a href={storefront?.messengerUrl ?? "#"} target="_blank" rel="noreferrer">
                  f
                </a>
                <a href={storefront?.instagramUrl ?? "#"} target="_blank" rel="noreferrer">
                  i
                </a>
                <button type="button" onClick={handleAuthCta}>
                  @
                </button>
              </div>
            </div>

            <div className="landing-showcase__footer-bottom">
              <span>© 2026 Chạm Beauty. All rights reserved.</span>
              <div className="landing-showcase__footer-legal">
                <a href="#contact">Chính sách bảo mật</a>
                <a href="#contact">Điều khoản sử dụng</a>
              </div>
            </div>
          </div>
        </footer>
      </main>

      <AuthModal
        open={authOpen}
        nextPath="/"
        onAuthenticated={(summary) => setCurrentUser(summary)}
        onClose={() => setAuthOpen(false)}
      />
    </>
  );
}
