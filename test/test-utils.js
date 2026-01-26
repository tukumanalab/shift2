/**
 * Test Utilities
 * Common helper functions for testing
 */

/**
 * Mock data generators
 */
export const mockData = {
  /**
   * Generate mock user data
   */
  createUser: (overrides = {}) => ({
    sub: 'test_user_123',
    name: 'テストユーザー',
    email: 'test@example.com',
    picture: 'https://example.com/photo.jpg',
    ...overrides
  }),

  /**
   * Generate mock shift data
   */
  createShift: (overrides = {}) => ({
    uuid: `shift_${Date.now()}_${Math.random()}`,
    userId: 'test_user_123',
    userName: 'テストユーザー',
    userEmail: 'test@example.com',
    date: '2026-02-15',
    timeSlot: '13:00-13:30',
    content: 'シフト',
    ...overrides
  }),

  /**
   * Generate mock special shift data
   */
  createSpecialShift: (overrides = {}) => ({
    uuid: `special_${Date.now()}_${Math.random()}`,
    userId: 'test_user_123',
    userName: 'テストユーザー',
    userEmail: 'test@example.com',
    date: '2026-02-15',
    startTime: '13:15',
    endTime: '15:45',
    ...overrides
  }),

  /**
   * Generate mock capacity setting
   */
  createCapacity: (overrides = {}) => ({
    date: '2026-02-15',
    capacity: 3,
    memo: '',
    userId: 'admin_user',
    userName: '管理者',
    ...overrides
  })
};

/**
 * DOM element helpers
 */
export const dom = {
  /**
   * Create a mock DOM element with common methods
   */
  createElement: (tag = 'div', attrs = {}) => {
    const element = document.createElement(tag);
    Object.keys(attrs).forEach(key => {
      element.setAttribute(key, attrs[key]);
    });
    return element;
  },

  /**
   * Create a mock button
   */
  createButton: (id, text = '') => {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    return button;
  },

  /**
   * Create a mock input
   */
  createInput: (id, type = 'text', value = '') => {
    const input = document.createElement('input');
    input.id = id;
    input.type = type;
    input.value = value;
    return input;
  },

  /**
   * Create a mock select
   */
  createSelect: (id, options = []) => {
    const select = document.createElement('select');
    select.id = id;
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.text;
      select.appendChild(option);
    });
    return select;
  },

  /**
   * Create a mock div container
   */
  createDiv: (id, className = '') => {
    const div = document.createElement('div');
    div.id = id;
    if (className) div.className = className;
    return div;
  }
};

/**
 * Date helpers
 */
export const dateUtils = {
  /**
   * Format date as YYYY-MM-DD
   */
  formatDate: (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Get date N days from now
   */
  getDaysFromNow: (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return dateUtils.formatDate(date);
  },

  /**
   * Get yesterday's date
   */
  getYesterday: () => dateUtils.getDaysFromNow(-1),

  /**
   * Get tomorrow's date
   */
  getTomorrow: () => dateUtils.getDaysFromNow(1),

  /**
   * Get date N months from now
   */
  getMonthsFromNow: (months) => {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return dateUtils.formatDate(date);
  },

  /**
   * Check if date is in the past
   */
  isPast: (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  },

  /**
   * Check if date is today
   */
  isToday: (dateString) => {
    return dateString === dateUtils.formatDate(new Date());
  }
};

/**
 * API mock helpers
 */
export const api = {
  /**
   * Create a successful API response
   */
  createSuccessResponse: (data) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data }),
    text: async () => JSON.stringify({ success: true, data })
  }),

  /**
   * Create an error API response
   */
  createErrorResponse: (message, status = 500) => ({
    ok: false,
    status,
    json: async () => ({ success: false, message }),
    text: async () => JSON.stringify({ success: false, message })
  }),

  /**
   * Mock fetch for successful requests
   */
  mockFetchSuccess: (data) => {
    return jest.fn().mockResolvedValue(api.createSuccessResponse(data));
  },

  /**
   * Mock fetch for failed requests
   */
  mockFetchError: (message, status = 500) => {
    return jest.fn().mockResolvedValue(api.createErrorResponse(message, status));
  },

  /**
   * Mock fetch that throws network error
   */
  mockFetchNetworkError: () => {
    return jest.fn().mockRejectedValue(new Error('Network error'));
  }
};

/**
 * Wait utilities
 */
export const wait = {
  /**
   * Wait for async operations
   */
  tick: () => new Promise(resolve => setImmediate(resolve)),

  /**
   * Wait for specific time
   */
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Wait for condition to be true
   */
  waitFor: async (condition, timeout = 1000) => {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > timeout) {
        throw new Error('Timeout waiting for condition');
      }
      await wait.tick();
    }
  }
};

/**
 * Setup helpers
 */
export const setup = {
  /**
   * Setup basic DOM structure
   */
  setupBasicDOM: () => {
    document.body.innerHTML = `
      <div id="app">
        <div id="loginSection"></div>
        <div id="profileSection"></div>
        <div id="tabSection"></div>
        <div id="contentSection"></div>
      </div>
    `;
  },

  /**
   * Setup shift request DOM
   */
  setupShiftRequestDOM: () => {
    document.body.innerHTML = `
      <div id="shiftRequestSection">
        <div id="shiftRequestCalendar"></div>
        <div id="shiftTimeSlots"></div>
        <button id="submitShiftButton">申請</button>
      </div>
    `;
  },

  /**
   * Setup shift list DOM
   */
  setupShiftListDOM: () => {
    document.body.innerHTML = `
      <div id="myShiftsSection">
        <div id="myShiftsList"></div>
        <button id="refreshMyShifts">更新</button>
      </div>
    `;
  },

  /**
   * Setup tab navigation DOM
   */
  setupTabNavigationDOM: () => {
    document.body.innerHTML = `
      <div id="tabSection">
        <button class="tab-button" data-tab="shiftRequest">シフト申請</button>
        <button class="tab-button" data-tab="myShifts">自分のシフト</button>
        <button class="tab-button" data-tab="allShifts">全シフト</button>
        <button class="tab-button" data-tab="capacity">人数設定</button>
      </div>
      <div id="contentSection">
        <div id="shiftRequestSection" class="tab-content"></div>
        <div id="myShiftsSection" class="tab-content"></div>
        <div id="allShiftsSection" class="tab-content"></div>
        <div id="capacitySection" class="tab-content"></div>
      </div>
    `;
  },

  /**
   * Setup modal DOM
   */
  setupModalDOM: () => {
    document.body.innerHTML = `
      <div id="shiftDetailModal" class="modal">
        <div class="modal-content">
          <span class="close">&times;</span>
          <div id="modalShiftsList"></div>
        </div>
      </div>
    `;
  },

  /**
   * Cleanup DOM
   */
  cleanup: () => {
    document.body.innerHTML = '';
  }
};

/**
 * Global state helpers
 */
export const state = {
  /**
   * Reset global state
   */
  reset: () => {
    global.currentUser = null;
    global.isAdminUser = false;
    global.myShiftsCache = null;
    global.allShiftsCache = null;
    global.capacityCache = null;
    global.currentShiftCounts = {};
    global.currentShiftRequestDate = null;
    global.currentDetailDateKey = null;
    global.selectedTimeSlots = [];
  },

  /**
   * Set current user
   */
  setUser: (user) => {
    global.currentUser = user;
  },

  /**
   * Set admin user
   */
  setAdminUser: (isAdmin = true) => {
    global.isAdminUser = isAdmin;
  },

  /**
   * Set shifts cache
   */
  setShiftsCache: (shifts) => {
    global.myShiftsCache = shifts;
  }
};
