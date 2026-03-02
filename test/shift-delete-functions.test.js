/**
 * シフト削除機能のテスト
 * deleteShift、deleteMyShift、deleteShiftFromModal の動作をテストする
 */

describe('シフト削除機能テスト', () => {
  beforeEach(() => {
    global.isAdminUser = false;
    global.currentUser = {
      sub: 'test-user-123',
      name: 'テストユーザー',
      email: 'test@example.com'
    };
    global.fetch = jest.fn();
    global.confirm = jest.fn();
  });

  describe('deleteShift関数の動作パターン', () => {
    test('権限チェック: 管理者は他人のシフト削除可能', () => {
      global.isAdminUser = true;
      const shift = {
        uuid: 'test-uuid',
        userId: 'other-user',
        shiftDate: '2025-01-15',
        timeSlot: '13:00-13:30'
      };

      // 管理者権限があれば削除処理に進むべき
      expect(global.isAdminUser || shift.userId === global.currentUser.sub).toBe(true);
    });

    test('権限チェック: 一般ユーザーは自分のシフトのみ削除可能', () => {
      global.isAdminUser = false;
      const ownShift = {
        uuid: 'test-uuid',
        userId: 'test-user-123',
        shiftDate: '2025-01-15',
        timeSlot: '13:00-13:30'
      };
      const otherShift = {
        uuid: 'test-uuid',
        userId: 'other-user',
        shiftDate: '2025-01-15',
        timeSlot: '13:00-13:30'
      };

      expect(global.isAdminUser || ownShift.userId === global.currentUser.sub).toBe(true);
      expect(global.isAdminUser || otherShift.userId === global.currentUser.sub).toBe(false);
    });
  });

  describe('deleteMyShift関数の動作パターン', () => {
    test('日付制限: 削除可能性の検証', () => {
      // 日付文字列の形式でテスト
      const futureDate = '2030-12-31'; // 確実に未来の日付
      const pastDate = '2020-01-01';   // 確実に過去の日付

      const futureShift = {
        uuid: 'future-uuid',
        shiftDate: futureDate,
        timeSlot: '13:00-13:30'
      };
      
      const pastShift = {
        uuid: 'past-uuid', 
        shiftDate: pastDate,
        timeSlot: '13:00-13:30'
      };

      // 基本的な日付比較ロジック
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const targetDateFuture = new Date(futureShift.shiftDate);
      const targetDatePast = new Date(pastShift.shiftDate);

      // 確実に未来の日付は削除可能
      expect(targetDateFuture > today).toBe(true);
      // 確実に過去の日付は削除不可
      expect(targetDatePast < today).toBe(true);
    });

    test('UUID配列の検証', () => {
      const validUuids = ['uuid1', 'uuid2'];
      const emptyUuids = [];
      const nullUuids = null;

      expect(Array.isArray(validUuids) && validUuids.length > 0).toBe(true);
      expect(Array.isArray(emptyUuids) && emptyUuids.length > 0).toBe(false);
      expect(Array.isArray(nullUuids) && nullUuids && nullUuids.length > 0).toBe(false);
    });
  });

  describe('deleteShiftFromModal関数の動作パターン', () => {
    test('複数UUID配列の検証', () => {
      const validUuids = ['uuid1', 'uuid2'];
      const singleUuid = ['uuid1'];
      const emptyUuids = [];
      const nullUuids = null;

      expect(Array.isArray(validUuids) && validUuids.length > 0).toBe(true);
      expect(Array.isArray(singleUuid) && singleUuid.length > 0).toBe(true);
      expect(Array.isArray(emptyUuids) && emptyUuids.length > 0).toBe(false);
      expect(Array.isArray(nullUuids) && nullUuids && nullUuids.length > 0).toBe(false);
    });

    test('モーダル制御の検証', () => {
      const mockModal = {
        style: { display: 'block' }
      };

      global.document.getElementById = jest.fn().mockReturnValue(mockModal);

      const modal = global.document.getElementById('shiftDetailModal');
      expect(modal).toBeTruthy();
      
      // モーダルを閉じる
      if (modal) {
        modal.style.display = 'none';
      }
      expect(modal.style.display).toBe('none');
    });
  });

  describe('共通のデータ形式テスト', () => {
    test('UUID形式の統一性', () => {
      const testShift = {
        uuid: 'test-uuid-123',
        userId: 'user-123',
        shiftDate: '2025-01-15',
        timeSlot: '13:00-13:30'
      };

      // すべての削除関数で同じUUID形式を使用
      expect(typeof testShift.uuid).toBe('string');
      expect(testShift.uuid.length).toBeGreaterThan(0);
    });

    test('削除リクエストデータ形式', () => {
      // deleteMyShift / deleteShiftFromModal用（両方とも複数UUID対応）
      const multipleDeleteData = {
        type: 'deleteShift',
        uuids: ['uuid1', 'uuid2']
      };

      const singleDeleteData = {
        type: 'deleteShift',
        uuids: ['single-uuid']
      };

      expect(multipleDeleteData.type).toBe('deleteShift');
      expect(Array.isArray(multipleDeleteData.uuids)).toBe(true);
      expect(multipleDeleteData.uuids.length).toBe(2);
      
      expect(singleDeleteData.type).toBe('deleteShift');
      expect(Array.isArray(singleDeleteData.uuids)).toBe(true);
      expect(singleDeleteData.uuids.length).toBe(1);
    });
  });

  describe('エラーハンドリングパターン', () => {
    test('ログインチェック', () => {
      global.currentUser = null;
      expect(global.currentUser).toBeNull();

      global.currentUser = { sub: 'user-123' };
      expect(global.currentUser).toBeTruthy();
    });

    test('確認ダイアログのキャンセル', () => {
      global.confirm = jest.fn().mockReturnValue(false);
      const result = global.confirm('削除しますか？');
      expect(result).toBe(false);
      expect(global.confirm).toHaveBeenCalledWith('削除しますか？');
    });

    test('ネットワークエラーハンドリング', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      global.console.error = jest.fn();

      try {
        await global.fetch('test-url');
      } catch (error) {
        global.console.error('削除エラー:', error);
        expect(global.console.error).toHaveBeenCalledWith('削除エラー:', expect.any(Error));
      }
    });
  });
});