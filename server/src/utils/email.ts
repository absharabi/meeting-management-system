import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import * as ics from 'ics';

dotenv.config();

// Create a transporter using Gmail
// Ensure you have GMAIL_USER and GMAIL_PASS (App Password) in your .env file
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || 'test@gmail.com',
      pass: process.env.GMAIL_PASS || 'test-app-password',
    },
  });
};

export const sendEmail = async (
  to: string, 
  subject: string, 
  html: string,
  meetingDetails?: { title: string, description: string, date: string, startTime: string, endTime: string, venue: string },
  replyTo?: string
) => {
  try {
    const transporter = createTransporter();

    // If we don't have real credentials, just log the email to avoid crashing the server
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      console.log('====================================================');
      console.log('📧 MOCK EMAIL NOTIFICATION (Gmail credentials not found in .env)');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('HTML Context:', html);
      console.log('====================================================');
      return;
    }

    let attachments = [];
    
    if (meetingDetails) {
      const { title, description, date, startTime, endTime, venue } = meetingDetails;
      // Parse date and time safely
      try {
        const dateObj = new Date(date);
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        
        const event: ics.EventAttributes = {
          title,
          description: description || 'No description provided.',
          location: venue || 'Online',
          start: [dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate(), startH, startM],
          end: [dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate(), endH, endM],
          status: 'CONFIRMED',
          busyStatus: 'BUSY',
        };

        const { error, value } = ics.createEvent(event);
        if (!error && value) {
          attachments.push({
            filename: 'invite.ics',
            content: value,
            contentType: 'text/calendar; method=REQUEST'
          });
        }
      } catch (err) {
        console.error('Failed to generate ICS file:', err);
      }
    }

    const mailOptions: any = {
      from: `"Meeting Management System" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      attachments
    };
    if (replyTo) mailOptions.replyTo = replyTo;

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}. Message ID: ${info.messageId}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};
