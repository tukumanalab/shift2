/**
 * 自分のシフトのiCal購読URL表示のテスト
 *
 * 目的: 「自分のシフト一覧」タブに表示する購読URLが
 *      - 本人の user_id とサーバー発行トークンで組み立てられること
 *      - 共通トークンをフロントで組み立てないこと
 *      - 取得失敗時にURL欄が壊れないこと
 *   を検証する
 */

describe('自分のシフトのiCal購読URL', () => {
  let mockAPI;
  let mockCurrentUser;

  // 実装（js/modules/shifts.js の updateMyIcalUrl）と同じ挙動
  async function updateMyIcalUrl() {
    const input = document.getElementById('icalMyUrl');
    if (!input) return;

    const currentUser = global.getCurrentUser();
    if (!currentUser) {
      input.value = '（ログインが必要です）';
      return;
    }

    try {
      const result = await global.API.getMyIcalUrl(currentUser.sub);
      if (result.success && result.data && result.data.url) {
        input.value = new URL(result.data.url, window.location.origin).href;
      } else {
        input.value = '（購読URLを取得できませんでした）';
      }
    } catch (error) {
      input.value = '（購読URLを取得できませんでした）';
    }
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="my-shifts">
        <div class="ical-url-box">
          <input type="text" id="icalMyUrl" readonly>
          <button class="ical-copy-btn">コピー</button>
        </div>
        <div id="myShiftsContent"></div>
      </div>
    `;

    mockCurrentUser = { sub: 'dev-user-001', email: 'a@example.com', name: 'ユーザーA' };
    mockAPI = { getMyIcalUrl: jest.fn() };

    global.API = mockAPI;
    global.getCurrentUser = jest.fn(() => mockCurrentUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('サーバーが返したURLを絶対URLにしてURL欄へ表示する', async () => {
    mockAPI.getMyIcalUrl.mockResolvedValue({
      success: true,
      data: { url: '/api/ical/user/dev-user-001?token=abc123' }
    });

    await updateMyIcalUrl();

    const value = document.getElementById('icalMyUrl').value;
    expect(value).toContain('/api/ical/user/dev-user-001?token=abc123');
    expect(value.startsWith('http')).toBe(true);
  });

  test('ログイン中のユーザーIDでサーバーに問い合わせる', async () => {
    mockAPI.getMyIcalUrl.mockResolvedValue({
      success: true,
      data: { url: '/api/ical/user/dev-user-001?token=abc123' }
    });

    await updateMyIcalUrl();

    expect(mockAPI.getMyIcalUrl).toHaveBeenCalledWith('dev-user-001');
  });

  test('URLは全シフト用エンドポイントを指さない', async () => {
    mockAPI.getMyIcalUrl.mockResolvedValue({
      success: true,
      data: { url: '/api/ical/user/dev-user-001?token=abc123' }
    });

    await updateMyIcalUrl();

    expect(document.getElementById('icalMyUrl').value).not.toContain('/ical/all');
  });

  test('未ログインならサーバーに問い合わせずメッセージを表示する', async () => {
    global.getCurrentUser = jest.fn(() => null);

    await updateMyIcalUrl();

    expect(mockAPI.getMyIcalUrl).not.toHaveBeenCalled();
    expect(document.getElementById('icalMyUrl').value).toBe('（ログインが必要です）');
  });

  test('サーバーがエラーを返してもURL欄が壊れない', async () => {
    mockAPI.getMyIcalUrl.mockResolvedValue({ success: false, error: 'ICAL_TOKEN 未設定' });

    await updateMyIcalUrl();

    expect(document.getElementById('icalMyUrl').value).toBe('（購読URLを取得できませんでした）');
  });

  test('通信が失敗してもURL欄が壊れない', async () => {
    mockAPI.getMyIcalUrl.mockRejectedValue(new Error('network error'));

    await updateMyIcalUrl();

    expect(document.getElementById('icalMyUrl').value).toBe('（購読URLを取得できませんでした）');
  });
});

describe('購読URLのコピー', () => {
  // 実装（js/modules/shifts.js の copyMyIcalUrl）と同じ挙動
  async function copyMyIcalUrl() {
    const input = document.getElementById('icalMyUrl');
    if (!input || !input.value || input.value.startsWith('（')) return;

    const btn = document.querySelector('#my-shifts .ical-copy-btn');

    try {
      await navigator.clipboard.writeText(input.value);
    } catch (error) {
      input.select();
      if (btn) {
        const original = btn.textContent;
        btn.textContent = 'Ctrl+Cでコピー';
        setTimeout(() => { btn.textContent = original; }, 3000);
      }
      return;
    }

    if (btn) {
      const original = btn.textContent;
      btn.textContent = 'コピーしました';
      setTimeout(() => { btn.textContent = original; }, 1500);
    }
  }

  let writeText;
  // test/setup.js の setTimeout スタブはコールバックを即座に実行するため、
  // 「一時的に変わった文言」は関数を抜けた時点では元に戻っている。
  // 戻す直前の文言を記録して検証する。
  let labelsBeforeRevert;

  beforeEach(() => {
    labelsBeforeRevert = [];
    global.setTimeout = jest.fn((cb) => {
      if (typeof cb === 'function') {
        const btn = document.querySelector('#my-shifts .ical-copy-btn');
        if (btn) labelsBeforeRevert.push(btn.textContent);
        cb();
      }
      return 1;
    });
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="my-shifts">
        <div class="ical-url-box">
          <input type="text" id="icalMyUrl" readonly>
          <button class="ical-copy-btn">コピー</button>
        </div>
      </div>
    `;
    document.getElementById('icalMyUrl').select = jest.fn();

    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('URL欄の内容をクリップボードにコピーする', async () => {
    const url = 'http://localhost:3100/api/ical/user/dev-user-001?token=abc123';
    document.getElementById('icalMyUrl').value = url;

    await copyMyIcalUrl();

    expect(writeText).toHaveBeenCalledWith(url);
  });

  test('コピー後にボタンの文言が「コピーしました」に変わり、その後元に戻る', async () => {
    document.getElementById('icalMyUrl').value = 'http://localhost:3100/api/ical/user/dev-user-001?token=abc123';

    await copyMyIcalUrl();

    expect(labelsBeforeRevert).toContain('コピーしました');
    expect(document.querySelector('#my-shifts .ical-copy-btn').textContent).toBe('コピー');
  });

  test('URLがまだ取得できていないときはコピーしない', async () => {
    document.getElementById('icalMyUrl').value = '（購読URLを取得できませんでした）';

    await copyMyIcalUrl();

    expect(writeText).not.toHaveBeenCalled();
  });

  test('クリップボードが使えなくても例外を投げず手動コピーを促す', async () => {
    document.getElementById('icalMyUrl').value = 'http://localhost:3100/api/ical/user/dev-user-001?token=abc123';
    writeText.mockRejectedValue(new DOMException('Write permission denied.', 'NotAllowedError'));
    jest.spyOn(console, 'error').mockImplementation();

    await expect(copyMyIcalUrl()).resolves.toBeUndefined();

    expect(labelsBeforeRevert).toContain('Ctrl+Cでコピー');
    expect(document.getElementById('icalMyUrl').select).toHaveBeenCalled();
  });
});
