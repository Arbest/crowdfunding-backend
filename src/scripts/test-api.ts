import 'dotenv/config';

const API_URL = process.env.API_URL || 'http://localhost:4000';

interface TestResult {
  test: string;
  success: boolean;
  error?: string;
  data?: unknown;
}

const results: TestResult[] = [];

function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌' };
  console.log(`${icons[type]} ${message}`);
}

async function request(
  method: string,
  path: string,
  options: {
    body?: unknown;
    token?: string;
    expectedStatus?: number;
  } = {}
): Promise<{ status: number; data: unknown }> {
  const { body, token, expectedStatus = 200 } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}: ${JSON.stringify(data)}`
    );
  }

  return { status: response.status, data };
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    log(`Testing: ${name}`, 'info');
    await fn();
    results.push({ test: name, success: true });
    log(`✓ ${name}`, 'success');
  } catch (error) {
    results.push({
      test: name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    log(`✗ ${name}: ${error}`, 'error');
  }
}

// Test data
let userToken = '';
let adminToken = '';
let projectId = '';
let rewardId = '';
let contributionId = '';

const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123',
  firstName: 'Test',
  lastName: 'User',
};

const testAdmin = {
  email: `admin-${Date.now()}@example.com`,
  password: 'AdminPassword123',
  firstName: 'Admin',
  lastName: 'User',
};

async function runTests() {
  console.log('\n🧪 Starting API Tests...\n');
  console.log(`API URL: ${API_URL}\n`);

  // ========== HEALTH CHECK ==========
  await test('Health check', async () => {
    const { data } = await request('GET', '/health');
    if (!(data as Record<string, unknown>).status) {
      throw new Error('Invalid health response');
    }
  });

  // ========== AUTH ==========
  await test('Register user', async () => {
    const { data } = await request('POST', '/api/auth/register', {
      body: testUser,
      expectedStatus: 201,
    });
    userToken = (data as Record<string, unknown>).token as string;
    if (!userToken) throw new Error('No token received');
  });

  await test('Login user', async () => {
    const { data } = await request('POST', '/api/auth/login', {
      body: { email: testUser.email, password: testUser.password },
    });
    userToken = (data as Record<string, unknown>).token as string;
    if (!userToken) throw new Error('No token received');
  });

  await test('Get current user', async () => {
    const { data } = await request('GET', '/api/users/me', { token: userToken });
    const user = data as Record<string, unknown>;
    if (user.email !== testUser.email) {
      throw new Error('Email mismatch');
    }
  });

  await test('Update user profile', async () => {
    await request('PATCH', '/api/users/me', {
      token: userToken,
      body: { firstName: 'Updated' },
    });
  });

  // ========== PROJECTS (without founder role) ==========
  await test('Create project without founder role (should fail)', async () => {
    await request(
      'POST',
      '/api/projects',
      {
        token: userToken,
        body: {
          title: 'Test Project',
          shortDescription: 'This is a test project',
          description: 'Longer description of the test project that meets minimum length requirements',
          category: 'technology',
          targetAmount: 50000,
          currency: 'CZK',
          deadlineAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        expectedStatus: 403,
      }
    );
  });

  // Register admin for testing
  await test('Register admin user', async () => {
    const { data } = await request('POST', '/api/auth/register', {
      body: testAdmin,
      expectedStatus: 201,
    });
    adminToken = (data as Record<string, unknown>).token as string;
  });

  // Note: In production, you'd need to manually set admin role in DB
  // For now, we'll skip admin-specific tests

  await test('List projects (public)', async () => {
    const { data } = await request('GET', '/api/projects');
    const result = data as Record<string, unknown>;
    if (!Array.isArray(result.data)) {
      throw new Error('Invalid response format');
    }
  });

  await test('List projects with filters', async () => {
    await request('GET', '/api/projects?category=technology&page=1&limit=10');
  });

  // ========== LOGOUT ==========
  await test('Logout user', async () => {
    await request('POST', '/api/auth/logout', { token: userToken });
  });

  await test('Access protected route after logout (should fail)', async () => {
    await request('GET', '/api/users/me', {
      token: userToken,
      expectedStatus: 401,
    });
  });

  // ========== INVALID REQUESTS ==========
  await test('Register with invalid email (should fail)', async () => {
    await request(
      'POST',
      '/api/auth/register',
      {
        body: { ...testUser, email: 'invalid-email' },
        expectedStatus: 400,
      }
    );
  });

  await test('Login with wrong password (should fail)', async () => {
    await request(
      'POST',
      '/api/auth/login',
      {
        body: { email: testUser.email, password: 'WrongPassword' },
        expectedStatus: 401,
      }
    );
  });

  await test('Access admin route without auth (should fail)', async () => {
    await request('GET', '/api/admin/stats', { expectedStatus: 401 });
  });

  // ========== RESULTS ==========
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results');
  console.log('='.repeat(50) + '\n');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const total = results.length;

  console.log(`Total: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  ❌ ${r.test}`);
        console.log(`     ${r.error}\n`);
      });
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
