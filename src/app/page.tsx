"use client";

import { createPublicBookingRequest } from "@/lib/landing-booking";
import { formatVnd } from "@/lib/mock-data";
import { useEffect, useMemo, useState } from "react";

type LandingService = {
  title: string;
  description: string;
  price: string;
  image: string;
  alt: string;
};

const fallbackServices: LandingService[] = [
  {
    title: "Luxury Gel",
    description: "Sơn gel cao cấp, bóng màu lên đến 3 tuần.",
    price: "350.000đ",
    image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800",
    alt: "Luxury Gel",
  },
  {
    title: "Nail Art Design",
    description: "Vẽ móng nghệ thuật, đẳng cấp phong cách Red Carpet.",
    price: "500.000đ",
    image: "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?q=80&w=800",
    alt: "Nail Art",
  },
  {
    title: "Spa & Care",
    description: "Chăm sóc da tay, tẩy da chết và trị liệu dưỡng chất.",
    price: "400.000đ",
    image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=800",
    alt: "Care",
  },
];

const facebookPageUrl = "https://www.facebook.com/chambeautyyy";
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
  const [preferredStaff, setPreferredStaff] = useState("");
  const [note, setNote] = useState("");
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

        setLookbookServices(rows.map((item, index) => ({
          title: item.name,
          description: item.short_description?.trim() || `Dịch vụ ${item.name} • thời lượng ${item.duration_min} phút.`,
          price: formatVnd(Number(item.base_price)),
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

  const goToBooking = (service?: string) => {
    if (service) {
      setSelectedService(service);
    }

    closeAll();
    const target = document.getElementById("booking");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
        preferredStaff: preferredStaff.trim() || undefined,
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
      setPreferredStaff("");
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
            Nơi mỗi điểm nhấn là một sự chỉn chu tinh tế. Chúng tôi không chỉ làm móng, chúng tôi kiến tạo phong cách cho
            đôi bàn tay của bạn.
          </p>
          <button type="button" className="btn-luxury" onClick={() => goToBooking()}>
            Đặt Lịch Ngay
          </button>
        </div>
        <div className="landing-hero__right" />
      </section>

      <section id="about" className="landing-about">
        <div className="landing-bg-text">CHAM BEAUTY</div>
        <div className="landing-about__container">
          <div className="landing-about__content">
            <h2>
              Câu chuyện của <span>Chạm</span>
            </h2>
            <p style={{ marginBottom: 20 }}>
              "Chạm" không chỉ là hành động vật lý, mà là sự giao thoa của cảm xúc. Tại <strong>Chạm Beauty</strong>,
              chúng tôi tin rằng đôi bàn tay là nơi lưu giữ câu chuyện của người phụ nữ.
            </p>
            <p>
              Với triết lý <em>"Less is More"</em>, mỗi thiết kế tại Chạm đều hướng đến sự tinh tế, loại bỏ những chi tiết
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
          <h2>Các dịch vụ nổi bật</h2>
        </div>
        <div className="landing-services-grid">
          {lookbookServices.map((service) => (
            <div key={service.title} className="landing-service-card">
              <div className="landing-service-img-wrapper">
                <img src={service.image} alt={service.alt} />
              </div>
              <div className="landing-service-info">
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <span className="landing-service-price">{service.price}</span>
                <button type="button" className="btn-service-book" onClick={() => goToBooking(service.title)}>
                  Đặt lịch ngay
                </button>
              </div>
            </div>
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
            <p className="landing-booking-quote">"Vẻ đẹp bền vững bắt đầu từ sự chăm sóc"</p>
            <div className="landing-booking-contact-item"><span>📍</span><span>38A ngách: 358/40 Bùi Xương Trạch, Khương Định</span></div>
            <div className="landing-booking-contact-item"><span>📞</span><span>0916.080398 - 0966.742573</span></div>
            <div className="landing-booking-contact-item"><span>🕘</span><span>09:00 - 21:00 (T2 - CN)</span></div>
          </div>

          <form
            className="landing-booking-form-card"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmitBooking();
            }}
          >
            <div className="landing-form-group">
              <label>Họ và tên *</label>
              <input type="text" placeholder="Nguyễn Thị A" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
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
            <div className="landing-form-group">
              <label>Thợ chính (Nếu có)</label>
              <input type="text" placeholder="VD: Thợ Loan" value={preferredStaff} onChange={(e) => setPreferredStaff(e.target.value)} />
            </div>

            <div className="landing-form-group pk-group pk-date-group">
              <label>Ngày hẹn *</label>
              <input type="hidden" value={selectedDate ? formatIsoDate(selectedDate) : ""} />
              <button type="button" className={`pk-trigger ${dateOpen ? "active" : ""}`} onClick={openDate}>
                <div className="pk-trigger-left">
                  <span className="pk-trigger-icon">📅</span>
                  <div className="pk-trigger-text">
                    {!selectedDate ? (
                      <span className="pk-placeholder">Chọn ngày hẹn...</span>
                    ) : (
                      <span className="pk-value">
                        {formatDate(selectedDate)}
                        <span className="pk-tag">{getRelativeDay(selectedDate, todayDate)}</span>
                      </span>
                    )}
                  </div>
                </div>
                <span className="pk-arrow">⌄</span>
              </button>
              <div className={`pk-dropdown ${dateOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
                <div className="pk-cal-header">
                  <button type="button" className="pk-cal-nav" onClick={goPrevMonth}>‹</button>
                  <span className="pk-cal-title">{MONTHS_VI[viewMonth]} {viewYear}</span>
                  <div className="pk-cal-navs">
                    <button type="button" className="pk-cal-nav pk-cal-today-btn" onClick={() => pickDate(new Date(todayDate))}>Hôm nay</button>
                    <button type="button" className="pk-cal-nav" onClick={goNextMonth}>›</button>
                  </div>
                </div>
                <div className="pk-cal-weekdays">
                  {WEEKDAYS_VI.map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="pk-cal-days">
                  {calendarCells.map((cell, index) => {
                    const isToday = sameDay(cell.date ?? null, todayDate);
                    const isSelected = sameDay(cell.date ?? null, selectedDate);
                    return (
                      <button
                        key={`${cell.label}-${index}`}
                        type="button"
                        className={`pk-cal-day ${!cell.current ? "other" : ""} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`.trim()}
                        disabled={!cell.current}
                        onClick={() => cell.date && pickDate(cell.date)}
                      >
                        {cell.label}
                      </button>
                    );
                  })}
                </div>
                <div className="pk-quick-dates">
                  {QUICK_DATES.map((item) => {
                    const quickDate = new Date(todayDate);
                    quickDate.setDate(todayDate.getDate() + item.offset);
                    return (
                      <button
                        key={item.label}
                        type="button"
                        className={`pk-qd-btn ${sameDay(selectedDate, quickDate) ? "active" : ""}`}
                        onClick={() => pickDate(quickDate)}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="landing-form-group pk-group pk-time-group">
              <label>Giờ hẹn *</label>
              <input type="hidden" value={selectedTime ?? ""} />
              <button type="button" className={`pk-trigger ${timeOpen ? "active" : ""}`} onClick={openTime}>
                <div className="pk-trigger-left">
                  <span className="pk-trigger-icon">🕘</span>
                  <div className="pk-trigger-text">
                    {!selectedTime ? <span className="pk-placeholder">Chọn giờ...</span> : <span className="pk-value">{selectedTime}</span>}
                  </div>
                </div>
                <span className="pk-arrow">⌄</span>
              </button>
              <div className={`pk-dropdown ${timeOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
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

            <div className="landing-form-group full-width">
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
            <p className="landing-footer-quote">"Tinh tế trong từng vân móng, kiêu hãnh trong từng cử chỉ."</p>
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
              <a href="#" aria-label="Instagram">Instagram</a>
              <a href="#" aria-label="TikTok">TikTok</a>
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
          <span>&copy; 2025 Chạm Beauty. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}
