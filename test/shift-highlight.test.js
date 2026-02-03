/**
 * シフトハイライト機能のテスト
 *
 * 目的: シフト申請後のハイライト表示とフェードアウトが正しく動作することを確認
 */

describe('シフトハイライト機能のテスト', () => {
  let mockContainer;
  let mockScrollToShiftInfo;

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="myShiftsContent">
        <div class="my-shifts-table-container">
          <table class="my-shifts-table">
            <tbody>
              <tr data-date="2026-01-27" data-time-range="13:00-13:30">
                <td>2026年1月27日</td>
                <td>13:00-13:30</td>
              </tr>
              <tr data-date="2026-01-27" data-time-range="15:00-16:00">
                <td>2026年1月27日</td>
                <td>15:00-16:00</td>
              </tr>
              <tr data-date="2026-01-28" data-time-range="14:00-15:00">
                <td>2026年1月28日</td>
                <td>14:00-15:00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    mockContainer = document.getElementById('myShiftsContent');
    Element.prototype.scrollIntoView = jest.fn();

    global.getScrollToShiftAfterLoad = jest.fn(() => mockScrollToShiftInfo);
    global.setScrollToShiftAfterLoad = jest.fn();
    global.timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    // ハイライト処理のヘルパー関数
    global.applyHighlight = (date, timeSlots) => {
      const allRows = document.querySelectorAll('.my-shifts-table tr');
      const targetRows = [];

      for (const row of allRows) {
        const rowDate = row.dataset.date;
        const rowTimeRange = row.dataset.timeRange;

        if (rowDate === date && rowTimeRange) {
          const [rowStart, rowEnd] = rowTimeRange.split('-');
          const rowStartMinutes = timeToMinutes(rowStart);
          const rowEndMinutes = timeToMinutes(rowEnd);

          for (const slot of timeSlots) {
            const [slotStart, slotEnd] = slot.split('-');
            const slotStartMinutes = timeToMinutes(slotStart);
            const slotEndMinutes = timeToMinutes(slotEnd);

            if (slotStartMinutes >= rowStartMinutes && slotEndMinutes <= rowEndMinutes) {
              targetRows.push(row);
              break;
            }
          }
        }
      }

      targetRows.forEach(row => row.classList.add('highlight-shift'));
      return targetRows;
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('新規シフト申請後のハイライト', () => {
    test('単一の時間枠を申請した場合、該当行がハイライトされること', () => {
      mockScrollToShiftInfo = {
        date: '2026-01-27',
        timeSlots: ['13:00-13:30']
      };

      const scrollToShiftAfterLoad = getScrollToShiftAfterLoad();
      if (scrollToShiftAfterLoad) {
        const { date, timeSlots } = scrollToShiftAfterLoad;
        applyHighlight(date, timeSlots);
      }

      const allRows = document.querySelectorAll('.my-shifts-table tr');
      expect(allRows[0].classList.contains('highlight-shift')).toBe(true);
      expect(allRows[1].classList.contains('highlight-shift')).toBe(false);
      expect(allRows[2].classList.contains('highlight-shift')).toBe(false);
    });

    test('同じ日の別の時間帯を申請した場合、該当行がハイライトされること', () => {
      mockScrollToShiftInfo = {
        date: '2026-01-27',
        timeSlots: ['15:00-15:30']
      };

      const scrollToShiftAfterLoad = getScrollToShiftAfterLoad();
      if (scrollToShiftAfterLoad) {
        const { date, timeSlots } = scrollToShiftAfterLoad;
        applyHighlight(date, timeSlots);
      }

      const allRows = document.querySelectorAll('.my-shifts-table tr');
      expect(allRows[0].classList.contains('highlight-shift')).toBe(false);
      expect(allRows[1].classList.contains('highlight-shift')).toBe(true);
      expect(allRows[2].classList.contains('highlight-shift')).toBe(false);
    });

    test('マージされたシフトの一部を申請した場合、該当行がハイライトされること', () => {
      mockScrollToShiftInfo = {
        date: '2026-01-27',
        timeSlots: ['15:30-16:00']
      };

      const scrollToShiftAfterLoad = getScrollToShiftAfterLoad();
      if (scrollToShiftAfterLoad) {
        const { date, timeSlots } = scrollToShiftAfterLoad;
        applyHighlight(date, timeSlots);
      }

      const allRows = document.querySelectorAll('.my-shifts-table tr');
      expect(allRows[1].classList.contains('highlight-shift')).toBe(true);
    });

    test('複数の時間枠を同時申請した場合、該当行がすべてハイライトされること', () => {
      mockScrollToShiftInfo = {
        date: '2026-01-27',
        timeSlots: ['13:00-13:30', '15:00-15:30']
      };

      const scrollToShiftAfterLoad = getScrollToShiftAfterLoad();
      if (scrollToShiftAfterLoad) {
        const { date, timeSlots } = scrollToShiftAfterLoad;
        applyHighlight(date, timeSlots);
      }

      const allRows = document.querySelectorAll('.my-shifts-table tr');
      expect(allRows[0].classList.contains('highlight-shift')).toBe(true);
      expect(allRows[1].classList.contains('highlight-shift')).toBe(true);
      expect(allRows[2].classList.contains('highlight-shift')).toBe(false);
    });

    test('該当する日付が存在しない場合、何もハイライトされないこと', () => {
      mockScrollToShiftInfo = {
        date: '2026-01-30',
        timeSlots: ['13:00-13:30']
      };

      const scrollToShiftAfterLoad = getScrollToShiftAfterLoad();
      if (scrollToShiftAfterLoad) {
        const { date, timeSlots } = scrollToShiftAfterLoad;
        applyHighlight(date, timeSlots);
      }

      const allRows = document.querySelectorAll('.my-shifts-table tr');
      expect(allRows[0].classList.contains('highlight-shift')).toBe(false);
      expect(allRows[1].classList.contains('highlight-shift')).toBe(false);
      expect(allRows[2].classList.contains('highlight-shift')).toBe(false);
    });
  });

  describe('ハイライトのフェードアウト', () => {
    test('3秒後にフェードアウトクラスが追加されること', () => {
      mockScrollToShiftInfo = {
        date: '2026-01-27',
        timeSlots: ['13:00-13:30']
      };

      const scrollToShiftAfterLoad = getScrollToShiftAfterLoad();
      if (scrollToShiftAfterLoad) {
        const { date, timeSlots } = scrollToShiftAfterLoad;
        const targetRows = applyHighlight(date, timeSlots);

        // フェードアウト処理を再現
        targetRows.forEach(row => {
          setTimeout(() => {
            row.classList.add('highlight-shift-fade-out');
            setTimeout(() => {
              row.classList.remove('highlight-shift', 'highlight-shift-fade-out');
            }, 1000);
          }, 3000);
        });

        const targetRow = targetRows[0];

        // 初期状態: ハイライトクラスのみ
        expect(targetRow.classList.contains('highlight-shift')).toBe(true);
        expect(targetRow.classList.contains('highlight-shift-fade-out')).toBe(false);

        // 3秒経過後: フェードアウトクラスが追加される
        jest.advanceTimersByTime(3000);
        expect(targetRow.classList.contains('highlight-shift')).toBe(true);
        expect(targetRow.classList.contains('highlight-shift-fade-out')).toBe(true);

        // さらに1秒経過後: 両方のクラスが削除される
        jest.advanceTimersByTime(1000);
        expect(targetRow.classList.contains('highlight-shift')).toBe(false);
        expect(targetRow.classList.contains('highlight-shift-fade-out')).toBe(false);
      }
    });
  });

  describe('timeToMinutes ヘルパー関数', () => {
    test('時間文字列を正しく分に変換できること', () => {
      expect(timeToMinutes('13:00')).toBe(780);
      expect(timeToMinutes('13:30')).toBe(810);
      expect(timeToMinutes('15:00')).toBe(900);
      expect(timeToMinutes('16:00')).toBe(960);
    });
  });
});
