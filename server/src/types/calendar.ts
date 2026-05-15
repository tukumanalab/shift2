export interface CalendarSyncResult {
  success: boolean;
  error?: string;
  calendarEventId?: string;
}

export interface ShiftInfo {
  uuid: string;
  user_id: string;
  user_name: string;
  email?: string | null;
  date: string;
  time_slot: string;
  type: 'shift';
}

export interface MergedTimeSlot {
  user_id: string;
  user_name: string;
  email?: string | null;
  date: string;
  start_time: string;
  end_time: string;
  shift_uuids: string[];
  type: 'shift';
}

export interface SyncResult {
  success: boolean;
  total: number;
  created: number;
  failed: number;
  errors?: Array<{ shift: ShiftInfo; error: string }>;
}

export interface CalendarEvent {
  summary: string;
  description: string;
  location: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  extendedProperties?: {
    private?: {
      shift_uuid: string;
      user_id: string;
      user_email: string;
      shift_time: string;
    };
  };
}

export interface UserDisplayInfo {
  nickname?: string;
  real_name?: string;
  email: string;
}
