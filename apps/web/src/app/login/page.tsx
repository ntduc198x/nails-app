"use client";

import { AuthPanel } from "@/components/landing/auth-panel";

export default function LoginPage() {
  return (
    <main className="landing-auth-page">
      <div className="landing-auth-page__shell">
        <AuthPanel variant="page" />
      </div>
    </main>
  );
}
