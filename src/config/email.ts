import { BrevoClient } from '@getbrevo/brevo';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Initialize the new Brevo Client (SDK v5+)
const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY as string,
});

// ✅ Common sender (verified in Brevo)
const sender = {
  name: "Support Team 👨‍💻",
  email: "vishudovetail@gmail.com",
};

// ✅ Registration Email
export const sendEmail = async (
  subject: string,
  password: string,
  email: string,
  firstName: string,
  lastName: string
) => {
  try {
    const fullName = `${firstName} ${lastName}`;

    const response = await brevo.transactionalEmails.sendTransacEmail({
      subject,
      sender,
      to: [{ email, name: fullName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #4CAF50;">🎉 Registration Successful!</h2>
          <p>Hello <b>${fullName}</b>,</p>
          <p>Your account has been created successfully.</p>
          
          <div style="background:#f9f9f9; padding:12px; border-radius:8px; border:1px solid #ddd;">
            <p><b>Email:</b> ${email}</p>
            <p><b>Password:</b> ${password}</p>
          </div>

          <p>🔐 Please change your password after login.</p>

          <a href="https://yourapp.com/login"
             style="background:#4CAF50; color:#fff; padding:10px 18px; text-decoration:none; border-radius:5px;">
             Login Now
          </a>

          <p style="margin-top:20px;">Support Team 👨‍💻</p>
        </div>
      `,
    });

    console.log("✅ Mail sent:", response);
    return response;

  } catch (error) {
    console.error("❌ Mail error:", error);
    throw error;
  }
};

// ✅ Forgot Password OTP
export const forgotpassword = async (
  subject: string,
  otp: string,
  email: string
) => {
  try {
    const response = await brevo.transactionalEmails.sendTransacEmail({
      subject,
      sender,
      to: [{ email }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color:#4CAF50;">Password Reset OTP</h2>
          <p>Your OTP:</p>

          <div style="background:#f4f4f4; padding:15px; border-radius:6px;">
            <h1 style="letter-spacing:3px;">${otp}</h1>
          </div>

          <p>This OTP is valid for 10 minutes.</p>
        </div>
      `,
    });

    console.log("✅ OTP sent:", response);
    return response;

  } catch (error) {
    console.error("❌ OTP error:", error);
  }
};