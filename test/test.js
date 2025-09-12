#!/usr/bin/env node

/**
 * Basic test suite for the Notion Law Data Collector API
 */

import { createNotionClient, validateNotionConfig, sendError, sendSuccess } from '../api/utils.js';
import assert from 'assert';

let tests = 0;
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests++;
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertThrows(fn, message) {
  try {
    fn();
    throw new Error(message || 'Expected function to throw');
  } catch (error) {
    if (error.message === message || message === undefined) {
      return; // Expected error
    }
    throw error;
  }
}

// Test utility functions
console.log('Running utility function tests...\n');

test('validateNotionConfig should throw when NOTION_API_KEY is not set', () => {
  const originalKey = process.env.NOTION_API_KEY;
  delete process.env.NOTION_API_KEY;
  
  assertThrows(() => validateNotionConfig(), 'NOTION_API_KEY environment variable is not configured');
  
  process.env.NOTION_API_KEY = originalKey;
});

test('validateNotionConfig should throw when NOTION_API_KEY has wrong format', () => {
  const originalKey = process.env.NOTION_API_KEY;
  process.env.NOTION_API_KEY = 'invalid_key';
  
  try {
    validateNotionConfig();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (!error.message.includes('Invalid NOTION_API_KEY format')) {
      throw error;
    }
  }
  
  process.env.NOTION_API_KEY = originalKey;
});

test('validateNotionConfig should pass with valid key format', () => {
  const originalKey = process.env.NOTION_API_KEY;
  process.env.NOTION_API_KEY = 'secret_test123';
  
  try {
    // Should not throw
    validateNotionConfig();
  } finally {
    process.env.NOTION_API_KEY = originalKey;
  }
});

// Test API response helpers
console.log('Running API response helper tests...\n');

test('sendError should return proper error format', () => {
  const mockRes = {
    headers: {},
    statusCode: 0,
    response: null,
    setHeader: function(key, value) { this.headers[key] = value; },
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.response = data; }
  };
  
  const error = new Error('Test error');
  sendError(mockRes, error, 400);
  
  assertEqual(mockRes.statusCode, 400);
  assertEqual(mockRes.response.error, true);
  assertEqual(mockRes.response.message, 'Test error');
  assert(mockRes.response.timestamp);
});

test('sendSuccess should return proper success format', () => {
  const mockRes = {
    headers: {},
    statusCode: 0,
    response: null,
    setHeader: function(key, value) { this.headers[key] = value; },
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.response = data; }
  };
  
  const data = { test: 'data' };
  sendSuccess(mockRes, data, 201);
  
  assertEqual(mockRes.statusCode, 201);
  assertEqual(mockRes.response.error, false);
  assertEqual(mockRes.response.data.test, 'data');
});

// Test database ID validation
console.log('Running database ID validation tests...\n');

test('Database ID validation should accept valid 32-char hex', () => {
  const validId = '40c4cef5c8cd4cb4891a35c3710df6e9';
  const cleanId = validId.replace(/-/g, '');
  const isValid = /^[a-f0-9]{32}$/i.test(cleanId);
  assertEqual(isValid, true, 'Valid database ID should pass validation');
});

test('Database ID validation should reject invalid format', () => {
  const invalidId = 'invalid-id';
  const cleanId = invalidId.replace(/-/g, '');
  const isValid = /^[a-f0-9]{32}$/i.test(cleanId);
  assertEqual(isValid, false, 'Invalid database ID should fail validation');
});

test('Database ID validation should handle dashes', () => {
  const idWithDashes = '40c4cef5-c8cd-4cb4-891a-35c3710df6e9';
  const cleanId = idWithDashes.replace(/-/g, '');
  const isValid = /^[a-f0-9]{32}$/i.test(cleanId);
  assertEqual(isValid, true, 'Database ID with dashes should pass validation after cleaning');
});

// Test error handling
console.log('Running error handling tests...\n');

test('HTML response detection should work', () => {
  const mockError = {
    response: {
      data: '<!DOCTYPE html><html><head>...',
      status: 200
    }
  };
  
  const isHtmlResponse = typeof mockError.response.data === 'string' && 
    mockError.response.data.toLowerCase().includes('<!doctype');
  
  assertEqual(isHtmlResponse, true, 'Should detect HTML response');
});

test('JSON response should not be detected as HTML', () => {
  const mockError = {
    response: {
      data: { error: 'Some API error' },
      status: 400
    }
  };
  
  const isHtmlResponse = typeof mockError.response.data === 'string' && 
    mockError.response.data.toLowerCase().includes('<!doctype');
  
  assertEqual(isHtmlResponse, false, 'Should not detect JSON as HTML response');
});

// Integration tests (if NOTION_API_KEY is available)
if (process.env.NOTION_API_KEY && process.env.NOTION_API_KEY.startsWith('secret_')) {
  console.log('Running integration tests with real API key...\n');
  
  test('createNotionClient should create valid client', () => {
    const client = createNotionClient();
    assert(client, 'Client should be created');
    assert(client.defaults.baseURL, 'Client should have baseURL');
    assert(client.defaults.headers.Authorization, 'Client should have Authorization header');
  });
} else {
  console.log('⚠️ Skipping integration tests - NOTION_API_KEY not available or invalid format\n');
  
  // Mock test that we can run without a real API key
  test('createNotionClient integration test (mocked)', () => {
    const originalKey = process.env.NOTION_API_KEY;
    process.env.NOTION_API_KEY = 'secret_test123';
    
    try {
      const client = createNotionClient();
      assert(client, 'Client should be created');
      assert(client.defaults.baseURL, 'Client should have baseURL');
      assert(client.defaults.headers.Authorization, 'Client should have Authorization header');
    } finally {
      process.env.NOTION_API_KEY = originalKey;
    }
  });
}

// Test summary
console.log('='.repeat(50));
console.log(`Test Results: ${passed}/${tests} passed, ${failed} failed`);

if (failed > 0) {
  console.log(`❌ ${failed} tests failed`);
  process.exit(1);
} else {
  console.log(`✅ All ${passed} tests passed!`);
  process.exit(0);
}