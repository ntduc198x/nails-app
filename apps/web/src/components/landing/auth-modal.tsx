"use client";

import type { AuthenticatedUserSummary } from "@nails/shared";
import { AuthPanel } from "./auth-panel";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  nextPath?: string;
  onAuthenticated?: (summary: AuthenticatedUserSummary) => void;
};

export function AuthModal({ open, onAuthenticated, onClose, nextPath = "/" }: AuthModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="landing-auth-modal" role="dialog" aria-modal="true" aria-label="Đăng nhập hoặc đăng ký">
      <button type="button" className="landing-auth-modal__backdrop" onClick={onClose} aria-label="Đóng lớp phủ" />
      <div className="landing-auth-modal__content">
        <AuthPanel nextPath={nextPath} onAuthenticated={onAuthenticated} onClose={onClose} />
      </div>
    </div>
  );
}
