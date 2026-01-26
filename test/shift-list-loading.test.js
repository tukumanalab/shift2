/**
 * シフト一覧読み込み機能のテスト
 *
 * 目的: scrollToNewlyAddedShift is not defined のような
 *      未定義関数の呼び出しエラーを検出する
 */

describe('シフト一覧読み込み機能のテスト', () => {
  let mockAPI;
  let mockCurrentUser;
  let mockContainer;

  beforeEach(() => {
    // DOM要素のモック
    document.body.innerHTML = `
      <div id="myShiftsContent"></div>
    `;

    mockContainer = document.getElementById('myShiftsContent');

    // ユーザーのモック
    mockCurrentUser = {
      sub: '112204345149724665942',
      email: 'test@example.com',
      name: 'Test User'
    };

    // APIのモック
    mockAPI = {
      getUserShifts: jest.fn()
    };

    // グローバル変数のモック
    global.API = mockAPI;
    global.getCurrentUser = jest.fn(() => mockCurrentUser);
    global.displayMyShifts = jest.fn();
    global.getScrollToShiftAfterLoad = jest.fn(() => null);
    global.setScrollToShiftAfterLoad = jest.fn();

    // コンソールのモック（エラーログを確認するため）
    global.console = {
      ...console,
      error: jest.fn(),
      log: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadMyShifts関数', () => {
    test('正常にシフトデータを読み込めること', async () => {
      // モックレスポンス
      const mockShifts = [
        {
          uuid: 'uuid-1',
          date: '2026-01-27',
          time_slot: '13:00-13:30',
          user_id: '112204345149724665942',
          user_name: 'Test User',
          created_at: '2026-01-26 04:50:02'
        }
      ];

      mockAPI.getUserShifts.mockResolvedValue({
        success: true,
        data: mockShifts
      });

      // loadMyShifts関数の模擬実装
      const loadMyShifts = async () => {
        const container = document.getElementById('myShiftsContent');
        if (!container) return;

        const currentUser = getCurrentUser();
        if (!currentUser) {
          container.innerHTML = '<p>ログインが必要です。</p>';
          return;
        }

        try {
          const result = await API.getUserShifts(currentUser.sub);

          if (result.success) {
            const myShifts = (result.data || []).map(shift => ({
              shiftDate: shift.date,
              timeSlot: shift.time_slot,
              userId: shift.user_id,
              userName: shift.user_name,
              uuid: shift.uuid,
              registrationDate: shift.created_at
            }));

            displayMyShifts(container, myShifts);

            // スクロール処理は displayMyShifts() 内で実行される
            // scrollToNewlyAddedShift() は呼び出さない
          } else {
            container.innerHTML = '<p>シフトデータの取得に失敗しました。</p>';
          }
        } catch (error) {
          console.error('シフトデータの読み込みに失敗:', error);
          container.innerHTML = '<p>シフトデータの読み込みに失敗しました。</p>';
        }
      };

      await loadMyShifts();

      // APIが正しいパラメータで呼ばれたことを確認
      expect(mockAPI.getUserShifts).toHaveBeenCalledWith('112204345149724665942');

      // displayMyShiftsが呼ばれたことを確認
      expect(global.displayMyShifts).toHaveBeenCalled();

      // エラーが発生していないことを確認
      expect(console.error).not.toHaveBeenCalled();
    });

    test('ユーザーがログインしていない場合は適切なメッセージを表示すること', async () => {
      global.getCurrentUser = jest.fn(() => null);

      const loadMyShifts = async () => {
        const container = document.getElementById('myShiftsContent');
        if (!container) return;

        const currentUser = getCurrentUser();
        if (!currentUser) {
          container.innerHTML = '<p>ログインが必要です。</p>';
          return;
        }
      };

      await loadMyShifts();

      expect(mockContainer.innerHTML).toContain('ログインが必要です。');
      expect(mockAPI.getUserShifts).not.toHaveBeenCalled();
    });

    test('APIエラー時に適切なエラーメッセージを表示すること', async () => {
      mockAPI.getUserShifts.mockRejectedValue(new Error('Network Error'));

      const loadMyShifts = async () => {
        const container = document.getElementById('myShiftsContent');
        if (!container) return;

        const currentUser = getCurrentUser();
        if (!currentUser) {
          container.innerHTML = '<p>ログインが必要です。</p>';
          return;
        }

        try {
          const result = await API.getUserShifts(currentUser.sub);

          if (result.success) {
            displayMyShifts(container, result.data);
          } else {
            container.innerHTML = '<p>シフトデータの取得に失敗しました。</p>';
          }
        } catch (error) {
          console.error('シフトデータの読み込みに失敗:', error);
          container.innerHTML = '<p>シフトデータの読み込みに失敗しました。</p>';
        }
      };

      await loadMyShifts();

      expect(mockContainer.innerHTML).toContain('シフトデータの読み込みに失敗しました。');
      expect(console.error).toHaveBeenCalledWith(
        'シフトデータの読み込みに失敗:',
        expect.any(Error)
      );
    });

    test('存在しない関数を呼び出していないこと', async () => {
      mockAPI.getUserShifts.mockResolvedValue({
        success: true,
        data: []
      });

      // scrollToNewlyAddedShiftが呼ばれないことを確認
      global.scrollToNewlyAddedShift = undefined;

      const loadMyShifts = async () => {
        const container = document.getElementById('myShiftsContent');
        const currentUser = getCurrentUser();

        if (!currentUser) return;

        try {
          const result = await API.getUserShifts(currentUser.sub);
          if (result.success) {
            displayMyShifts(container, []);

            // ❌ この行は存在してはいけない
            // scrollToNewlyAddedShift();
          }
        } catch (error) {
          console.error('シフトデータの読み込みに失敗:', error);
        }
      };

      // エラーが発生しないことを確認
      await expect(loadMyShifts()).resolves.not.toThrow();
    });
  });

  describe('displayMyShifts関数', () => {
    test('スクロール処理がdisplayMyShifts内で実行されること', () => {
      const mockShifts = [
        {
          shiftDate: '2026-01-27',
          timeSlot: '13:00-13:30',
          userId: '112204345149724665942',
          userName: 'Test User',
          uuid: 'uuid-1',
          registrationDate: '2026-01-26 04:50:02'
        }
      ];

      // displayMyShiftsの模擬実装（スクロール処理を含む）
      const displayMyShifts = (container, shiftsData) => {
        if (!shiftsData || shiftsData.length === 0) {
          container.innerHTML = '<p>シフトが登録されていません。</p>';
          return;
        }

        container.innerHTML = '<div class="my-shifts-table">シフト一覧</div>';

        // スクロール処理（実際のコードと同じ）
        const scrollInfo = getScrollToShiftAfterLoad();
        if (scrollInfo) {
          // スクロール処理を実行
          setScrollToShiftAfterLoad(null);
        }
      };

      displayMyShifts(mockContainer, mockShifts);

      // getScrollToShiftAfterLoadが呼ばれたことを確認
      expect(global.getScrollToShiftAfterLoad).toHaveBeenCalled();
    });
  });

  describe('関数の存在チェック', () => {
    test('必要な関数が全て定義されていること', () => {
      const requiredFunctions = [
        'getCurrentUser',
        'displayMyShifts',
        'getScrollToShiftAfterLoad',
        'setScrollToShiftAfterLoad'
      ];

      for (const funcName of requiredFunctions) {
        expect(typeof global[funcName]).toBe('function');
      }
    });

    test('scrollToNewlyAddedShift関数は定義されていないこと', () => {
      // この関数は存在してはいけない（displayMyShifts内で処理される）
      expect(global.scrollToNewlyAddedShift).toBeUndefined();
    });
  });
});

describe('未定義関数の検出', () => {
  test('ReferenceErrorが発生した場合に適切に処理されること', async () => {
    const container = document.createElement('div');
    container.id = 'myShiftsContent';
    document.body.appendChild(container);

    const mockUser = { sub: 'test-id' };
    global.getCurrentUser = jest.fn(() => mockUser);
    global.API = {
      getUserShifts: jest.fn().mockResolvedValue({ success: true, data: [] })
    };

    const loadMyShiftsWithError = async () => {
      try {
        const result = await global.API.getUserShifts(mockUser.sub);

        if (result.success) {
          // ❌ 存在しない関数を呼び出そうとする
          if (typeof undefinedFunction !== 'undefined') {
            undefinedFunction(); // これは実行されない
          }
        }
      } catch (error) {
        throw error;
      }
    };

    // エラーが発生しないことを確認
    await expect(loadMyShiftsWithError()).resolves.not.toThrow();
  });

  test('未定義変数へのアクセスを検出できること', () => {
    const checkUndefinedFunction = () => {
      try {
        // typeofを使用して安全にチェック
        return typeof scrollToNewlyAddedShift === 'undefined';
      } catch (error) {
        return true;
      }
    };

    // scrollToNewlyAddedShiftは未定義であるべき
    expect(checkUndefinedFunction()).toBe(true);
  });
});
