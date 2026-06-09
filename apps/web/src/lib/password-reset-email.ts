type PasswordResetEmailInput = {
  to: string;
  webConfirmUrl: string;
};

function normalizePasswordResetEmailError(payloadText: string, statusText: string) {
  const normalizedPayload = payloadText.toLowerCase();

  if (
    normalizedPayload.includes("domain is not verified") ||
    normalizedPayload.includes("gmail.com domain is not verified")
  ) {
    return "Dịch vụ gửi mail chưa sẵn sàng: domain gửi email trên Resend chưa được xác minh.";
  }

  return `PASSWORD_RESET_EMAIL_FAILED: ${payloadText || statusText}`;
}

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
  return `
  <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
    <h2 style="margin-bottom:12px">Cham Beauty - Đặt lại mật khẩu</h2>
    <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
    <p>Bấm vào liên kết bên dưới để mở trang đặt mật khẩu mới.</p>
    <p style="margin:20px 0">
      <a href="${input.webConfirmUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#1f2937;color:#ffffff;text-decoration:none;font-weight:700">
        Đặt mật khẩu mới
      </a>
    </p>
    <p>Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.</p>
  </div>
  `.trim();
}

function buildPasswordResetEmailText(input: PasswordResetEmailInput) {
  const lines = [
    "Cham Beauty - Dat lai mat khau",
    "",
    "Chung toi da nhan duoc yeu cau dat lai mat khau cho tai khoan cua ban.",
    "",
    "Bam vao lien ket ben duoi de mo trang dat mat khau moi:",
    input.webConfirmUrl,
  ];
  lines.push("", "Neu ban khong yeu cau thao tac nay, hay bo qua email.");
  return lines.join("\n");
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
      subject: "Cham Beauty - Dat lai mat khau",
      html: buildPasswordResetEmailHtml(input),
      text: buildPasswordResetEmailText(input),
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(normalizePasswordResetEmailError(payload, response.statusText));
  }
}
