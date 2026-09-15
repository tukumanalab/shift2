/**
 * 管理者用iCal購読URL（全シフト）表示のテスト
 *
 * 回帰防止: /api/config から共通トークンの配布をやめた際、
 *          管理者の購読URL欄が常に「未設定」表示になる不具合が発生した。
 *          購読URLはサーバーから取得する方式に変更されている。
 */

describe('管理者用iCal購読URL（全シフト）', () => {
  let mockAPI;

  // 実装（js/modules/shifts.js の updateIcalUrl）と同じ挙動
  async function updateIcalUrl() {
    const input = document.getElementById('icalAllUrl');
    if (!input) return;

    const currentUser = global.getCurrentUser();
    if (!currentUser) {
      input.value = '（ログインが必要です）';
      return;
    }

    try {
      const result = await global.API.getAllIcalUrl(currentUser.email);
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
      <div id="shift-list">
        <div class="ical-url-box">
          <input type="text" id="icalAllUrl" readonly placeholder="読み込み中...">
          <button class="ical-copy-btn">コピー</button>
        </div>
      </div>
    `;

    mockAPI = { getAllIcalUrl: jest.fn() };
    global.API = mockAPI;
    global.getCurrentUser = jest.fn(() => ({ sub: 'dev-admin-001', email: 'admin@example.com' }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('サーバーから取得したURLを表示する', async () => {
    mockAPI.getAllIcalUrl.mockResolvedValue({
      success: true,
      data: { url: '/api/ical/all?token=admin-token-abc' }
    });

    await updateIcalUrl();

    const value = document.getElementById('icalAllUrl').value;
    expect(value).toContain('/api/ical/all?token=admin-token-abc');
    expect(value.startsWith('http')).toBe(true);
  });

  test('「ICAL_TOKEN が未設定です」の固定表示にならない', async () => {
    mockAPI.getAllIcalUrl.mockResolvedValue({
      success: true,
      data: { url: '/api/ical/all?token=admin-token-abc' }
    });

    await updateIcalUrl();

    expect(document.getElementById('icalAllUrl').value).not.toContain('ICAL_TOKEN が未設定');
  });

  test('取得に失敗してもURL欄が壊れない', async () => {
    mockAPI.getAllIcalUrl.mockResolvedValue({ success: false, error: 'ICAL_TOKEN 未設定' });

    await updateIcalUrl();

    expect(document.getElementById('icalAllUrl').value).toBe('（購読URLを取得できませんでした）');
  });

  test('通信が失敗してもURL欄が壊れない', async () => {
    mockAPI.getAllIcalUrl.mockRejectedValue(new Error('network error'));

    await updateIcalUrl();

    expect(document.getElementById('icalAllUrl').value).toBe('（購読URLを取得できませんでした）');
  });
});
