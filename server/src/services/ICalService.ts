import ical from 'ical-generator';
import { ShiftModel, Shift } from '../models/Shift';
import { SpecialShiftApplicationModel, SpecialShiftApplicationWithDate } from '../models/SpecialShiftApplication';
import { groupAndMergeShifts } from '../utils/timeSlotMerger';
import { MergedTimeSlot } from '../types/calendar';

const TIMEZONE = process.env.TIMEZONE || 'Asia/Tokyo';
const APP_DOMAIN = process.env.APP_DOMAIN || 'shift2.example.com';

function toJSTDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+09:00`);
}

type ICalEvent = ReturnType<ReturnType<typeof ical>['createEvent']>;

function addAttendeeIfPresent(evt: ICalEvent, slot: MergedTimeSlot): void {
  if (slot.email) {
    evt.createAttendee({ email: slot.email });
  }
}

function addMergedShiftEvents(cal: ReturnType<typeof ical>, shifts: Shift[]): void {
  const shiftInfos = shifts.map(s => ({ ...s, type: 'shift' as const }));
  const merged: MergedTimeSlot[] = groupAndMergeShifts(shiftInfos);

  for (const slot of merged) {
    const start = toJSTDate(slot.date, slot.start_time);
    const end = toJSTDate(slot.date, slot.end_time);
    // UID はユーザー・日付・開始時刻から生成（マージ結果が同じなら安定）
    const uid = `shift-${slot.user_id}-${slot.date}-${slot.start_time}@${APP_DOMAIN}`;
    const evt = cal.createEvent({ start, end, summary: `シフト: ${slot.user_name}`, timezone: TIMEZONE });
    evt.uid(uid);
    evt.description(`担当: ${slot.user_name}\n時間: ${slot.start_time}-${slot.end_time}`);
    addAttendeeIfPresent(evt, slot);
  }
}

function addMergedSpecialShiftApplicationEvents(
  cal: ReturnType<typeof ical>,
  apps: SpecialShiftApplicationWithDate[]
): void {
  const shiftNameByUuid = new Map(apps.map(a => [a.uuid, a.shift_name]));

  const shiftInfos = apps.map(a => ({
    uuid: a.uuid,
    user_id: a.user_id,
    user_name: a.user_name,
    email: a.email,
    date: a.date,
    time_slot: a.time_slot,
    type: 'shift' as const,
  }));
  const merged: MergedTimeSlot[] = groupAndMergeShifts(shiftInfos);

  for (const slot of merged) {
    const shiftName = slot.shift_uuids.map(uuid => shiftNameByUuid.get(uuid)).find(n => n) || null;
    const start = toJSTDate(slot.date, slot.start_time);
    const end = toJSTDate(slot.date, slot.end_time);
    const uid = `special-app-${slot.user_id}-${slot.date}-${slot.start_time}@${APP_DOMAIN}`;
    const summary = shiftName ? `${shiftName}: ${slot.user_name}` : `特別シフト: ${slot.user_name}`;
    const evt = cal.createEvent({ start, end, summary, timezone: TIMEZONE });
    evt.uid(uid);
    evt.description(`担当: ${slot.user_name}\n時間: ${slot.start_time}-${slot.end_time}`);
    addAttendeeIfPresent(evt, slot);
  }
}

export class ICalService {
  /**
   * 全ユーザーの全シフト（通常 + 特別）を iCal 形式で生成
   * 同一ユーザーの連続するシフトはひとつのイベントにまとめる
   */
  static generateAll(): string {
    const cal = ical({ name: 'シフト管理', timezone: TIMEZONE });

    addMergedShiftEvents(cal, ShiftModel.getAll());
    addMergedSpecialShiftApplicationEvents(cal, SpecialShiftApplicationModel.getAllWithShiftInfo(undefined));

    return cal.toString();
  }

  /**
   * 特定ユーザーのシフト（通常 + 特別）を iCal 形式で生成
   * 同一ユーザーの連続するシフトはひとつのイベントにまとめる
   */
  static generateForUser(userId: string): string {
    const cal = ical({ name: 'シフト管理', timezone: TIMEZONE });

    addMergedShiftEvents(cal, ShiftModel.getByUserId(userId));
    addMergedSpecialShiftApplicationEvents(cal, SpecialShiftApplicationModel.getAllWithShiftInfo(userId));

    return cal.toString();
  }
}
