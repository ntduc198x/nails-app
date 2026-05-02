"use client";

import { createPublicBookingRequest } from "@/lib/landing-booking";
import { formatVnd } from "@/lib/mock-data";
import { useEffect, useMemo, useRef, useState } from "react";

type LandingService = {
  title: string;
  description: string;
  price: string;
  duration?: string;
  image: string;
  alt: string;
  tag?: string;
  vibe?: string;
  ctaLabel?: string;
};

const fallbackServices: LandingService[] = [
  {
    title: "Luxury Gel",
    description: "Sơn gel cao cấp, bóng màu lên đến 3 tuần.",
    price: "350.000đ",
    duration: "45 phút",
    image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800",
    alt: "Luxury Gel",
  },
  {
    title: "Nail Art Design",
    description: "Vẽ móng nghệ thuật, đẳng cấp phong cách Red Carpet.",
    price: "500.000đ",
    duration: "60 phút",
    image: "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?q=80&w=800",
    alt: "Nail Art",
  },
  {
    title: "Spa & Care",
    description: "Chăm sóc da tay, tẩy da chết và trị liệu dưỡng chất.",
    price: "400.000đ",
    duration: "50 phút",
    image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=800",
    alt: "Care",
  },
];

const facebookPageUrl = "https://www.facebook.com/chambeautyyy";
const instagramUrl = "https://www.instagram.com/cham.beautyy/";
const tiktokUrl = "https://www.tiktok.com/@chm.beauty10";
const messengerUrl = "https://m.me/chambeautyyy";
const MONTHS_VI = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
const WEEKDAYS_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const QUICK_DATES = [
  { label: "Hôm nay", offset: 0 },
  { label: "Ngày mai", offset: 1 },
  { label: "Mốt", offset: 2 },
  { label: "3 ngày", offset: 3 },
  { label: "1 tuần", offset: 7 },
  { label: "2 tuần", offset: 14 },
];
const LOOKBOOK_FILTERS = ["Tất cả", "Hot nhất", "Nhẹ nhàng", "Sang tiệc", "Cá tính"] as const;
const TIME_SLOTS = Array.from({ length: 25 }, (_, index) => {
  if (index === 24) return "21:00";
  const hour = 9 + Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

function sameDay(a: Date | null, b: Date | null) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(date: Date) {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getRelativeDay(date: Date, today: Date) {
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  if (diff === 2) return "Mốt";
  return WEEKDAYS_VI[date.getDay()];
}

function enrichLookbookService(item: LandingService): LandingService {
  const text = `${item.title} ${item.description}`.toLowerCase();

  if (text.includes("mắt mèo") || text.includes("flash") || text.includes("ánh")) {
    return { ...item, tag: "Hot", vibe: "Sang tiệc", ctaLabel: "Chọn mẫu này" };
  }

  if (text.includes("thạch") || text.includes("biab") || text.includes("nude") || text.includes("sữa")) {
    return { ...item, tag: "Trend", vibe: "Nhẹ nhàng", ctaLabel: "Chọn mẫu này" };
  }

  if (text.includes("đính") || text.includes("charm") || text.includes("vẽ") || text.includes("ombre")) {
    return { ...item, tag: "Nổi bật", vibe: "Cá tính", ctaLabel: "Chọn mẫu này" };
  }

  return { ...item, tag: "Chọn nhiều", vibe: "Hot nhất", ctaLabel: "Chọn mẫu này" };
}


export default function LandingPage() {
  const todayDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const [lookbookServices, setLookbookServices] = useState<LandingService[]>(fallbackServices);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState("");
  const [note, setNote] = useState("");
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const bookingFormRef = useRef<HTMLFormElement | null>(null);
  const bookingNameInputRef = useRef<HTMLInputElement | null>(null);
  const lookbookScrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeLookbookIndex, setActiveLookbookIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [activeLookbookFilter, setActiveLookbookFilter] = useState<(typeof LOOKBOOK_FILTERS)[number]>("Tất cả");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLookbookServices() {
      try {
        const res = await fetch("/api/lookbook", { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || !json?.ok || cancelled) return;

        const rows = (json.data ?? []) as Array<{
          name: string;
          short_description?: string | null;
          image_url?: string | null;
          featured_in_lookbook?: boolean | null;
          duration_min: number;
          base_price: number;
          active: boolean;
        }>;

        if (!rows.length) return;

        const serviceImages = [
          "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800",
          "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?q=80&w=800",
          "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=800",
        ];

        setLookbookServices(rows.map((item, index) => enrichLookbookService({
          title: item.name,
          description: item.short_description?.trim() || `Dịch vụ ${item.name} • thời lượng ${item.duration_min} phút.`,
          price: `${formatVnd(Number(item.base_price))}`,
          duration: `${item.duration_min} phút`,
          image: item.image_url?.trim() || serviceImages[index % serviceImages.length],
          alt: item.name,
        })));
      } catch {
        // giữ fallback tĩnh nếu load API fail
      }
    }

    void loadLookbookServices();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = lookbookScrollerRef.current;
    if (!node) return;

    const onScroll = () => {
      const cardWidth = node.clientWidth * 0.82 + 16;
      if (!cardWidth) return;
      const nextIndex = Math.round(node.scrollLeft / cardWidth);
      setActiveLookbookIndex(Math.max(0, Math.min(lookbookServices.length - 1, nextIndex)));
    };

    node.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => node.removeEventListener("scroll", onScroll);
  }, [lookbookServices.length]);

  const goToBooking = (service?: string) => {
    if (service) {
      setSelectedService(service);
    }

    closeAll();
    bookingFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      bookingNameInputRef.current?.focus({ preventScroll: true });
    }, 350);
  };

  const visibleLookbookServices = useMemo(() => {
    if (activeLookbookFilter === "Tất cả") return lookbookServices;
    return lookbookServices.filter((service) => service.vibe === activeLookbookFilter || service.tag === activeLookbookFilter);
  }, [activeLookbookFilter, lookbookServices]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const cells: Array<{ label: number; current: boolean; date?: Date }> = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ label: daysInPrevMonth - i, current: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ label: day, current: true, date: new Date(viewYear, viewMonth, day) });
    }

    const remain = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= remain; day++) {
      cells.push({ label: day, current: false });
    }

    return cells;
  }, [viewMonth, viewYear]);

  const closeAll = () => {
    setDateOpen(false);
    setTimeOpen(false);
  };

  const openDate = () => {
    setTimeOpen(false);
    setDateOpen((prev) => !prev);
  };

  const openTime = () => {
    setDateOpen(false);
    setTimeOpen((prev) => !prev);
  };

  const pickDate = (date: Date) => {
    setSelectedDate(date);
    setViewMonth(date.getMonth());
    setViewYear(date.getFullYear());
    setDateOpen(false);
  };

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
      return;
    }
    setViewMonth((prev) => prev - 1);
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
      return;
    }
    setViewMonth((prev) => prev + 1);
  };

  const handleSubmitBooking = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!customerName.trim()) {
      setSubmitError("Vui lòng nhập họ và tên.");
      return;
    }

    if (!customerPhone.trim()) {
      setSubmitError("Vui lòng nhập số điện thoại.");
      return;
    }

    if (!selectedDate || !selectedTime) {
      setSubmitError("Vui lòng chọn ngày và giờ hẹn.");
      return;
    }

    const now = new Date();
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const selectedDateTime = new Date(selectedDate);
    selectedDateTime.setHours(hours, minutes, 0, 0);
    const minAllowedTime = new Date(now.getTime() + 30 * 60 * 1000);

    if (selectedDateTime < minAllowedTime) {
      setSubmitError("Thời gian đặt lịch phải cách thời điểm hiện tại ít nhất 30 phút. Vui lòng chọn giờ khác.");
      return;
    }

    try {
      setSubmitting(true);

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const startAt = new Date(selectedDate);
      startAt.setHours(hours, minutes, 0, 0);
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

      const createdBooking = await createPublicBookingRequest({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        requestedService: selectedService || undefined,
        preferredStaff: undefined,
        note: note.trim() || undefined,
        requestedStartAt: startAt.toISOString(),
        requestedEndAt: endAt.toISOString(),
        source: "landing_page",
      });

      try {
        await fetch("/api/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ record: createdBooking }),
        });
      } catch {}

      setSubmitSuccess("Đã gửi yêu cầu đặt lịch thành công. Chạm Beauty sẽ sớm liên hệ xác nhận với bạn.");
      setCustomerName("");
      setCustomerPhone("");
      setSelectedService("");
      setSelectedDate(null);
      setSelectedTime(null);
      setNote("");
      setViewMonth(todayDate.getMonth());
      setViewYear(todayDate.getFullYear());
      closeAll();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không gửi được yêu cầu đặt lịch.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="landing-page">
      {(dateOpen || timeOpen) && <div className="pk-overlay show" onClick={closeAll} />}

      <header className={`landing-header ${isScrolled ? "scrolled" : ""}`} id="header">
        <div className="landing-logo">
          <span className="landing-logo__main">Chạm</span>
          <span className="landing-logo__sub">Beauty</span>
        </div>
        <nav className="landing-nav-menu">
          <a href="#about">Câu chuyện</a>
          <a href="#services">Dịch vụ</a>
          <a href="#booking">Đặt lịch</a>
          <a href={messengerUrl} target="_blank" rel="noreferrer">Liên hệ</a>
        </nav>
      </header>

      <section id="hero" className="landing-hero">
        <div className="landing-hero__left">
          <span className="landing-hero__subtitle">High-End Nail Art Studio</span>
          <h1 className="landing-hero__title">CHẠM</h1>
          <h1 className="landing-hero__title landing-hero__title--filled">BEAUTY</h1>
          <p className="landing-hero__desc">
            Chạm Beauty theo đuổi vẻ đẹp tinh tế, gọn gàng và sang trọng — nơi mỗi bộ móng đều được chăm chút để hợp với phong cách riêng của bạn.
          </p>
          <div className="landing-hero__actions">
            <button type="button" className="btn-luxury" onClick={() => goToBooking()}>
              Đặt Lịch Ngay
            </button>
            <a href="#services" className="btn-luxury btn-luxury--secondary">
              Xem mẫu móng
            </a>
          </div>
        </div>
        <div className="landing-hero__right" />
      </section>

      <section id="about" className="landing-about landing-mobile-secondary">
        <div className="landing-bg-text">CHAM BEAUTY</div>
        <div className="landing-about__container">
          <div className="landing-about__content">
            <h2>
              Câu chuyện của <span>Chạm</span>
            </h2>
            <p style={{ marginBottom: 20 }}>
              &quot;Chạm&quot; không chỉ là hành động vật lý, mà là sự giao thoa của cảm xúc. Tại <strong>Chạm Beauty</strong>,
              chúng tôi tin rằng đôi bàn tay là nơi lưu giữ câu chuyện của người phụ nữ.
            </p>
            <p>
              Với triết lý <em>&quot;Less is More&quot;</em>, mỗi thiết kế tại Chạm đều hướng đến sự tinh tế, loại bỏ những chi tiết
              thừa thãi để tôn lên vẻ đẹp tự nhiên và sang trọng vốn có của bạn.
            </p>
            <div className="landing-about__experience">
              <span>05+</span>
              <span>Năm kinh nghiệm</span>
            </div>
          </div>
          <div className="landing-about__img-stack">
            <img
              src="https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=600"
              className="img-top"
              alt="Nail Art Detail"
            />
            <img
              src="https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=600"
              className="img-bottom"
              alt="Nail Salon"
            />
          </div>
        </div>
      </section>

      <section id="services" className="landing-services">
        <div className="landing-section-header">
          <p>Lookbook</p>
          <div className="line" />
          <h2>Mùa Hè Rực Rỡ</h2>
          <span className="landing-section-subcopy">Xu hướng móng hè 2026 — lên tay sẵn sàng cho những lễ hội, vui chơi.</span>
        </div>
        <div className="landing-lookbook-filters" role="tablist" aria-label="Lọc lookbook">
          {LOOKBOOK_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`landing-lookbook-filter ${activeLookbookFilter === filter ? "is-active" : ""}`}
              onClick={() => setActiveLookbookFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <div ref={lookbookScrollerRef} className="landing-services-grid" role="list">
          {visibleLookbookServices.map((service) => (
            <div key={service.title} className="landing-service-card">
              <div className="landing-service-img-wrapper" onClick={() => setLightboxImage(service.image)} style={{ cursor: "pointer" }}>
                <span className="landing-service-badge">{service.tag ?? "Nổi bật"}</span>
                <img src={service.image} alt={service.alt} />
              </div>
              <div className="landing-service-info">
                <div className="landing-service-copy">
                  <h3>{service.title}</h3>
                  <div className="landing-service-meta">{service.vibe ?? "Hot nhất"}</div>
                  <p>{service.description}</p>
                </div>
                <div className="landing-service-footer">
                  <div className="landing-service-pricing">
                    <span className="landing-service-price">{service.price}</span>
                    {service.duration ? <span className="landing-service-duration">{service.duration}</span> : null}
                  </div>
                  <button type="button" className="btn-service-book" onClick={() => goToBooking(service.title)}>
                    {service.ctaLabel ?? "Chọn mẫu này"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="landing-lookbook-dots" aria-hidden="true">
          {visibleLookbookServices.map((service, index) => (
            <span key={service.title} className={`landing-lookbook-dot ${index === activeLookbookIndex ? "is-active" : ""}`} />
          ))}
        </div>
      </section>

      <section id="booking" className="landing-booking">
        <div className="landing-booking-wrapper">
          <div className="landing-booking-info">
            <h2>
              Sẵn sàng <span>chạm</span>?
            </h2>
            <p>
              Đừng để vẻ đẹp phải chờ đợi. Hãy để lại thông tin, Chạm Beauty sẽ liên hệ xác nhận lịch hẹn của bạn trong
              thời gian sớm nhất.
            </p>
            <p className="landing-booking-quote">&quot;Vẻ đẹp bền vững bắt đầu từ sự chăm sóc&quot;</p>
            <div className="landing-booking-contact-item"><span>📍</span><span>38A ngách: 358/40 Bùi Xương Trạch, Khương Định</span></div>
            <div className="landing-booking-contact-item"><span>📞</span><span>0916.080398 - 0966.742573</span></div>
            <div className="landing-booking-contact-item"><span>🕘</span><span>09:00 - 21:00 (T2 - CN)</span></div>
          </div>

          <form
            ref={bookingFormRef}
            className="landing-booking-form-card"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmitBooking();
            }}
          >
            <div className="landing-booking-form-badge">ĐẶT LỊCH</div>
            <div className="landing-form-row landing-form-row--3cols full-width">
              <div className="landing-form-group">
                <label>Họ và tên *</label>
                <input ref={bookingNameInputRef} type="text" placeholder="Nguyễn Thị A" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className="landing-form-group">
                <label>Số điện thoại *</label>
                <input type="tel" placeholder="0909 xxx xxx" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
              <div className="landing-form-group">
                <label>Dịch vụ mong muốn</label>
                <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}>
                  <option value="">Chọn dịch vụ</option>
                  {lookbookServices.map((service) => (
                    <option key={service.title} value={service.title}>{service.title}</option>
                  ))}
                  <option value="Gỡ móng & Chăm sóc">Gỡ móng & Chăm sóc</option>
                </select>
              </div>
            </div>
            <div className="landing-form-row landing-form-row--date-time full-width">
              <div className="landing-form-group pk-group">
                <label>Ngày hẹn *</label>
                <button type="button" className={`pk-trigger ${dateOpen ? "active" : ""}`} onClick={openDate} aria-expanded={dateOpen}>
                  <span className="pk-trigger-left">
                    <span className="pk-trigger-icon">📅</span>
                    <span className="pk-trigger-text">
                      {selectedDate ? (
                        <span className="pk-value">
                          {formatDate(selectedDate)}
                          <span className="pk-tag">{getRelativeDay(selectedDate, todayDate)}</span>
                        </span>
                      ) : (
                        <span className="pk-placeholder">Chọn ngày</span>
                      )}
                    </span>
                  </span>
                  <span className="pk-arrow">▾</span>
                </button>
                <div className={`pk-dropdown ${dateOpen ? "open" : ""}`}>
                  <div className="pk-cal-header">
                    <div className="pk-cal-title">{MONTHS_VI[viewMonth]} {viewYear}</div>
                    <div className="pk-cal-navs">
                      <button type="button" className="pk-cal-nav" onClick={goPrevMonth}>‹</button>
                      <button type="button" className="pk-cal-nav pk-cal-today-btn" onClick={() => pickDate(todayDate)}>Hôm nay</button>
                      <button type="button" className="pk-cal-nav" onClick={goNextMonth}>›</button>
                    </div>
                  </div>
                  <div className="pk-cal-weekdays">
                    {WEEKDAYS_VI.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="pk-cal-days">
                    {calendarCells.map((cell, index) => {
                      const isToday = sameDay(cell.date ?? null, todayDate);
                      const isSelected = sameDay(cell.date ?? null, selectedDate);

                      return cell.date ? (
                        <button
                          key={`${formatIsoDate(cell.date)}-${index}`}
                          type="button"
                          className={`pk-cal-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
                          onClick={() => pickDate(cell.date!)}
                        >
                          {cell.label}
                        </button>
                      ) : (
                        <span key={`empty-${index}`} className="pk-cal-day other">{cell.label}</span>
                      );
                    })}
                  </div>
                  <div className="pk-quick-dates">
                    {QUICK_DATES.map((item) => {
                      const nextDate = new Date(todayDate);
                      nextDate.setDate(todayDate.getDate() + item.offset);
                      const active = sameDay(nextDate, selectedDate);

                      return (
                        <button key={item.label} type="button" className={`pk-qd-btn ${active ? "active" : ""}`} onClick={() => pickDate(nextDate)}>
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="landing-form-group pk-group">
                <label>Giờ hẹn *</label>
                <button type="button" className={`pk-trigger ${timeOpen ? "active" : ""}`} onClick={openTime} aria-expanded={timeOpen}>
                  <span className="pk-trigger-left">
                    <span className="pk-trigger-icon">🕘</span>
                    <span className="pk-trigger-text">
                      {selectedTime ? <span className="pk-value">{selectedTime}</span> : <span className="pk-placeholder">Chọn giờ</span>}
                    </span>
                  </span>
                  <span className="pk-arrow">▾</span>
                </button>
                <div className={`pk-dropdown ${timeOpen ? "open" : ""}`}>
                  <div className="pk-time-grid">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`pk-time-slot ${selectedTime === slot ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedTime(slot);
                          setTimeOpen(false);
                        }}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
              <div className="landing-form-row landing-form-row--service-summary full-width">
                <div className="landing-booking-summary">
                  <span>{selectedService ? `Dịch vụ: ${selectedService}` : "Dịch vụ: chưa chọn"}</span>
                </div>
                <div className="landing-form-spacer" aria-hidden="true" />
              </div>
            <div className="landing-form-group full-width landing-form-group--optional">
              <label>Ghi chú thêm</label>
              <textarea placeholder="Mô tả mong muốn hoặc lưu ý đặc biệt..." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button type="submit" className="btn-gold full-width landing-submit-link" disabled={submitting}>
              {submitting ? "Đang gửi..." : "Gửi yêu cầu đặt lịch"}
            </button>
            {submitError && <p className="landing-form-message landing-form-message--error full-width">{submitError}</p>}
            {submitSuccess && <p className="landing-form-message landing-form-message--success full-width">{submitSuccess}</p>}
          </form>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-main">
          <div className="landing-footer-col-cta">
            <p>
              Hơn cả một dịch vụ, đó là trải nghiệm dành riêng cho bạn. Không gian của Chạm Beauty luôn mở cửa đón bạn trở
              lại.
            </p>
            <p className="landing-footer-quote">&quot;Tinh tế trong từng vân móng, kiêu hãnh trong từng cử chỉ.&quot;</p>
          </div>
          <div className="landing-footer-col-info">
            <h4>Thông tin liên hệ</h4>
            <div className="landing-footer-info-item">
              <span>📍</span>
              <span>38A ngách: 358/40 Bùi Xương Trạch, Khương Định</span>
            </div>
            <div className="landing-footer-info-item">
              <span>🕘</span>
              <span>09:00 - 21:00 (T2 - CN)</span>
            </div>
          </div>
          <div className="landing-footer-col-social">
            <h4>Kết nối</h4>
            <div className="landing-footer-social-links">
              <a href={facebookPageUrl} target="_blank" rel="noreferrer" aria-label="Facebook">Facebook</a>
              <a href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram">Instagram</a>
              <a href={tiktokUrl} target="_blank" rel="noreferrer" aria-label="TikTok">TikTok</a>
            </div>
            <div className="landing-footer-hotline">
              <span>📞</span>
              <a href="tel:0916080398">0916.080398</a>
              <span style={{ color: "#555" }}>—</span>
              <a href="tel:0966742573">0966.742573</a>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span className="landing-footer-bottom-logo">Chạm Beauty</span>
          <span>&copy; 2026 Chạm Beauty. All rights reserved.</span>
        </div>
      </footer>

      {lightboxImage && (
        <div className="landing-lightbox" onClick={() => setLightboxImage(null)}>
          <button type="button" className="landing-lightbox-close" onClick={() => setLightboxImage(null)}>
            ✕
          </button>
          <img src={lightboxImage} alt="Xem chi tiết" className="landing-lightbox-img" />
        </div>
      )}
    </main>
  );
}
