/**
 * iCal購読URLのサブパス対応テスト
 *
 * 回帰防止: 本番は https://tukumana.si.aoyama.ac.jp/shift2/ のように
 *          サブパス配下で配信されている。
 *          window.location.origin を基準に絶対URLを組み立てると
 *          /shift2 が欠落し、購読URLが 404 になる。
 *
 * このテストは実コード（js/modules/shifts.js）を直接 import して検証する。
 * 方針: docs/refactoring/phase-1-test-foundation.md
 */

const { toAbsoluteApiUrl } = require('../js/modules/shifts.js');

describe('iCal購読URLのサブパス対応', () => {
  afterEach(() => {
    delete global.config;
  });

  describe('サブパス配下（本番相当: /shift2/）', () => {
    beforeEach(() => {
      global.config = { API_BASE_URL: 'https://tukumana.si.aoyama.ac.jp/shift2/api' };
    });

    test('購読URLに /shift2 が含まれる', () => {
      const url = toAbsoluteApiUrl('/api/ical/user/112204345149724665942?token=abc');

      expect(url).toBe('https://tukumana.si.aoyama.ac.jp/shift2/api/ical/user/112204345149724665942?token=abc');
    });

    test('/shift2 が欠落しない（欠落すると本番で404になる）', () => {
      const url = toAbsoluteApiUrl('/api/ical/user/u1?token=abc');

      expect(url).toContain('/shift2/api/ical/');
      expect(url).not.toBe('https://tukumana.si.aoyama.ac.jp/api/ical/user/u1?token=abc');
    });

    test('管理者用（全シフト）URLにも /shift2 が含まれる', () => {
      const url = toAbsoluteApiUrl('/api/ical/all?token=admin');

      expect(url).toBe('https://tukumana.si.aoyama.ac.jp/shift2/api/ical/all?token=admin');
    });

    test('トークンのクエリが壊れない', () => {
      const url = toAbsoluteApiUrl('/api/ical/user/u1?token=8xm4WIDUM8v4gVTxpFJIZY6S7n9XzUwn7UphY0mqQZY');

      expect(url).toContain('?token=8xm4WIDUM8v4gVTxpFJIZY6S7n9XzUwn7UphY0mqQZY');
    });
  });

  describe('ルート直下（ローカル開発相当）', () => {
    beforeEach(() => {
      global.config = { API_BASE_URL: 'http://localhost:3000/api' };
    });

    test('サブパスがない場合もそのまま組み立てられる', () => {
      const url = toAbsoluteApiUrl('/api/ical/user/u1?token=abc');

      expect(url).toBe('http://localhost:3000/api/ical/user/u1?token=abc');
    });

    test('余分なパスが混入しない', () => {
      const url = toAbsoluteApiUrl('/api/ical/all?token=abc');

      expect(url).toBe('http://localhost:3000/api/ical/all?token=abc');
    });
  });
});
