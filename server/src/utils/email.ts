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

    // Create a clean plain text fallback to prevent spam filters from flagging HTML-only emails
    const textFallback = html
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .trim();

    const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f1f5f9;">
  ${html}
</body>
</html>
    `;

    const mailOptions: any = {
      from: `"Meeting Management System" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: fullHtml,
      text: textFallback, // Plain text alternative is crucial for spam avoidance
      headers: {
        'X-Priority': '1 (Highest)',
        'X-Mailer': 'MMS Mailer',
        'Importance': 'High',
        'List-Unsubscribe': `<mailto:${process.env.GMAIL_USER}?subject=unsubscribe>`
      },
      attachments
    };
    if (replyTo) mailOptions.replyTo = replyTo;

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}. Message ID: ${info.messageId}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};
