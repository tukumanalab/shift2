import { ShiftInfo, MergedTimeSlot } from '../types/calendar';

/**
 * 連続する時間帯をマージする関数
 * 例: ["13:00-13:30", "13:30-14:00"] → ["13:00-14:00"]
 */
export function mergeConsecutiveTimeSlots(timeSlots: string[]): string[] {
  if (timeSlots.length === 0) return [];

  // 時間帯を開始時刻でソート
  const sorted = timeSlots.sort((a, b) => {
    const timeA = a.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
    const timeB = b.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
    return parseInt(timeA) - parseInt(timeB);
  });

  const merged: string[] = [];
  let currentStart = sorted[0].split('-')[0];
  let currentEnd = sorted[0].split('-')[1];

  for (let i = 1; i < sorted.length; i++) {
    const [nextStart, nextEnd] = sorted[i].split('-');

    // 現在の終了時刻と次の開始時刻が一致すれば連続
    if (currentEnd === nextStart) {
      currentEnd = nextEnd;
    } else {
      // 連続していない場合は現在の範囲を保存して新しい範囲を開始
      merged.push(`${currentStart}-${currentEnd}`);
      currentStart = nextStart;
      currentEnd = nextEnd;
    }
  }

  // 最後の範囲を追加
  merged.push(`${currentStart}-${currentEnd}`);

  return merged;
}

/**
 * シフト情報をユーザー・日付でグループ化し、連続する時間帯をマージする
 */
export function groupAndMergeShifts(shifts: ShiftInfo[]): MergedTimeSlot[] {
  // ユーザーID + 日付でグループ化
  const groupedMap = new Map<string, ShiftInfo[]>();

  for (const shift of shifts) {
    const key = `${shift.user_id}-${shift.date}`;
    if (!groupedMap.has(key)) {
      groupedMap.set(key, []);
    }
    groupedMap.get(key)!.push(shift);
  }

  const mergedSlots: MergedTimeSlot[] = [];

  // 各グループで時間帯をマージ
  for (const [key, groupShifts] of groupedMap.entries()) {
    const timeSlots = groupShifts.map(s => s.time_slot);
    const mergedTimes = mergeConsecutiveTimeSlots(timeSlots);

    // マージされた時間帯ごとにMergedTimeSlotを作成
    for (const timeRange of mergedTimes) {
      const [start_time, end_time] = timeRange.split('-');

      // この時間範囲に含まれるシフトのUUIDを収集
      const shift_uuids = groupShifts
        .filter(s => {
          const [sStart, sEnd] = s.time_slot.split('-');
          return sStart >= start_time && sEnd <= end_time;
        })
        .map(s => s.uuid);

      mergedSlots.push({
        user_id: groupShifts[0].user_id,
        user_name: groupShifts[0].user_name,
        date: groupShifts[0].date,
        start_time,
        end_time,
        shift_uuids,
        type: groupShifts[0].type,
      });
    }
  }

  return mergedSlots;
}
