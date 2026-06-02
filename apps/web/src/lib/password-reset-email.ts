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
  const activateNote = "Để mật khẩu mới có hiệu lực, bạn cần bấm vào một trong hai liên kết kích hoạt bên dưới.";
  return `
  <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
    <h2 style="margin-bottom:12px">Cham Beauty - Mật khẩu tạm thời mới</h2>
    <p>Chúng tôi đã tạo sẵn cho bạn một mật khẩu tạm mới.</p>
    <p><strong>Mật khẩu tạm:</strong> <span style="font-size:18px">${input.temporaryPassword}</span></p>
    <p>${activateNote}</p>
    <ul>
      <li><a href="${input.webConfirmUrl}">Kích hoạt trên web</a></li>
      <li><a href="${input.mobileConfirmUrl}">Mở ứng dụng và kích hoạt</a></li>
    </ul>
    <p>Sau khi kích hoạt thành công, bạn có thể đăng nhập bằng mật khẩu tạm ở trên và nên đổi lại mật khẩu trong phần tài khoản.</p>
  </div>
  `.trim();
}

function buildPasswordResetEmailText(input: PasswordResetEmailInput) {
  const lines = [
    "Cham Beauty - Mat khau tam thoi moi",
    "",
    "Chung toi da tao san cho ban mot mat khau tam moi.",
    `Mat khau tam: ${input.temporaryPassword}`,
    "",
    "De mat khau moi co hieu luc, ban can bam vao mot trong hai lien ket kich hoat ben duoi.",
    `Web: ${input.webConfirmUrl}`,
    `Mobile app: ${input.mobileConfirmUrl}`,
  ];
  lines.push("", "Sau khi kich hoat thanh cong, hay dang nhap bang mat khau tam va doi lai mat khau trong phan tai khoan.");
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
