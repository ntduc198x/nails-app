import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Chạm Beauty",
  description: "Privacy Policy for Chạm Beauty platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <div className="legal-page__container">
        <div className="legal-page__topbar">
          <Link href="/" className="legal-page__back">← Về trang chủ</Link>
        </div>

        <article className="legal-card">
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: 2026</p>

          <p>
            We respect your privacy and are committed to protecting your personal data.
          </p>

          <section>
            <h2>1. Information We Collect</h2>
            <p>When you log in via TikTok, we may collect:</p>
            <ul>
              <li>Basic profile information (username, avatar)</li>
              <li>User ID</li>
            </ul>
            <p>We do NOT collect sensitive personal data.</p>
          </section>

          <section>
            <h2>2. How We Use Information</h2>
            <p>We use your data to:</p>
            <ul>
              <li>Authenticate your account</li>
              <li>Improve user experience</li>
              <li>Enable content personalization</li>
            </ul>
          </section>

          <section>
            <h2>3. Data Sharing</h2>
            <p>We do NOT sell or share your personal data with third parties.</p>
          </section>

          <section>
            <h2>4. Data Storage</h2>
            <p>We only store necessary data and apply reasonable security measures.</p>
          </section>

          <section>
            <h2>5. Third-party Services</h2>
            <p>
              We use TikTok APIs. Your use of TikTok is subject to TikTok&apos;s Privacy Policy.
            </p>
          </section>

          <section>
            <h2>6. User Rights</h2>
            <p>You may request deletion of your data at any time.</p>
          </section>

          <section>
            <h2>7. Changes</h2>
            <p>We may update this policy. Continued use means acceptance.</p>
          </section>

          <section>
            <h2>8. Contact</h2>
            <p>For privacy-related requests, contact us via our website.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
