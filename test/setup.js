// Jest setup file
global.console = {
  ...console,
  // uncomment to ignore a specific log level
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Mock current user
global.currentUser = {
  sub: 'test_user_123',
  name: 'テストユーザー',
  email: 'test@example.com',
  picture: 'https://example.com/photo.jpg'
};

// Mock global variables
global.isAdminUser = false;
global.currentShiftCounts = {};
global.currentShiftRequestDate = null;
global.currentDetailDateKey = null;
global.selectedTimeSlots = [];

// Mock DOM elements that are commonly used
const mockElement = {
  innerHTML: '',
  textContent: '',
  value: '',
  disabled: false,
  style: {},
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn(() => false)
  },
  appendChild: jest.fn(),
  addEventListener: jest.fn(),
  querySelector: jest.fn(() => mockElement),
  querySelectorAll: jest.fn(() => []),
  getElementById: jest.fn(() => mockElement),
  createElement: jest.fn(() => mockElement)
};

global.document = {
  ...mockElement,
  body: mockElement,
  head: mockElement
};

// Mock fetch function
global.fetch = jest.fn();

// Mock alert and confirm
global.alert = jest.fn();
global.confirm = jest.fn(() => true);

// Mock setTimeout and setInterval
global.setTimeout = jest.fn((cb, delay) => {
  if (typeof cb === 'function') {
    cb();
  }
  return 1;
});
global.setInterval = jest.fn();
global.clearTimeout = jest.fn();
global.clearInterval = jest.fn();

// Mock Response constructor
global.Response = class Response {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.statusText = options.statusText || 'OK';
    this.headers = options.headers || {};
    this.ok = this.status >= 200 && this.status < 300;
  }
  
  async json() {
    return JSON.parse(this.body);
  }
  
  async text() {
    return this.body;
  }
};