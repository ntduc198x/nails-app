"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
      {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" /> : null}
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
  const [serviceSlide, setServiceSlide] = useState(0);

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
  const serviceSlides = useMemo(() => {
    const chunkSize = 4;
    return Array.from({ length: Math.ceil(featuredServices.length / chunkSize) }, (_, index) =>
      featuredServices.slice(index * chunkSize, index * chunkSize + chunkSize),
    );
  }, [featuredServices]);
  useEffect(() => {
    if (serviceSlides.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setServiceSlide((current) => (current + 1) % serviceSlides.length);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [serviceSlides.length]);

  useEffect(() => {
    if (serviceSlide >= serviceSlides.length) {
      setServiceSlide(0);
    }
  }, [serviceSlide, serviceSlides.length]);

  const stories = useMemo(() => homeFeed.contentPosts.slice(0, 3), [homeFeed.contentPosts]);
  const products = useMemo(() => explore.products.slice(0, 8), [explore.products]);
  const productList = useMemo(() => explore.products.slice(0, 5), [explore.products]);
  const testimonials = FALLBACK_TESTIMONIALS;

  const productFeaturePills = [
    { title: "Sản phẩm chính hãng", subtitle: "Nguồn gốc rõ ràng" },
    { title: "An toàn cho móng", subtitle: "Lành tính, dịu nhẹ" },
    { title: "Chuẩn salon cao cấp", subtitle: "Đồng bộ dịch vụ" },
    { title: "Tư vấn tận tâm", subtitle: "Hỗ trợ lựa chọn" },
  ];

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
              <a href="#pricing">Bảng giá</a>
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
            <img src={heroImage} alt={storefront?.name ?? "Chạm Beauty"} />
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
            <img src={storyImage} alt="Mặt tiền cửa tiệm Chạm Beauty" className="landing-showcase__story-visual-main" />
            <img src={storyAccentImage} alt="Không gian cửa tiệm Chạm Beauty" className="landing-showcase__story-visual-float" />
          </div>
        </section>

        <section id="services" className="landing-showcase__section">
          <div className="landing-showcase__section-heading landing-showcase-reveal landing-showcase-reveal--up">
            <span className="landing-showcase__eyebrow">Dịch vụ nổi bật</span>
            <h2>Dịch vụ được yêu thích</h2>
            <p>Đa dạng phong cách, xu hướng mới nhất và kỹ thuật chuẩn salon.</p>
          </div>

          <div className="landing-showcase__services-carousel">
            <div
              id="pricing"
              className="landing-showcase__services-grid landing-showcase__services-grid--slider"
              style={{ transform: `translateX(-${serviceSlide * 50}%)` }}
            >
              {featuredServices.map((service) => (
                <article key={service.id} className="landing-showcase__service-card landing-showcase-motion-card">
                  <div className="landing-showcase__service-image">
                    <img src={service.image} alt={service.title} loading="lazy" decoding="async" />
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
              ))}
            </div>
          </div>

          <div className="landing-showcase__services-dots">
            {serviceSlides.map((_, index) => (
              <button
                key={`service-dot-${index}`}
                type="button"
                className={index === serviceSlide ? "is-active" : ""}
                onClick={() => setServiceSlide(index)}
                aria-label={`Xem slide dịch vụ ${index + 1}`}
              />
            ))}
          </div>

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

          <div className="landing-showcase__stories-grid">
            {stories.map((post) => (
              <Link key={post.id} href={`/stories/${post.id}`} className="landing-showcase__story-card landing-showcase-motion-card">
                {post.coverImageUrl ? <img src={post.coverImageUrl} alt={post.title} loading="lazy" decoding="async" /> : null}
                <div className="landing-showcase__story-card-body">
                  <span>{post.publishedAt ? formatViDate(post.publishedAt) : "Mới cập nhật"}</span>
                  <h3>{post.title}</h3>
                  <p>{post.summary}</p>
                  <strong>Đọc chi tiết</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section id="products" className="landing-showcase__section landing-showcase__section--products">
          <div className="landing-showcase__products-copy landing-showcase-reveal landing-showcase-reveal--left">
            <span className="landing-showcase__eyebrow">Store & Products</span>
            <h2>
              Sản phẩm
              <br />
              đồng bộ với dịch vụ
            </h2>
            <p className="landing-showcase__products-intro">
              Chăm sóc chuẩn salon, tinh tế, an toàn và đồng nhất trải nghiệm tại Chạm Beauty.
            </p>

            <div className="landing-showcase__product-list">
              {productList.map((product, index) => (
                <article key={product.id}>
                  <span className="landing-showcase__product-index">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{product.name}</h3>
                  <strong>{product.priceLabel ?? "Liên hệ"}</strong>
                </article>
              ))}
            </div>

            <button
              type="button"
              className="landing-showcase__secondary-btn landing-showcase__secondary-btn--products"
              onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
            >
              Xem tất cả sản phẩm
            </button>
          </div>

          <div className="landing-showcase__products-panel landing-showcase-reveal landing-showcase-reveal--right">
            <div className="landing-showcase__products-grid">
              {products.map((product) => (
                <ProductGridCard key={product.id} product={product} />
              ))}
            </div>

            <div className="landing-showcase__products-pills">
              {productFeaturePills.map((pill) => (
                <article key={pill.title} className="landing-showcase__products-pill">
                  <span className="landing-showcase__products-pill-icon" aria-hidden="true" />
                  <div>
                    <strong>{pill.title}</strong>
                    <p>{pill.subtitle}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-showcase__section">
          <div className="landing-showcase__section-heading landing-showcase-reveal landing-showcase-reveal--up">
            <span className="landing-showcase__eyebrow">Khách hàng nói gì</span>
          </div>

          <div className="landing-showcase__testimonials-grid">
            {testimonials.map((testimonial) => (
              <article key={testimonial.id} className="landing-showcase__testimonial landing-showcase-motion-card">
                <span>“</span>
                <p>{testimonial.quote}</p>
                <strong>— {testimonial.name}</strong>
              </article>
            ))}
          </div>

          <div className="landing-showcase__dots">
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
              <li>{storefront?.phone ?? "090 123 4567"}</li>
              <li>{storefront?.openingHours ?? "09:00 - 20:30 (tất cả các ngày)"}</li>
            </ul>

            <div className="landing-showcase__map-card">
              {mapEmbedUrl ? (
                <iframe
                  src={mapEmbedUrl}
                  title="Google Maps - Chạm Beauty"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <img src={heroImage} alt="Chạm Beauty map preview" loading="lazy" decoding="async" />
              )}
            </div>

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
              <a href="#pricing">Bảng giá</a>
              <a href="#products">Sản phẩm</a>
              <a href="#stories">Blog</a>
              <a href="#contact">Liên hệ</a>
            </div>

            <div className="landing-showcase__footer-info">
              <h4>Thông tin</h4>
              <p>{resolvedAddressLine}</p>
              <p>{storefront?.phone ?? "090 123 4567"}</p>
              <p>{storefront?.openingHours ?? "09:00 - 20:30 (tất cả các ngày)"}</p>
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
