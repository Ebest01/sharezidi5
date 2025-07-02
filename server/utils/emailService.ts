import { MailService } from '@sendgrid/mail';

interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  // If no SendGrid API key is provided, log the email instead of sending
  if (!process.env.SENDGRID_API_KEY) {
    console.log('📧 [EMAIL SIMULATION] Would send email:');
    console.log(`To: ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    console.log(`Content: ${params.text}`);
    console.log('Note: Set SENDGRID_API_KEY to actually send emails');
    return true;
  }

  try {
    const mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY);
    
    const emailData = {
      to: params.to,
      from: params.from || 'noreply@sharezidi.com',
      subject: params.subject,
      ...(params.text && { text: params.text }),
      ...(params.html && { html: params.html }),
    };
    
    await mailService.send(emailData);
    
    console.log(`✅ Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ SendGrid email error:', error);
    return false;
  }
}

export function createRegistrationEmail(email: string, username: string, password: string) {
  const subject = 'Welcome to ShareZidi - Your Account Details';
  
  const text = `
Welcome to ShareZidi!

Your account has been created successfully:

Email: ${email}
Username: ${username}
Password: ${password}

You can now log in to ShareZidi using your email and the password above.

For security, we recommend changing your password after your first login.

Best regards,
The ShareZidi Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">Welcome to ShareZidi!</h2>
      
      <p>Your account has been created successfully.</p>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Your Account Details:</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Username:</strong> ${username}</p>
        <p><strong>Password:</strong> <code style="background: #e2e8f0; padding: 4px 8px; border-radius: 4px;">${password}</code></p>
      </div>
      
      <p>You can now log in to ShareZidi using your email and the password above.</p>
      
      <p style="color: #64748b; font-size: 14px;">
        For security, we recommend changing your password after your first login.
      </p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 12px;">
        Best regards,<br>
        The ShareZidi Team
      </p>
    </div>
  `;

  return { subject, text, html };
}