"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.forgotpassword = exports.generatePassword = exports.sendMultipleMail = exports.sendEmail = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const nodemailer_1 = __importDefault(require("nodemailer"));
dotenv_1.default.config();
// const transporter = nodemailer.createTransport({
//   host: "live.smtp.mailtrap.io",  // ✅ correct host
//   port: 587,                      // ✅ use 587 (TLS) instead of 465
//   auth: {
//     user: "smtp@mailtrap.io",
//     pass: "5beeb9123be33e0b3dfb185e46856e07", // API token from Mailtrap
//   },
// });
// ✅ Use Brevo (Sendinblue) for better reliability on DigitalOcean
const transporter = nodemailer_1.default.createTransport({
    host: "smtp-relay.brevo.com",
    port: 2525,
    auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS,
    },
});
const sendEmail = (subject, password, email, firstName, lastName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const fullName = `${firstName} ${lastName}`;
        const response = yield transporter.sendMail({
            from: `"Support Team 👨‍💻" <${process.env.EMAIL_FROM || "salesvera@dovetailsolutions.in"}>`,
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
        return response;
    }
    catch (error) {
        console.error("❌ Mail error:", error);
        throw error;
    }
});
exports.sendEmail = sendEmail;
const sendMultipleMail = (companies) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (companies.length === 0) {
            console.log("No companies to send email");
            return;
        }
        // Build HTML template
        const htmlMessage = `
      <h2>Companies with Lead Count ≤ 5</h2>
      <p>The following companies have low leads and need attention:</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
        <thead>
          <tr>
            <th>#</th>
            <th>Company Name</th>
            <th>Lead Count</th>
            <th>Company Email</th>
            <th>Company Phone</th>
            <th>User Name</th>
            <th>User Email</th>
            <th>User Phone</th>
          </tr>
        </thead>
        <tbody>
          ${companies
            .map((c, index) => {
            var _a, _b, _c, _d;
            return `
            <tr>
              <td>${index + 1}</td>
              <td>${c.company_name}</td>
              <td>${c.lead_count}</td>
              <td>${c.company_email || "N/A"}</td>
              <td>${c.phone || "N/A"}</td>
              <td>${((_a = c.user) === null || _a === void 0 ? void 0 : _a.first_name) || ""} ${((_b = c.user) === null || _b === void 0 ? void 0 : _b.last_name) || ""}</td>
              <td>${((_c = c.user) === null || _c === void 0 ? void 0 : _c.email) || "N/A"}</td>
              <td>${((_d = c.user) === null || _d === void 0 ? void 0 : _d.phone_number) || "N/A"}</td>
            </tr>
          `;
        })
            .join("")}
        </tbody>
      </table>
      <p>Regards,<br/>Support Team 👨‍💻</p>
    `;
        // Send email using your existing transporter
        const response = yield transporter.sendMail({
            from: '"Support Team 👨‍💻" <vishudovetail@gmail.com>',
            to: "sumeetkumar.841@gmail.com",
            subject: "Companies with Low Leads (≤ 5)",
            html: htmlMessage,
        });
    }
    catch (error) {
        console.error("❌ Error sending email:", error);
    }
});
exports.sendMultipleMail = sendMultipleMail;
// utils/generatePassword.ts
const generatePassword = () => {
    const chars = "0123456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        password += chars[randomIndex];
    }
    return password;
}; // ✅ Forgot Password OTP Email
exports.generatePassword = generatePassword;
const forgotpassword = (subject, otp, email) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield transporter.sendMail({
            from: `"Support Team 👨‍💻" <${process.env.EMAIL_FROM || "salesvera@dovetailsolutions.in"}>`,
            to: email,
            subject,
            text: `Your OTP for password reset is: ${otp}. Valid for 10 minutes.`,
            html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color:#4CAF50;">Password Reset OTP</h2>
          <p>You requested a password reset. Please use the following One-Time Password (OTP):</p>

          <div style="background:#f4f4f4; padding:15px; border-radius:6px; text-align:center;">
            <h1 style="letter-spacing:5px; color:#4CAF50;">${otp}</h1>
          </div>

          <p>This OTP is valid for <b>10 minutes</b>. If you did not request this, please ignore this email.</p>
          
          <p style="margin-top:25px;">Best regards,<br><b>Support Team 👨‍💻</b></p>
        </div>
      `,
        });
        return response;
    }
    catch (error) {
        console.error("❌ OTP error:", error);
        throw error;
    }
});
exports.forgotpassword = forgotpassword;
