import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

export function getCalendarClient() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!calendarId) {
    throw new Error('GOOGLE_CALENDAR_ID is not set in environment variables');
  }

  if (!serviceAccountEmail) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not set in environment variables');
  }

  if (!privateKey) {
    throw new Error('GOOGLE_PRIVATE_KEY is not set in environment variables');
  }

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  return { calendar, calendarId };
}
