import ical from 'ical-generator';
import { ShiftModel, Shift } from '../models/Shift';
import { SpecialShiftModel } from '../models/SpecialShift';
import { groupAndMergeShifts } from '../utils/timeSlotMerger';
import { MergedTimeSlot } from '../types/calendar';

const TIMEZONE = process.env.TIMEZONE || 'Asia/Tokyo';
const APP_DOMAIN = process.env.APP_DOMAIN || 'shift2.example.com';

function toJSTDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+09:00`);
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

    for (const shift of SpecialShiftModel.getAll()) {
      const start = toJSTDate(shift.date, shift.start_time);
      const end = toJSTDate(shift.date, shift.end_time);
      const evt = cal.createEvent({ start, end, summary: `特別シフト: ${shift.user_name}`, timezone: TIMEZONE });
      evt.uid(`special-${shift.uuid}@${APP_DOMAIN}`);
      evt.description(`担当: ${shift.user_name}\n時間: ${shift.start_time}-${shift.end_time}`);
    }

    return cal.toString();
  }

  /**
   * 特定ユーザーのシフト（通常 + 特別）を iCal 形式で生成
   * 同一ユーザーの連続するシフトはひとつのイベントにまとめる
   */
  static generateForUser(userId: string): string {
    const cal = ical({ name: 'シフト管理', timezone: TIMEZONE });

    addMergedShiftEvents(cal, ShiftModel.getByUserId(userId));

    for (const shift of SpecialShiftModel.getAll().filter(s => s.user_id === userId)) {
      const start = toJSTDate(shift.date, shift.start_time);
      const end = toJSTDate(shift.date, shift.end_time);
      const evt = cal.createEvent({ start, end, summary: `特別シフト: ${shift.user_name}`, timezone: TIMEZONE });
      evt.uid(`special-${shift.uuid}@${APP_DOMAIN}`);
      evt.description(`担当: ${shift.user_name}\n時間: ${shift.start_time}-${shift.end_time}`);
    }

    return cal.toString();
  }
}
