import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Chạm Beauty",
  description: "Terms of Service for Chạm Beauty platform.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-page__container">
        <div className="legal-page__topbar">
          <Link href="/" className="legal-page__back">← Về trang chủ</Link>
        </div>

        <article className="legal-card">
          <h1>Terms of Service</h1>
          <p className="legal-updated">Last updated: 2026</p>

          <p>
            Welcome to our platform. By accessing or using our website, you agree to comply with these Terms of Service.
          </p>

          <section>
            <h2>1. Use of Service</h2>
            <p>
              You agree to use the service only for lawful purposes. You must not misuse or attempt to disrupt the platform.
            </p>
          </section>

          <section>
            <h2>2. User Accounts</h2>
            <p>
              When logging in via TikTok, you authorize us to access basic profile information. You are responsible for maintaining your account security.
            </p>
          </section>

          <section>
            <h2>3. Content</h2>
            <p>
              All content provided is for informational purposes only. We do not guarantee accuracy or completeness.
            </p>
          </section>

          <section>
            <h2>4. Third-party Services</h2>
            <p>
              Our platform may integrate with TikTok APIs. We are not responsible for TikTok services or policies.
            </p>
          </section>

          <section>
            <h2>5. Termination</h2>
            <p>
              We reserve the right to suspend or terminate access if users violate these terms.
            </p>
          </section>

          <section>
            <h2>6. Changes</h2>
            <p>We may update these terms at any time without prior notice.</p>
          </section>

          <section>
            <h2>7. Contact</h2>
            <p>If you have any questions, please contact us via our website.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
