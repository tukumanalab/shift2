import { deriveUserIcalToken, verifyUserIcalToken } from '../../utils/icalToken';

describe('icalToken', () => {
  const SECRET = 'test-secret-value';
  let originalToken: string | undefined;

  beforeEach(() => {
    originalToken = process.env.ICAL_TOKEN;
    process.env.ICAL_TOKEN = SECRET;
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.ICAL_TOKEN;
    } else {
      process.env.ICAL_TOKEN = originalToken;
    }
  });

  describe('deriveUserIcalToken()', () => {
    test('同じ user_id からは同じトークンが導出される（購読URLが安定する）', () => {
      expect(deriveUserIcalToken('user-1')).toBe(deriveUserIcalToken('user-1'));
    });

    test('異なる user_id からは異なるトークンが導出される', () => {
      expect(deriveUserIcalToken('user-1')).not.toBe(deriveUserIcalToken('user-2'));
    });

    test('ICAL_TOKEN（サーバー秘密鍵）が変わるとトークンも変わる（失効できる）', () => {
      const before = deriveUserIcalToken('user-1');
      process.env.ICAL_TOKEN = 'rotated-secret';
      expect(deriveUserIcalToken('user-1')).not.toBe(before);
    });

    test('導出されたトークンからサーバー秘密鍵が推測できない（秘密鍵を含まない）', () => {
      expect(deriveUserIcalToken('user-1')).not.toContain(SECRET);
    });

    test('URL に安全な文字列を返す', () => {
      expect(deriveUserIcalToken('user-1')).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('ICAL_TOKEN が未設定なら null を返す', () => {
      delete process.env.ICAL_TOKEN;
      expect(deriveUserIcalToken('user-1')).toBeNull();
    });
  });

  describe('verifyUserIcalToken()', () => {
    test('正しい user_id とトークンの組み合わせを受け入れる', () => {
      const token = deriveUserIcalToken('user-1') as string;
      expect(verifyUserIcalToken('user-1', token)).toBe(true);
    });

    test('他人のトークンで別の user_id にアクセスすると拒否する', () => {
      const otherToken = deriveUserIcalToken('user-2') as string;
      expect(verifyUserIcalToken('user-1', otherToken)).toBe(false);
    });

    test('共通の ICAL_TOKEN をそのまま渡しても拒否する', () => {
      expect(verifyUserIcalToken('user-1', SECRET)).toBe(false);
    });

    test('トークンが空や undefined なら拒否する', () => {
      expect(verifyUserIcalToken('user-1', '')).toBe(false);
      expect(verifyUserIcalToken('user-1', undefined)).toBe(false);
    });

    test('ICAL_TOKEN が未設定なら拒否する', () => {
      const token = deriveUserIcalToken('user-1') as string;
      delete process.env.ICAL_TOKEN;
      expect(verifyUserIcalToken('user-1', token)).toBe(false);
    });

    test('長さの異なるトークンでも例外を投げずに拒否する', () => {
      expect(() => verifyUserIcalToken('user-1', 'short')).not.toThrow();
      expect(verifyUserIcalToken('user-1', 'short')).toBe(false);
    });
  });
});
