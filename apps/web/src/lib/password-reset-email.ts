type PasswordResetEmailInput = {
  to: string;
  temporaryPassword: string;
  loginUrl?: string | null;
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
  return `
  <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
    <h2 style="margin-bottom:12px">Cham Beauty - Mật khẩu tạm thời mới</h2>
    <p>Chúng tôi đã tạo và kích hoạt sẵn cho bạn một mật khẩu tạm mới.</p>
    <p><strong>Mật khẩu tạm:</strong> <span style="font-size:18px">${input.temporaryPassword}</span></p>
    <p>Bạn có thể dùng ngay mật khẩu này để đăng nhập.</p>
    ${input.loginUrl ? `<p><a href="${input.loginUrl}">Mở trang đăng nhập</a></p>` : ""}
    <p>Sau khi đăng nhập thành công, bạn nên đổi lại mật khẩu trong phần tài khoản để bảo mật hơn.</p>
  </div>
  `.trim();
}

function buildPasswordResetEmailText(input: PasswordResetEmailInput) {
  const lines = [
    "Cham Beauty - Mat khau tam thoi moi",
    "",
    "Chung toi da tao va kich hoat san cho ban mot mat khau tam moi.",
    `Mat khau tam: ${input.temporaryPassword}`,
    "",
    "Ban co the dung ngay mat khau nay de dang nhap.",
  ];

  if (input.loginUrl) {
    lines.push(`Trang dang nhap: ${input.loginUrl}`, "");
  }

  lines.push("Sau khi dang nhap thanh cong, hay doi lai mat khau trong phan tai khoan.");
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
      subject: "Cham Beauty - Mat khau tam thoi moi",
      html: buildPasswordResetEmailHtml(input),
      text: buildPasswordResetEmailText(input),
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`PASSWORD_RESET_EMAIL_FAILED: ${payload || response.statusText}`);
  }
}
