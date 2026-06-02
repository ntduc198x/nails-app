import { getPasswordResetTtlMinutes } from "@/lib/password-reset";

type PasswordResetEmailInput = {
  to: string;
  temporaryPassword: string;
  webConfirmUrl: string;
  mobileConfirmUrl: string;
};

function getEmailSender() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "";
  const fromName = process.env.RESEND_FROM_NAME?.trim() || "Cham Beauty";

  if (!apiKey || !fromEmail) {
    throw new Error("Thiếu cấu hình gửi mail reset mật khẩu: RESEND_API_KEY / RESEND_FROM_EMAIL.");
  }

  return {
    apiKey,
    from: `${fromName} <${fromEmail}>`,
  };
}

function buildPasswordResetEmailHtml(input: PasswordResetEmailInput) {
  const ttlMinutes = getPasswordResetTtlMinutes();

  return `
  <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
    <h2 style="margin-bottom:12px">Cham Beauty - Xác nhận đặt lại mật khẩu</h2>
    <p>Chúng tôi đã tạo sẵn cho bạn một mật khẩu tạm mới.</p>
    <p><strong>Mật khẩu tạm:</strong> <span style="font-size:18px">${input.temporaryPassword}</span></p>
    <p>Để kích hoạt mật khẩu này, vui lòng bấm một trong hai liên kết sau:</p>
    <ul>
      <li><a href="${input.webConfirmUrl}">Xác nhận trên web</a></li>
      <li><a href="${input.mobileConfirmUrl}">Mở ứng dụng và xác nhận</a></li>
    </ul>
    <p>Liên kết xác nhận có hiệu lực trong ${ttlMinutes} phút.</p>
    <p>Sau khi xác nhận, bạn có thể đăng nhập bằng mật khẩu tạm ở trên và nên đổi lại mật khẩu trong phần tài khoản.</p>
  </div>
  `.trim();
}

function buildPasswordResetEmailText(input: PasswordResetEmailInput) {
  const ttlMinutes = getPasswordResetTtlMinutes();

  return [
    "Cham Beauty - Xac nhan dat lai mat khau",
    "",
    "Chung toi da tao san cho ban mot mat khau tam moi.",
    `Mat khau tam: ${input.temporaryPassword}`,
    "",
    "Hay xac nhan reset bang mot trong hai lien ket sau:",
    `Web: ${input.webConfirmUrl}`,
    `Mobile app: ${input.mobileConfirmUrl}`,
    "",
    `Lien ket co hieu luc trong ${ttlMinutes} phut.`,
    "Sau khi xac nhan, hay dang nhap bang mat khau tam va doi lai mat khau trong phan tai khoan.",
  ].join("\n");
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput) {
  const sender = getEmailSender();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sender.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender.from,
      to: [input.to],
      subject: "Cham Beauty - Xac nhan dat lai mat khau",
      html: buildPasswordResetEmailHtml(input),
      text: buildPasswordResetEmailText(input),
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`PASSWORD_RESET_EMAIL_FAILED: ${payload || response.statusText}`);
  }
}
