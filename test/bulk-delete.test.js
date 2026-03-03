/**
 * 複数選択削除機能のテスト
 * createBulkActionBarHTML、updateBulkActionBarCount、UUID抽出ロジック、
 * および削除フローの動作を検証する
 */

// ---- インラインロジック定義（モジュール非依存） ----

function createBulkActionBarHTML(barId, countId, btnId) {
  return `<div id="${barId}" class="bulk-delete-action-bar">
        <span id="${countId}">0件選択中</span>
        <button id="${btnId}" class="bulk-delete-btn" disabled>選択したシフトを削除</button>
    </div>`;
}

function updateBulkActionBarCount(countId, count) {
  const countText = document.getElementById(countId);
  if (!countText) return;
  countText.textContent = count > 0 ? `${count}件選択中` : '0件選択中';
  const btn = countText.parentElement.querySelector('.bulk-delete-btn');
  if (btn) btn.disabled = count === 0;
}

// -----------------------------------------------

describe('複数選択削除機能テスト', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    global.confirm = jest.fn(() => true);
    global.alert = jest.fn();
  });

  // ------------------------------------------------------------------
  describe('createBulkActionBarHTML', () => {
    test('barId が HTML に含まれること', () => {
      const html = createBulkActionBarHTML('myBar', 'myCount', 'myBtn');
      expect(html).toContain('id="myBar"');
    });

    test('countId が HTML に含まれること', () => {
      const html = createBulkActionBarHTML('myBar', 'myCount', 'myBtn');
      expect(html).toContain('id="myCount"');
    });

    test('btnId が HTML に含まれること', () => {
      const html = createBulkActionBarHTML('myBar', 'myCount', 'myBtn');
      expect(html).toContain('id="myBtn"');
    });

    test('ボタンに disabled 属性が付いていること', () => {
      const html = createBulkActionBarHTML('myBar', 'myCount', 'myBtn');
      expect(html).toContain('disabled');
    });

    test('初期テキストが「0件選択中」であること', () => {
      const html = createBulkActionBarHTML('myBar', 'myCount', 'myBtn');
      expect(html).toContain('0件選択中');
    });
  });

  // ------------------------------------------------------------------
  describe('updateBulkActionBarCount', () => {
    let mockBtn;
    let mockCountEl;

    beforeEach(() => {
      mockBtn = { disabled: true };
      mockCountEl = {
        textContent: '0件選択中',
        parentElement: {
          querySelector: jest.fn(() => mockBtn),
        },
      };
      global.document.getElementById = jest.fn((id) =>
        id === 'testCount' ? mockCountEl : null
      );
    });

    test('count > 0: テキストが「N件選択中」になること', () => {
      updateBulkActionBarCount('testCount', 3);
      expect(mockCountEl.textContent).toBe('3件選択中');
    });

    test('count > 0: ボタンが有効化されること', () => {
      updateBulkActionBarCount('testCount', 3);
      expect(mockBtn.disabled).toBe(false);
    });

    test('count === 0: テキストが「0件選択中」になること', () => {
      updateBulkActionBarCount('testCount', 0);
      expect(mockCountEl.textContent).toBe('0件選択中');
    });

    test('count === 0: ボタンが無効化されること', () => {
      mockBtn.disabled = false;
      updateBulkActionBarCount('testCount', 0);
      expect(mockBtn.disabled).toBe(true);
    });

    test('対象要素が存在しない場合: エラーなく終了すること', () => {
      expect(() => updateBulkActionBarCount('nonExistent', 5)).not.toThrow();
    });
  });

  // ------------------------------------------------------------------
  describe('UUID抽出ロジック', () => {
    describe('カレンダー: data-uuids (カンマ区切り)', () => {
      // calendar.js: setupCalendarBulkDelete の UUID 抽出ロジック
      function extractCalendarUuids(checkedBoxes) {
        const allUuids = [];
        checkedBoxes.forEach((cb) => {
          const uuidsStr = cb.getAttribute('data-uuids');
          if (uuidsStr)
            uuidsStr.split(',').forEach((uuid) => {
              if (uuid) allUuids.push(uuid);
            });
        });
        return allUuids;
      }

      test('複数チェックボックスの UUID を正しく抽出・フラット化すること', () => {
        const boxes = [
          { getAttribute: () => 'uuid-a1,uuid-a2' },
          { getAttribute: () => 'uuid-b1' },
        ];
        expect(extractCalendarUuids(boxes)).toEqual(['uuid-a1', 'uuid-a2', 'uuid-b1']);
      });

      test('空文字列の UUID を除外すること', () => {
        const boxes = [{ getAttribute: () => 'uuid-1,,uuid-2' }];
        expect(extractCalendarUuids(boxes)).toEqual(['uuid-1', 'uuid-2']);
      });

      test('data-uuids が null のチェックボックスを無視すること', () => {
        const boxes = [
          { getAttribute: () => null },
          { getAttribute: () => 'uuid-ok' },
        ];
        expect(extractCalendarUuids(boxes)).toEqual(['uuid-ok']);
      });

      test('チェックボックスが空のとき空配列を返すこと', () => {
        expect(extractCalendarUuids([])).toEqual([]);
      });
    });

    describe('自分のシフト: disabled 除外', () => {
      // shifts.js: selectAll の change ハンドラで :not(:disabled) を使う
      function getSelectableCheckboxes(allCheckboxes) {
        return allCheckboxes.filter((cb) => !cb.disabled);
      }

      test('disabled なチェックボックスを全選択の対象から除外すること', () => {
        const boxes = [
          { disabled: false, getAttribute: () => 'uuid-1' },
          { disabled: true, getAttribute: () => 'uuid-2' },
          { disabled: false, getAttribute: () => 'uuid-3' },
        ];
        const selectable = getSelectableCheckboxes(boxes);
        expect(selectable).toHaveLength(2);
        expect(selectable.map((cb) => cb.getAttribute())).toEqual(['uuid-1', 'uuid-3']);
      });

      test('全て disabled の場合は空配列を返すこと', () => {
        const boxes = [
          { disabled: true, getAttribute: () => 'uuid-1' },
          { disabled: true, getAttribute: () => 'uuid-2' },
        ];
        expect(getSelectableCheckboxes(boxes)).toHaveLength(0);
      });
    });

    describe('全シフト一覧: data-shift-uuid (単一)', () => {
      // allShiftsTable.js: Array.from(checkedBoxes).map(cb => cb.getAttribute('data-shift-uuid'))
      function extractAllShiftsUuids(checkedBoxes) {
        return Array.from(checkedBoxes).map((cb) => cb.getAttribute('data-shift-uuid'));
      }

      test('各チェックボックスの data-shift-uuid を配列として抽出すること', () => {
        const boxes = [
          { getAttribute: (attr) => (attr === 'data-shift-uuid' ? 'uuid-x' : null) },
          { getAttribute: (attr) => (attr === 'data-shift-uuid' ? 'uuid-y' : null) },
        ];
        expect(extractAllShiftsUuids(boxes)).toEqual(['uuid-x', 'uuid-y']);
      });

      test('チェックボックスが空のとき空配列を返すこと', () => {
        expect(extractAllShiftsUuids([])).toEqual([]);
      });
    });
  });

  // ------------------------------------------------------------------
  describe('削除フロー', () => {
    let mockBtn;
    let mockDeleteMultipleShifts;

    beforeEach(() => {
      mockBtn = { disabled: false, textContent: '選択したシフトを削除' };
      mockDeleteMultipleShifts = jest.fn();
    });

    // 削除フローを再現する共通関数（calendar.js / shifts.js / allShiftsTable.js 共通パターン）
    async function runBulkDeleteFlow(uuids, btn) {
      if (!confirm(`選択した ${uuids.length} 件のシフトを削除しますか？`)) return;

      btn.disabled = true;
      btn.textContent = '削除中...';

      try {
        const result = await mockDeleteMultipleShifts(uuids);
        if (result.success) {
          alert(`${uuids.length}件のシフトを削除しました。`);
        } else {
          alert('シフトの削除に失敗しました: ' + (result.error || '不明なエラー'));
          btn.disabled = false;
          btn.textContent = '選択したシフトを削除';
        }
      } catch (error) {
        alert('シフトの削除に失敗しました');
        btn.disabled = false;
        btn.textContent = '選択したシフトを削除';
      }
    }

    test('確認ダイアログでキャンセル: API が呼ばれないこと', async () => {
      global.confirm.mockReturnValue(false);
      await runBulkDeleteFlow(['uuid-1', 'uuid-2'], mockBtn);
      expect(mockDeleteMultipleShifts).not.toHaveBeenCalled();
    });

    test('API 成功: alert が呼ばれ、ボタンが「削除中...」になること', async () => {
      mockDeleteMultipleShifts.mockResolvedValue({ success: true });
      await runBulkDeleteFlow(['uuid-1', 'uuid-2'], mockBtn);
      expect(mockBtn.textContent).toBe('削除中...');
      expect(global.alert).toHaveBeenCalledWith('2件のシフトを削除しました。');
    });

    test('API 失敗: エラーメッセージ付き alert が呼ばれ、ボタンが再有効化されること', async () => {
      mockDeleteMultipleShifts.mockResolvedValue({ success: false, error: 'DB error' });
      await runBulkDeleteFlow(['uuid-1'], mockBtn);
      expect(global.alert).toHaveBeenCalledWith('シフトの削除に失敗しました: DB error');
      expect(mockBtn.disabled).toBe(false);
      expect(mockBtn.textContent).toBe('選択したシフトを削除');
    });

    test('ネットワークエラー: alert が呼ばれ、ボタンが再有効化されること', async () => {
      mockDeleteMultipleShifts.mockRejectedValue(new Error('Network error'));
      await runBulkDeleteFlow(['uuid-1'], mockBtn);
      expect(global.alert).toHaveBeenCalledWith('シフトの削除に失敗しました');
      expect(mockBtn.disabled).toBe(false);
      expect(mockBtn.textContent).toBe('選択したシフトを削除');
    });
  });
});
