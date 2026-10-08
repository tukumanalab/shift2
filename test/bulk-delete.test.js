/**
 * 複数選択削除機能のテスト
 * createBulkActionBarHTML、updateBulkActionBarCount、UUID抽出ロジック、
 * および削除フローの動作を検証する
 */

const { collectUuidsByType } = require('../js/modules/shifts.js');

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
    // 実コード（js/modules/shifts.js の collectUuidsByType）を直接 import して検証する。
    // カレンダー / 自分のシフト / 全シフト一覧の一括削除はすべてこの関数で UUID を取り出す。
    function checkbox(uuids, type = null) {
      const attrs = { 'data-uuids': uuids, 'data-type': type };
      return { getAttribute: (name) => (name in attrs ? attrs[name] : null) };
    }

    describe('カレンダー: data-uuids (カンマ区切り)', () => {
      test('複数チェックボックスの UUID を正しく抽出・フラット化すること', () => {
        const boxes = [checkbox('uuid-a1,uuid-a2'), checkbox('uuid-b1')];
        expect(collectUuidsByType(boxes).regularUuids).toEqual(['uuid-a1', 'uuid-a2', 'uuid-b1']);
      });

      test('空文字列の UUID を除外すること', () => {
        const boxes = [checkbox('uuid-1,,uuid-2')];
        expect(collectUuidsByType(boxes).regularUuids).toEqual(['uuid-1', 'uuid-2']);
      });

      test('data-uuids が null のチェックボックスを無視すること', () => {
        const boxes = [checkbox(null), checkbox('uuid-ok')];
        expect(collectUuidsByType(boxes).regularUuids).toEqual(['uuid-ok']);
      });

      test('チェックボックスが空のとき空配列を返すこと', () => {
        expect(collectUuidsByType([])).toEqual({ regularUuids: [], specialUuids: [] });
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

    describe('全シフト一覧: data-uuids (単一) + data-type', () => {
      test('各チェックボックスの data-uuids を配列として抽出すること', () => {
        const boxes = [checkbox('uuid-x', 'regular'), checkbox('uuid-y', 'regular')];
        expect(collectUuidsByType(boxes).regularUuids).toEqual(['uuid-x', 'uuid-y']);
      });

      test('特別シフト申請の行は specialUuids に振り分けること', () => {
        const boxes = [checkbox('uuid-x', 'regular'), checkbox('uuid-s', 'special')];
        expect(collectUuidsByType(boxes)).toEqual({
          regularUuids: ['uuid-x'],
          specialUuids: ['uuid-s'],
        });
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
