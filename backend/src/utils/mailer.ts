import nodemailer from 'nodemailer';

// Nodemailer SMTP Transporter Yapılandırması
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // 465 için true, 587 için false
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Ortak Frontend URL'si (IP Tanımı)
 */
const GET_FRONTEND_URL = () => 
  process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://192.168.3.17:3000';

/**
 *  Genel E-posta Gönderim Fonksiyonu
 */
export const sendEmail = async (options: { to: string; subject: string; html: string }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Geçiş Kontrol Sistemi" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('❌ E-posta gönderim hatası:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 *  Yeni Kullanıcı Şifre Oluşturma Bağlantısı Gönderimi
 */
export const sendPasswordCreateEmail = async (email: string, name: string, token: string) => {
  const frontendUrl = GET_FRONTEND_URL();
  
  // DÜZELTME: /create-password yerine /set-password rotası kullanıldı
  const createPasswordUrl = `${frontendUrl}/create-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 40px 16px; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; text-align: center; }
        .header h1 { color: #38bdf8; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
        .badge { display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 12px; border-radius: 999px; margin-top: 10px; }
        .content { padding: 32px 28px; }
        .greeting { color: #0f172a; font-size: 18px; font-weight: 600; margin-top: 0; margin-bottom: 12px; }
        .text { color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 28px; }
        .btn-wrapper { text-align: center; margin: 32px 0; }
        .btn { background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35); }
        .link-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 24px; }
        .link-text { color: #64748b; font-size: 12px; line-height: 1.5; margin: 0; }
        .url { color: #0284c7; word-break: break-all; font-weight: 500; }
        .footer { background-color: #f8fafc; padding: 18px; text-align: center; border-top: 1px solid #e2e8f0; }
        .footer-text { color: #94a3b8; font-size: 11px; margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Geçiş Kontrol Sistemi</h1>
          <span class="badge">Hesap Aktivasyonu</span>
        </div>
        <div class="content">
          <h2 class="greeting">Merhaba ${name}, 👋</h2>
          <p class="text">
            Hesabınız başarıyla oluşturulmuştur. Mobil uygulamaya ve sisteme güvenli erişim sağlayabilmek için aşağıdaki butona tıklayarak ilk şifrenizi belirleyebilirsiniz.
          </p>
          <div class="btn-wrapper">
            <a href="${createPasswordUrl}" class="btn" target="_blank">Şifremi Oluştur</a>
          </div>
          <div class="link-box">
            <p class="link-text">
              * Bu bağlantı <strong>24 saat</strong> boyunca geçerlidir.<br/>
              * Buton çalışmıyorsa bağlantıyı kopyalayıp tarayıcınıza yapıştırabilirsiniz:<br/>
              <span class="url">${createPasswordUrl}</span>
            </p>
          </div>
        </div>
        <div class="footer">
          <p class="footer-text">Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: email,
    subject: '🔑 Hesap Aktivasyonu & Şifre Oluşturma',
    html,
  });
};

/**
 *  Kullanıcı Silindi Bilgilendirme E-postası
 */
export const sendUserDeletedEmail = async (email: string, name: string) => {
  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 40px 16px; }
        .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; padding: 32px 24px; text-align: center; }
        .icon { width: 56px; height: 56px; background-color: #ffe4e6; color: #e11d48; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px; }
        h2 { color: #0f172a; font-size: 18px; margin: 0 0 12px 0; }
        p { color: #64748b; font-size: 14px; line-height: 1.6; margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">⚠️</div>
        <h2>Hesap Bilgilendirmesi</h2>
        <p>Sayın <strong>${name}</strong>, Geçiş Kontrol Sistemi üzerindeki kullanıcı hesabınız yönetici kararıyla silinmiştir.</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: email,
    subject: 'Hesabınız Silindi',
    html,
  });
};

/**
 *  Şifre Sıfırlama E-postası
 */
export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  const frontendUrl = GET_FRONTEND_URL();

  // DÜZELTME: /create-password yerine /set-password rotası kullanıldı
  const resetUrl = `${frontendUrl}/set-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 40px 16px; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0; }
        .header { background: #0f172a; padding: 24px; text-align: center; }
        .header h1 { color: #38bdf8; margin: 0; font-size: 18px; }
        .content { padding: 32px 28px; text-align: center; }
        .greeting { color: #0f172a; font-size: 18px; margin-top: 0; margin-bottom: 12px; }
        p { color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
        .btn { background: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Geçiş Kontrol Sistemi</h1>
        </div>
        <div class="content">
          <h2 class="greeting">Şifre Sıfırlama Talebi 🔐</h2>
          <p>Hesabınız için bir şifre sıfırlama talebi aldık. Yeni şifrenizi belirlemek için aşağıdaki butona tıklayabilirsiniz:</p>
          <a href="${resetUrl}" class="btn" target="_blank">Şifremi Sıfırla</a>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: email,
    subject: '🔐 Şifre Sıfırlama Talebi',
    html,
  });
};

export default {
  sendEmail,
  sendPasswordCreateEmail,
  sendUserDeletedEmail,
  sendPasswordResetEmail,
  transporter,
};