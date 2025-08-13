import transporter from "../config/email.js";

// Send contact form email
export const sendContactEmail = async (req, res) => {
  try {
    console.log(req.body);
    const { firstName, lastName, email, phone, subject, message } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Create email content for admin/support team
    const adminEmailContent = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #115E59 0%, #0F4C47 100%); color: #DBF5F0;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #FDE047; font-size: 28px; margin: 0; font-weight: 700;">New Contact Form Submission</h1>
          <p style="color: rgba(219, 245, 240, 0.8); margin: 10px 0 0 0;">Online Pharmacy Platform</p>
        </div>
        
        <div style="background: rgba(15, 76, 71, 0.7); padding: 25px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(253, 224, 71, 0.3);">
          <h2 style="color: #FDE047; font-size: 20px; margin: 0 0 20px 0; border-bottom: 2px solid rgba(253, 224, 71, 0.3); padding-bottom: 10px;">Contact Details</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #FDE047; font-weight: 600; width: 120px;">Name:</td>
              <td style="padding: 8px 0; color: #DBF5F0;">${firstName} ${lastName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #FDE047; font-weight: 600;">Email:</td>
              <td style="padding: 8px 0; color: #DBF5F0;">${email}</td>
            </tr>
            ${
              phone
                ? `
            <tr>
              <td style="padding: 8px 0; color: #FDE047; font-weight: 600;">Phone:</td>
              <td style="padding: 8px 0; color: #DBF5F0;">${phone}</td>
            </tr>
            `
                : ""
            }
            <tr>
              <td style="padding: 8px 0; color: #FDE047; font-weight: 600;">Subject:</td>
              <td style="padding: 8px 0; color: #DBF5F0;">${subject}</td>
            </tr>
          </table>
        </div>
        
        <div style="background: rgba(15, 76, 71, 0.7); padding: 25px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(253, 224, 71, 0.3);">
          <h2 style="color: #FDE047; font-size: 20px; margin: 0 0 15px 0;">Message</h2>
          <div style="background: rgba(17, 94, 89, 0.5); padding: 15px; border-radius: 8px; color: #DBF5F0; line-height: 1.6;">
            ${message.replace(/\n/g, "<br>")}
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: rgba(253, 224, 71, 0.1); border-radius: 8px; border: 1px solid rgba(253, 224, 71, 0.3);">
          <p style="margin: 0; color: rgba(219, 245, 240, 0.8); font-size: 14px;">
            This message was sent from the Online Pharmacy contact form.<br>
            Please respond to the customer within 24 hours for the best experience.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(253, 224, 71, 0.3);">
          <p style="color: rgba(219, 245, 240, 0.6); font-size: 12px; margin: 0;">
            © 2024 Online Pharmacy Platform. All rights reserved.
          </p>
        </div>
      </div>
    `;

    // Create auto-reply email content for the user
    const userEmailContent = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #115E59 0%, #0F4C47 100%); color: #DBF5F0;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #FDE047; font-size: 28px; margin: 0; font-weight: 700;">Thank You for Contacting Us!</h1>
          <p style="color: rgba(219, 245, 240, 0.8); margin: 10px 0 0 0;">Online Pharmacy Platform</p>
        </div>
        
        <div style="background: rgba(15, 76, 71, 0.7); padding: 25px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(253, 224, 71, 0.3);">
          <h2 style="color: #FDE047; font-size: 20px; margin: 0 0 15px 0;">Hello ${firstName},</h2>
          <p style="color: #DBF5F0; line-height: 1.6; margin: 0 0 15px 0;">
            Thank you for reaching out to us! We have received your message and our support team will review it carefully.
          </p>
          <p style="color: #DBF5F0; line-height: 1.6; margin: 0 0 15px 0;">
            <strong style="color: #FDE047;">Subject:</strong> ${subject}
          </p>
          <p style="color: #DBF5F0; line-height: 1.6; margin: 0;">
            We typically respond to all inquiries within 24 hours during business days. If your matter is urgent, please call us at <strong style="color: #FDE047;">+1-202-555-0172</strong>.
          </p>
        </div>
        
        <div style="background: rgba(253, 224, 71, 0.1); padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid rgba(253, 224, 71, 0.3); text-align: center;">
          <h3 style="color: #FDE047; margin: 0 0 10px 0; font-size: 18px;">Need Immediate Help?</h3>
          <p style="color: #DBF5F0; margin: 0 0 15px 0;">Our customer support is available:</p>
          <p style="color: #DBF5F0; margin: 0; font-weight: 600;">
            📞 Phone: +1-202-555-0172<br>
            📧 Email: support@pharmacy.com<br>
            🕒 Hours: Mon-Fri 8AM-8PM, Sat-Sun 9AM-6PM
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(253, 224, 71, 0.3);">
          <p style="color: rgba(219, 245, 240, 0.8); margin: 0 0 10px 0;">
            Best regards,<br>
            <strong style="color: #FDE047;">The Online Pharmacy Team</strong>
          </p>
          <p style="color: rgba(219, 245, 240, 0.6); font-size: 12px; margin: 0;">
            © 2024 Online Pharmacy Platform. All rights reserved.
          </p>
        </div>
      </div>
    `;

    // Send email to admin/support team
    const adminMailOptions = {
      from: `"Online Pharmacy Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Admin email
      subject: `New Contact Form: ${subject}`,
      html: adminEmailContent,
      replyTo: email, // Allow admin to reply directly to the user
    };

    // Send auto-reply to user
    const userMailOptions = {
      from: `"Online Pharmacy Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject:
        "Thank you for contacting Online Pharmacy - We received your message",
      html: userEmailContent,
    };

    // Send both emails
    await Promise.all([
      transporter.sendMail(adminMailOptions),
      transporter.sendMail(userMailOptions),
    ]);

    console.log(`Contact form email sent successfully from ${email}`);

    res.status(200).json({
      success: true,
      message:
        "Your message has been sent successfully! We will get back to you within 24 hours.",
      data: {
        firstName,
        lastName,
        email,
        subject,
      },
    });
  } catch (error) {
    console.error("Contact form email error:", error);
    res.status(500).json({
      success: false,
      message:
        "Failed to send your message. Please try again or contact us directly.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get contact information (for display purposes)
export const getContactInfo = async (req, res) => {
  try {
    const contactInfo = {
      address: {
        street: "123 Independence Ave SE",
        city: "Washington",
        state: "DC",
        zipCode: "20003",
        country: "USA",
      },
      phone: "+1-202-555-0172",
      email: "support@pharmacy.com",
      hours: {
        weekdays: "Mon - Fri: 8:00 AM - 8:00 PM",
        weekends: "Sat - Sun: 9:00 AM - 6:00 PM",
      },
      socialMedia: {
        facebook: "https://facebook.com/onlinepharmacy",
        instagram: "https://instagram.com/onlinepharmacy",
        linkedin: "https://linkedin.com/company/onlinepharmacy",
      },
    };

    res.status(200).json({
      success: true,
      data: contactInfo,
    });
  } catch (error) {
    console.error("Get contact info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve contact information",
    });
  }
};

// Generic email sending function for other controllers to use
export const sendEmail = async (emailData) => {
  try {
    const { to, subject, html, text } = emailData;

    const mailOptions = {
      from: `"DoctorPortal Pharmacy" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text: text || html?.replace(/<[^>]*>/g, ""), // Strip HTML for text version if not provided
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
};
