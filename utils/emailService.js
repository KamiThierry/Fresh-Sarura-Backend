import * as Brevo from '@getbrevo/brevo';
import logger from './logger.js';

const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://freshsarura.vercel.app';
const SENDER = { email: 'kamithierry0@gmail.com', name: 'FreshSarura Security' };

const send = async (to, subject, html, label) => {
  const email = new Brevo.SendSmtpEmail();
  email.sender = SENDER;
  email.to = [{ email: to }];
  email.subject = subject;
  email.htmlContent = html;
  try {
    await apiInstance.sendTransacEmail(email);
    logger.info(`${label} sent to: ${to}`);
  } catch (error) {
    logger.error(`Failed to send ${label} to ${to}: ${error.message}`);
    throw error;
  }
};

export const sendPasswordResetEmail = async ({ email, resetToken, userName }) => {
  const resetURL = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  await send(email, 'Reset your Fresh Sarura password', `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:16px;">
            <h2 style="color:#111827;">Hello, ${userName}</h2>
            <p style="color:#4b5563;">We received a request to reset your password. Click below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
            <div style="text-align:center;margin:24px 0;">
                <a href="${resetURL}" style="background:#10b981;color:white;padding:14px 40px;border-radius:12px;text-decoration:none;font-weight:bold;">Reset My Password</a>
            </div>
            <p style="color:#6b7280;font-size:13px;text-align:center;">If you didn't request this, please ignore this email.</p>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:11px;text-align:center;"><strong>Fresh Sarura</strong> · Export & Farmer Hub · Rwanda</p>
        </div>`, 'Password reset email');
};

export const sendFarmerWelcomeEmail = async ({ farmerName, email, password }) => {
  await send(email, 'Welcome to Fresh Sarura — Your Account is Ready', `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:16px;">
            <h2 style="color:#065f46;">Welcome, ${farmerName}!</h2>
            <p style="color:#4b5563;">You have been registered as a <strong>Farm Manager</strong> on Fresh Sarura.</p>
            <div style="background:#f0fdf4;border:1px solid #d1fae5;border-radius:12px;padding:24px;margin:24px 0;">
                <p style="color:#065f46;font-weight:bold;margin:0 0 12px 0;">Your Login Credentials</p>
                <p style="margin:4px 0;color:#111827;"><strong>Email:</strong> ${email}</p>
                <p style="margin:4px 0;color:#111827;"><strong>Password:</strong> ${password}</p>
            </div>
            <p style="color:#ef4444;font-size:12px;text-align:center;">Please change your password after your first login.</p>
            <div style="text-align:center;margin:24px 0;">
                <a href="${FRONTEND_URL}/login" style="background:#10b981;color:white;padding:14px 40px;border-radius:12px;text-decoration:none;font-weight:bold;">Login to Your Portal</a>
            </div>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:11px;text-align:center;"><strong>Fresh Sarura</strong> · Export & Farmer Hub · Rwanda</p>
        </div>`, 'Welcome email');
};

export const sendUserWelcomeEmail = async ({ name, email, password, role }) => {
  const roleLabels = {
    admin: 'Administrator',
    production_manager: 'Production Manager',
    farm_manager: 'Farm Manager',
    logistic_officer: 'Logistics Officer',
    quality_officer: 'QC Officer',
  };
  const roleLabel = roleLabels[role] || role;
  await send(email, 'Welcome to Fresh Sarura — Your Account is Ready', `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:16px;">
            <h2 style="color:#065f46;">Welcome, ${name}!</h2>
            <p style="color:#4b5563;">Your account has been created. You have been assigned the role of <strong>${roleLabel}</strong>.</p>
            <div style="background:#f0fdf4;border:1px solid #d1fae5;border-radius:12px;padding:24px;margin:24px 0;">
                <p style="color:#065f46;font-weight:bold;margin:0 0 12px 0;">Your Login Credentials</p>
                <p style="margin:4px 0;color:#111827;"><strong>Email:</strong> ${email}</p>
                <p style="margin:4px 0;color:#111827;"><strong>Password:</strong> ${password}</p>
            </div>
            <p style="color:#ef4444;font-size:12px;text-align:center;">Please change your password after your first login.</p>
            <div style="text-align:center;margin:24px 0;">
                <a href="${FRONTEND_URL}/login" style="background:#10b981;color:white;padding:14px 40px;border-radius:12px;text-decoration:none;font-weight:bold;">Login to Your Portal</a>
            </div>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:11px;text-align:center;"><strong>Fresh Sarura</strong> · Export & Farmer Hub · Rwanda</p>
        </div>`, 'Welcome email');
};

export const sendContactReplyEmail = async ({ toName, toEmail, inquiryType, originalMsg, replyNote, adminName }) => {
  await send(toEmail, `Re: Your ${inquiryType} Inquiry — Fresh Sarura`, `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:16px;">
            <h2 style="color:#111827;">Hello, ${toName}</h2>
            <p style="color:#4b5563;">Thank you for reaching out. Here is our response to your <strong>${inquiryType}</strong> inquiry.</p>
            <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:8px;padding:16px;margin:20px 0;">
                <p style="color:#065f46;font-weight:bold;font-size:13px;margin:0 0 8px 0;">Our Response</p>
                <p style="color:#1f2937;font-size:14px;line-height:1.7;margin:0;white-space:pre-line;">${replyNote}</p>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
                <p style="color:#9ca3af;font-weight:bold;font-size:12px;margin:0 0 8px 0;">Your Original Message</p>
                <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;white-space:pre-line;">${originalMsg}</p>
            </div>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:11px;text-align:center;">Replied by ${adminName} · <strong>Fresh Sarura</strong> · Kigali, Rwanda</p>
        </div>`, 'Contact reply');
};

export const sendOtpEmail = async ({ email, userName, otp }) => {
  await send(email, 'Your FreshSarura Login Code', `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:16px;">
            <h2 style="color:#065f46;">Hello, ${userName}</h2>
            <p style="color:#4b5563;">Use the verification code below to complete your login. It expires in <strong>10 minutes</strong>.</p>
            <div style="background:#f0fdf4;border:1px solid #d1fae5;border-radius:12px;padding:32px;text-align:center;margin:24px 0;">
                <p style="color:#065f46;font-size:36px;font-weight:bold;letter-spacing:12px;margin:0;">${otp}</p>
            </div>
            <p style="color:#6b7280;font-size:13px;text-align:center;">If you did not attempt to log in, please ignore this email.</p>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:11px;text-align:center;"><strong>Fresh Sarura</strong> · Export & Farmer Hub · Rwanda</p>
        </div>`, 'OTP email');
};