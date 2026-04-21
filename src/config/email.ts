import dotenv from "dotenv";
import nodemailer from "nodemailer";
dotenv.config();

const transporter = nodemailer.createTransport({
    service:"gmail",
    auth:{
        user: "vishudovetail@gmail.com",
        pass: "paexwljsttmlrjyp", 
    },
    secure: false,
})


export const sendEmail = async (
  subject: string,
  password: string,
  email: string,
  firstName: string,
  lastName: string
) => {
  try {
    const fullName = `${firstName} ${lastName}`;

    const response = await transporter.sendMail({
      from: '"Support Team 👨‍💻" <vishudovetail@gmail.com>',
      to: email,
      subject,
      text: `Hello ${fullName},

Your registration was successful 🎉

Here are your login details:
Email: ${email}
Password: ${password}

Please change your password after your first login for security.

Best regards,  
Support Team
      `,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #4CAF50;">🎉 Registration Successful!</h2>
          <p>Hello <b>${fullName}</b>,</p>
          <p>We’re excited to have you on board. Your account has been created successfully. Below are your login details:</p>
          
          <div style="background:#f9f9f9; padding:12px; border-radius:8px; margin:15px 0; border:1px solid #ddd;">
            <p><b>Email:</b> ${email}</p>
            <p><b>Password:</b> ${password}</p>
          </div>

          <p>🔐 <b>Security Tip:</b> For your safety, please change your password after your first login.</p>
          <p>👉 You can log in anytime to explore our services and manage your account.</p>

          <div style="margin:20px 0;">
            <a href="https://yourapp.com/login" 
               style="background:#4CAF50; color:#fff; padding:10px 18px; text-decoration:none; border-radius:5px; font-weight:bold;">
               Login Now
            </a>
          </div>

          <p>If you have any questions, feel free to reply to this email or reach our support team.</p>
          
          <p style="margin-top:25px;">Best regards,<br><b>Support Team 👨‍💻</b></p>
        </div>
      `,
    });

    console.log("✅ Mail sent:", response.messageId);
    return response;
  } catch (error) {
    console.error("❌ Mail error:", error);
    throw error;
  }
};

export const forgotpassword = async (
  subject: string,
  otp: string,
  email: string
) => {
  try {
    const response = await transporter.sendMail({
      from: '"Support Team" <vishudovetail@gmail.com>',
      to: email,
      subject,
      text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color:#4CAF50;">Password Reset OTP</h2>
          <p>Hello,</p>
          <p>You requested to reset your password. Use the OTP below to proceed:</p>

          <div style="background:#f4f4f4; padding:15px; border-radius:6px; border:1px solid #ddd; margin:15px 0;">
            <h1 style="margin:0; font-size:28px; color:#333; letter-spacing:3px;">
              ${otp}
            </h1>
          </div>

          <p>This OTP is valid for <b>10 minutes</b>.</p>
          <p>If you did not request this, please ignore this email.</p>

          <p style="margin-top:25px;">Best regards,<br><b>Support Team</b></p>
        </div>
      `,
    });

    console.log("Email sent:", response.messageId);
    return response;

  } catch (error) {
    console.error("Mail error:", error);
    return;
  }
};