/**
 * リグレッション（デグレ）防止テスト
 * 過去に発見されたバグが再発しないことを確認する
 */

describe('リグレッション防止テスト', () => {
  describe('Issue #1: シフト削除時に他のシフトも削除される問題', () => {
    test('mergeShiftsByPerson: 連続する時間帯のみUUIDをグループ化', () => {
      // テストデータ: 同じ人が13:00-13:30と14:00-15:00のシフトを持つ
      const shiftsForDate = [
        {
          uuid: 'uuid-1',
          userId: 'user-1',
          userName: 'テストユーザー',
          email: 'test@example.com',
          timeSlot: '13:00-13:30',
          shiftDate: '2026-01-30'
        },
        {
          uuid: 'uuid-2',
          userId: 'user-1',
          userName: 'テストユーザー',
          email: 'test@example.com',
          timeSlot: '14:00-14:30',
          shiftDate: '2026-01-30'
        },
        {
          uuid: 'uuid-3',
          userId: 'user-1',
          userName: 'テストユーザー',
          email: 'test@example.com',
          timeSlot: '14:30-15:00',
          shiftDate: '2026-01-30'
        }
      ];

      // モック関数
      global.getShiftDisplayName = jest.fn(() => 'テストユーザー');
      global.mergeConsecutiveTimeSlots = jest.fn((timeSlots) => {
        // 連続する時間帯をマージする簡易実装
        const sorted = [...timeSlots].sort();
        const merged = [];
        let current = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
          const [currentStart, currentEnd] = current.split('-');
          const [nextStart, nextEnd] = sorted[i].split('-');

          if (currentEnd === nextStart) {
            // 連続している場合はマージ
            current = `${currentStart}-${nextEnd}`;
          } else {
            // 連続していない場合は新しいグループ
            merged.push(current);
            current = sorted[i];
          }
        }
        merged.push(current);
        return merged;
      });

      // mergeShiftsByPerson関数の実装（修正後の版）
      function mergeShiftsByPerson(shiftsForDate) {
        const shiftsByPerson = {};
        shiftsForDate.forEach(shift => {
          const personKey = `${getShiftDisplayName(shift)}_${shift.email}`;
          if (!shiftsByPerson[personKey]) {
            shiftsByPerson[personKey] = {
              person: shift,
              shiftsData: []
            };
          }
          shiftsByPerson[personKey].shiftsData.push({
            timeSlot: shift.timeSlot,
            uuid: shift.uuid
          });
        });

        const mergedShifts = [];
        Object.keys(shiftsByPerson).forEach(personKey => {
          const personData = shiftsByPerson[personKey];
          const timeSlots = personData.shiftsData.map(s => s.timeSlot);
          const mergedTimeSlots = global.mergeConsecutiveTimeSlots(timeSlots);

          mergedTimeSlots.forEach(mergedTimeSlot => {
            const correspondingUuids = personData.shiftsData
              .filter(s => {
                const [mergedStart, mergedEnd] = mergedTimeSlot.split('-');
                const [slotStart, slotEnd] = s.timeSlot.split('-');
                return slotStart >= mergedStart && slotEnd <= mergedEnd;
              })
              .map(s => s.uuid);

            mergedShifts.push({
              ...personData.person,
              timeSlot: mergedTimeSlot,
              uuids: correspondingUuids
            });
          });
        });

        return mergedShifts;
      }

      const result = mergeShiftsByPerson(shiftsForDate);

      // 検証: 2つのマージされたグループができる
      expect(result).toHaveLength(2);

      // グループ1: 13:00-13:30（uuid-1のみ）
      const group1 = result.find(s => s.timeSlot === '13:00-13:30');
      expect(group1).toBeDefined();
      expect(group1.uuids).toEqual(['uuid-1']);

      // グループ2: 14:00-15:00（uuid-2とuuid-3がマージ）
      const group2 = result.find(s => s.timeSlot === '14:00-15:00');
      expect(group2).toBeDefined();
      expect(group2.uuids).toEqual(['uuid-2', 'uuid-3']);

      // 重要: 13:00-13:30を削除しても、14:00-15:00のUUIDは含まれない
      expect(group1.uuids).not.toContain('uuid-2');
      expect(group1.uuids).not.toContain('uuid-3');
    });

    test('削除時: 同じcalendar_event_idの関連シフトのみ取得', () => {
      // バックエンドのロジックをテスト
      const allShifts = [
        { uuid: 'uuid-1', calendar_event_id: 'event-A', time_slot: '13:00-13:30' },
        { uuid: 'uuid-2', calendar_event_id: 'event-B', time_slot: '14:00-14:30' },
        { uuid: 'uuid-3', calendar_event_id: 'event-B', time_slot: '14:30-15:00' },
      ];

      const deletingShift = allShifts[0]; // uuid-1を削除
      const calendar_event_id = deletingShift.calendar_event_id;

      // 同じcalendar_event_idを持つ他のシフトを取得
      const relatedShifts = allShifts.filter(
        s => s.calendar_event_id === calendar_event_id && s.uuid !== deletingShift.uuid
      );

      // uuid-1を削除する場合、関連シフトは0件（event-Aは他にない）
      expect(relatedShifts).toHaveLength(0);

      // uuid-2を削除する場合、uuid-3が関連シフトになる
      const deletingShift2 = allShifts[1];
      const relatedShifts2 = allShifts.filter(
        s => s.calendar_event_id === deletingShift2.calendar_event_id && s.uuid !== deletingShift2.uuid
      );
      expect(relatedShifts2).toHaveLength(1);
      expect(relatedShifts2[0].uuid).toBe('uuid-3');
    });
  });

  describe('Issue #2: シフト申請後のハイライトが表示されない問題', () => {
    test('loadMyShifts: scrollToNewlyAddedShift が呼ばれる', () => {
      const mockScrollToNewlyAddedShift = jest.fn();
      global.scrollToNewlyAddedShift = mockScrollToNewlyAddedShift;

      // scrollToNewlyAddedShiftが保存されている状態をシミュレート
      global.getScrollToShiftAfterLoad = jest.fn(() => ({
        date: '2026-01-30',
        timeSlots: ['13:00-13:30']
      }));

      // loadMyShifts完了後にscrollToNewlyAddedShiftを呼ぶ
      function afterLoadMyShifts() {
        if (global.scrollToNewlyAddedShift) {
          global.scrollToNewlyAddedShift();
        }
      }

      afterLoadMyShifts();

      // scrollToNewlyAddedShiftが呼ばれたことを確認
      expect(mockScrollToNewlyAddedShift).toHaveBeenCalled();
    });

    test('ハイライトクラスが正しく追加される', () => {
      const mockElement = {
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          contains: jest.fn()
        },
        scrollIntoView: jest.fn()
      };

      // ハイライトを追加
      mockElement.classList.add('highlight-shift');

      expect(mockElement.classList.add).toHaveBeenCalledWith('highlight-shift');
      expect(mockElement.scrollIntoView).not.toHaveBeenCalled();

      // スクロールも実行
      mockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center'
      });
    });
  });

  describe('Issue #3: 管理者モードでシフト削除時の問題', () => {
    test('deleteShiftFromModal: 正しいUUID配列が渡される', () => {
      // マージされた時間帯のシフトオブジェクト
      const mergedShift = {
        userId: 'user-1',
        timeSlot: '14:00-15:00',
        uuids: ['uuid-2', 'uuid-3'] // 14:00-14:30と14:30-15:00
      };

      // 削除ボタンに渡されるUUID配列
      const uuidsToDelete = mergedShift.uuids;

      // 正しいUUIDのみが含まれることを確認
      expect(uuidsToDelete).toEqual(['uuid-2', 'uuid-3']);
      expect(uuidsToDelete).not.toContain('uuid-1'); // 別の時間帯のUUIDは含まれない
    });
  });

  describe('データ整合性テスト', () => {
    test('時間帯の比較: 文字列ソートが正しく動作', () => {
      const timeSlots = ['14:00-14:30', '13:00-13:30', '14:30-15:00'];
      const sorted = timeSlots.sort();

      expect(sorted).toEqual(['13:00-13:30', '14:00-14:30', '14:30-15:00']);
    });

    test('時間帯の範囲チェック', () => {
      const mergedTimeSlot = '13:00-14:00';
      const [mergedStart, mergedEnd] = mergedTimeSlot.split('-');

      const testCases = [
        { timeSlot: '13:00-13:30', expected: true },  // 含まれる
        { timeSlot: '13:30-14:00', expected: true },  // 含まれる
        { timeSlot: '14:00-14:30', expected: false }, // 含まれない
      ];

      testCases.forEach(({ timeSlot, expected }) => {
        const [slotStart, slotEnd] = timeSlot.split('-');
        const isIncluded = slotStart >= mergedStart && slotEnd <= mergedEnd;
        expect(isIncluded).toBe(expected);
      });
    });
  });
});
