// config/email.js
import nodemailer from 'nodemailer';

// Direct credentials (temporary solution)
const EMAIL_USER = 'tirtho.kyptronix@gmail.com';
const EMAIL_PASS = 'kozi ozmn wtzn cuyg';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

export default transporter;