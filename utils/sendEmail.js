// utils/sendEmail.js
import transporter from '../config/email.js';

const EMAIL_USER = 'tirtho.kyptronix@gmail.com';

const sendEmail = async (options) => {
  const mailOptions = {
    from: `Patient Pharmacy System <${EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.html
  };

  await transporter.sendMail(mailOptions);
};

export const sendOTPEmail = async (email, otp, purpose) => {
  const subjects = {
    email_verification: 'Verify Your Email',
    password_reset: 'Reset Your Password',
    two_factor: 'Two-Factor Authentication'
  };

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px;">
        <h2 style="color: #333; text-align: center;">${subjects[purpose]}</h2>
        <p style="color: #666; font-size: 16px; text-align: center;">Your OTP code is:</p>
        <div style="background-color: #fff; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <h1 style="color: #4CAF50; font-size: 48px; margin: 0; letter-spacing: 8px;">${otp}</h1>
        </div>
        <p style="color: #666; font-size: 14px; text-align: center;">This code will expire in 10 minutes.</p>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">If you didn't request this, please ignore this email.</p>
      </div>
    </div>
  `;

  try {
    await sendEmail({
      email,
      subject: subjects[purpose],
      html
    });
    console.log(`OTP email sent successfully to ${email}`);
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    throw error;
  }
};

// Send pharmacy approval notification to admin
export const sendApprovalNotificationToAdmin = async (adminEmail, pharmacyDetails) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px;">
        <h2 style="color: #333; text-align: center;">New Pharmacy Registration Request</h2>
        <div style="background-color: #fff; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #4CAF50; margin-bottom: 15px;">Pharmacy Details:</h3>
          <p style="color: #666; margin: 10px 0;"><strong>Pharmacy Name:</strong> ${pharmacyDetails.pharmacyName}</p>
          <p style="color: #666; margin: 10px 0;"><strong>Email:</strong> ${pharmacyDetails.email}</p>
          <p style="color: #666; margin: 10px 0;"><strong>Request ID:</strong> ${pharmacyDetails.requestId}</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">Please log in to the admin panel to review this request.</p>
        </div>
      </div>
    </div>
  `;

  try {
    await sendEmail({
      email: adminEmail,
      subject: 'New Pharmacy Registration Pending Approval',
      html
    });
    console.log(`Admin notification sent to ${adminEmail}`);
  } catch (error) {
    console.error('Failed to send admin notification:', error);
    throw error;
  }
};

// Send approval email to pharmacy
export const sendApprovalEmail = async (email, details) => {
  // If details contains otp, it's the approval email to pharmacy
  if (details.otp) {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px;">
          <h2 style="color: #4CAF50; text-align: center;">🎉 Congratulations!</h2>
          <h3 style="color: #333; text-align: center;">Your Pharmacy Registration is Approved</h3>
          
          <div style="background-color: #fff; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="color: #666; font-size: 16px;">Dear ${details.pharmacyName},</p>
            <p style="color: #666;">We are pleased to inform you that your pharmacy registration has been approved. Welcome to our platform!</p>
            
            <p style="color: #666; margin-top: 20px;">Please verify your email address using the OTP below to activate your account:</p>
            <div style="background-color: #f0f8ff; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <h1 style="color: #4CAF50; font-size: 48px; margin: 0; letter-spacing: 8px;">${details.otp}</h1>
            </div>
            
            ${details.remarks ? `
              <div style="background-color: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="color: #856404; margin: 0;"><strong>Admin Remarks:</strong> ${details.remarks}</p>
              </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666; font-size: 14px;">You can now log in to your account and start managing your pharmacy profile.</p>
          </div>
          
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">This is an automated email. Please do not reply.</p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        email,
        subject: '✅ Your Pharmacy Registration Has Been Approved!',
        html
      });
      console.log(`Approval email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send approval email:', error);
      throw error;
    }
  } else {
    // This is the notification to admin about new registration
    await sendApprovalNotificationToAdmin(email, details);
  }
};

// Send rejection email to pharmacy
export const sendRejectionEmail = async (email, details) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px;">
        <h2 style="color: #dc3545; text-align: center;">Pharmacy Registration Update</h2>
        
        <div style="background-color: #fff; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #666; font-size: 16px;">Dear ${details.pharmacyName},</p>
          <p style="color: #666;">Thank you for your interest in joining our platform.</p>
          
          <p style="color: #666; margin-top: 20px;">After reviewing your application, we regret to inform you that we are unable to approve your pharmacy registration at this time.</p>
          
          <div style="background-color: #f8d7da; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="color: #721c24; margin: 0;"><strong>Reason:</strong> ${details.remarks}</p>
          </div>
          
          <p style="color: #666; margin-top: 20px;">If you believe this decision was made in error or if you have additional information to provide, please feel free to:</p>
          <ul style="color: #666;">
            <li>Contact our support team for clarification</li>
            <li>Submit a new application with the required corrections</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">We appreciate your understanding and look forward to potentially working with you in the future.</p>
        </div>
        
        <hr style="border: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">This is an automated email. Please do not reply.</p>
      </div>
    </div>
  `;

  try {
    await sendEmail({
      email,
      subject: 'Pharmacy Registration Status Update',
      html
    });
    console.log(`Rejection email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send rejection email:', error);
    throw error;
  }
};

// Send welcome email for new admin
export const sendAdminWelcomeEmail = async (email, details) => {
  const permissionsDisplay = {
    manage_users: 'Manage Users',
    manage_pharmacies: 'Manage Pharmacies',
    manage_patients: 'Manage Patients',
    view_transactions: 'View Transactions',
    manage_settings: 'Manage Settings',
    view_analytics: 'View Analytics'
  };

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px;">
        <h2 style="color: #333; text-align: center;">Welcome to the Admin Team!</h2>
        
        <div style="background-color: #fff; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #666; font-size: 16px;">Dear ${details.firstName} ${details.lastName},</p>
          <p style="color: #666;">Your admin account has been created successfully. You are now part of our administrative team.</p>
          
          <div style="background-color: #d4edda; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #155724; margin-bottom: 10px;">Your Permissions:</h4>
            <ul style="color: #155724; margin: 0;">
              ${details.permissions.map(perm => `<li>${permissionsDisplay[perm] || perm}</li>`).join('')}
            </ul>
          </div>
          
          <p style="color: #666; margin-top: 20px;">To get started:</p>
          <ol style="color: #666;">
            <li>Log in using your registered email and password</li>
            <li>Verify your email address when prompted</li>
            <li>Access the admin dashboard to manage the platform</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">If you have any questions, please contact the super admin.</p>
        </div>
        
        <hr style="border: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">Best regards,<br>Patient Pharmacy System Team</p>
      </div>
    </div>
  `;

  try {
    await sendEmail({
      email,
      subject: 'Welcome to Admin Panel - Patient Pharmacy System',
      html
    });
    console.log(`Admin welcome email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send admin welcome email:', error);
    throw error;
  }
};

export default sendEmail;