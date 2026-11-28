// Outgoing mail (docs/06 §10.1): only one-time codes so far. Locally SMTP is mailpit (07 §4).
import nodemailer from 'nodemailer';

export interface Mailer {
  send(m: { to: string; subject: string; text: string }): Promise<void>;
}

export function smtpMailer(o: { host: string; port: number; from: string }): Mailer {
  const t = nodemailer.createTransport({
    host: o.host,
    port: o.port,
    secure: false,
    ignoreTLS: true,
  });
  return {
    async send(m) {
      await t.sendMail({ from: o.from, ...m });
    },
  };
}
