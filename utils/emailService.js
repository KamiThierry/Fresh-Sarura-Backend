import nodemailer from 'nodemailer';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  family: 4,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://freshsarura.vercel.app';

export const sendPasswordResetEmail = async ({ email, resetToken, userName }) => {
  const resetURL = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  const mailOptions = {
    from: `"FreshSarura Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 Reset your Fresh Sarura password',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px;">
          <div style="padding: 8px 12px; margin-bottom: 16px;">
            <h2 style="color: #111827; font-size: 20px; margin: 0 0 12px 0;">Hello, ${userName}</h2>
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
              We received a request to reset your password for your Fresh Sarura account. 
              Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.
            </p>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${resetURL}" 
                 style="display: inline-block; background: #10b981; color: white; padding: 14px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
                Reset My Password →
              </a>
            </div>
            <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0; text-align: center;">
              If you didn't request a password reset, please ignore this email.
            </p>
          </div>
          <div style="text-align: center; padding: 24px 16px 8px 16px; border-top: 1px solid #f3f4f6; margin-top: 20px;">
            <p style="color: #9ca3af; font-size: 11px; margin: 0; line-height: 1.6;">
              <strong>Fresh Sarura</strong> · Export & Farmer Hub · Rwanda<br/>
              If you're having trouble, copy and paste this link:<br/>
              <span style="color: #10b981;">${resetURL}</span>
            </p>
          </div>
        </div>
        `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to: ${email}`);
  } catch (error) {
    logger.error(`Failed to send reset email to ${email}: ${error.message}`);
    throw error;
  }
};

export const sendFarmerWelcomeEmail = async ({ farmerName, email, password }) => {
  const mailOptions = {
    from: `"FreshSarura Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🌿 Welcome to Fresh Sarura — Your Account is Ready',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px;">
          <div style="padding: 8px 12px;">
            <h2 style="color: #065f46; font-size: 20px; margin: 0 0 12px 0;">Welcome, ${farmerName}! 👋</h2>
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">
              You have been registered as a <strong>Farm Manager</strong> on the Fresh Sarura platform. 
              You can now log in to access your farmer portal and manage your farm operations.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #d1fae5; border-radius: 12px; padding: 24px; margin: 24px 0;">
              <p style="color: #065f46; font-weight: bold; margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">🔐 Your Login Credentials</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 100px;">Email:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: bold; font-size: 14px;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Password:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: bold; font-size: 14px; letter-spacing: 1px;">${password}</td>
                </tr>
              </table>
            </div>
            <p style="color: #ef4444; font-size: 12px; margin: 0 0 24px 0; text-align: center; font-style: italic;">
              ⚠️ Please change your password after your first login for security.
            </p>
            <div style="text-align: center; margin-bottom: 12px;">
              <a href="${FRONTEND_URL}/login" 
                 style="display: inline-block; background: #10b981; color: white; padding: 14px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
                Login to Your Portal →
              </a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 16px 8px 16px; border-top: 1px solid #f3f4f6; margin-top: 20px;">
            <p style="color: #9ca3af; font-size: 11px; margin: 0; line-height: 1.6;">
              <strong>Fresh Sarura</strong> · Export & Farmer Hub · Rwanda<br/>
              GlobalG.A.P. Certified · 500+ Outgrowers · 14 Export Markets
            </p>
          </div>
        </div>
        `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to: ${email}`);
  } catch (error) {
    logger.error(`Failed to send email to ${email}: ${error.message}`);
    throw error;
  }
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

  const mailOptions = {
    from: `"FreshSarura Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🌿 Welcome to Fresh Sarura — Your Account is Ready',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px;">
          <div style="padding: 8px 12px;">
            <h2 style="color: #065f46; font-size: 20px; margin: 0 0 12px 0;">Welcome, ${name}! 👋</h2>
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">
              Your account has been created by an administrator on the Fresh Sarura platform.
              You have been assigned the role of <strong>${roleLabel}</strong>.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #d1fae5; border-radius: 12px; padding: 24px; margin: 24px 0;">
              <p style="color: #065f46; font-weight: bold; margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">🔐 Your Login Credentials</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 100px;">Email:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: bold; font-size: 14px;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Password:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: bold; font-size: 14px; letter-spacing: 1px;">${password}</td>
                </tr>
              </table>
            </div>
            <p style="color: #ef4444; font-size: 12px; margin: 0 0 24px 0; text-align: center; font-style: italic;">
              ⚠️ Please change your password after your first login for security.
            </p>
            <div style="text-align: center; margin-bottom: 12px;">
              <a href="${FRONTEND_URL}/login" 
                 style="display: inline-block; background: #10b981; color: white; padding: 14px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
                Login to Your Portal →
              </a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 16px 8px 16px; border-top: 1px solid #f3f4f6; margin-top: 20px;">
            <p style="color: #9ca3af; font-size: 11px; margin: 0; line-height: 1.6;">
              <strong>Fresh Sarura</strong> · Export & Farmer Hub · Rwanda<br/>
              GlobalG.A.P. Certified · 500+ Outgrowers · 14 Export Markets
            </p>
          </div>
        </div>
        `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to: ${email}`);
  } catch (error) {
    logger.error(`Failed to send welcome email to ${email}: ${error.message}`);
    throw error;
  }
};

export const sendContactReplyEmail = async ({ toName, toEmail, inquiryType, originalMsg, replyNote, adminName }) => {
  const mailOptions = {
    from: `"FreshSarura" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Re: Your ${inquiryType} Inquiry — Fresh Sarura`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px;">
          <div style="padding: 8px 12px;">
            <h2 style="color: #111827; font-size: 18px; margin: 0 0 8px 0;">Hello, ${toName}</h2>
            <p style="color: #4b5563; font-size: 14px; margin: 0 0 20px 0;">
              Thank you for reaching out. Here is our response to your <strong>${inquiryType}</strong> inquiry.
            </p>
            <div style="background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <p style="color: #065f46; font-weight: bold; font-size: 13px; margin: 0 0 8px 0;">Our Response</p>
              <p style="color: #1f2937; font-size: 14px; line-height: 1.7; margin: 0; white-space: pre-line;">${replyNote}</p>
            </div>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <p style="color: #9ca3af; font-weight: bold; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;">Your Original Message</p>
              <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0; white-space: pre-line;">${originalMsg}</p>
            </div>
            <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
              If you have further questions, feel free to reply to this email.
            </p>
          </div>
          <div style="text-align: center; padding: 24px 16px 8px 16px; border-top: 1px solid #f3f4f6; margin-top: 20px;">
            <p style="color: #9ca3af; font-size: 11px; margin: 0; line-height: 1.6;">
              Replied by ${adminName} · <strong>Fresh Sarura</strong> · Kigali, Rwanda<br/>
              +250 (780) 389-786 · info@gardenfreshrwanda.com
            </p>
          </div>
        </div>
        `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Contact reply sent to: ${toEmail}`);
  } catch (error) {
    logger.error(`Failed to send reply to ${toEmail}: ${error.message}`);
    throw error;
  }
};

export const sendOtpEmail = async ({ email, userName, otp }) => {
  const mailOptions = {
    from: `"FreshSarura Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your FreshSarura Login Code',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px;">
          <div style="padding: 8px 12px;">
            <h2 style="color: #065f46; font-size: 20px; margin: 0 0 12px 0;">Hello, ${userName}</h2>
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
              Use the verification code below to complete your login. It expires in <strong>10 minutes</strong>.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #d1fae5; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
              <p style="color: #065f46; font-size: 36px; font-weight: bold; letter-spacing: 12px; margin: 0;">${otp}</p>
            </div>
            <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
              If you did not attempt to log in, please ignore this email or contact your administrator.
            </p>
          </div>
          <div style="text-align: center; padding: 24px 16px 8px 16px; border-top: 1px solid #f3f4f6; margin-top: 20px;">
            <p style="color: #9ca3af; font-size: 11px; margin: 0; line-height: 1.6;">
              <strong>Fresh Sarura</strong> · Export & Farmer Hub · Rwanda
            </p>
          </div>
        </div>
        `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`OTP email sent to: ${email}`);
  } catch (error) {
    logger.error(`Failed to send OTP email to ${email}: ${error.message}`);
    throw error;
  }
};