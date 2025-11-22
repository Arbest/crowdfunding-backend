import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User, Project, Contribution } from '../models/index.js';

const API_URL = process.env.API_URL || 'http://localhost:4000';

interface TestResult {
  test: string;
  success: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

function log(message: string, type: 'info' | 'success' | 'error' | 'data' = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', data: '📊' };
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

  log(`  → ${method} ${path}`, 'info');
  if (body) {
    log(`  → Body: ${JSON.stringify(body).substring(0, 100)}...`, 'info');
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  log(`  ← Status: ${response.status}`, response.status === expectedStatus ? 'success' : 'error');
  log(`  ← Data: ${JSON.stringify(data).substring(0, 150)}...`, 'data');

  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}: ${JSON.stringify(data)}`
    );
  }

  return { status: response.status, data };
}

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    log(`\nTesting: ${name}`, 'info');
    await fn();
    const duration = Date.now() - start;
    results.push({ test: name, success: true, duration });
    log(`✓ ${name} (${duration}ms)\n`, 'success');
  } catch (error) {
    const duration = Date.now() - start;
    results.push({
      test: name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });
    log(`✗ ${name} (${duration}ms)`, 'error');
    log(`  Error: ${error}\n`, 'error');
  }
}

async function inspectDatabase() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 MongoDB Inspection');
  console.log('='.repeat(60) + '\n');

  try {
    await connectDatabase();

    const [users, projects, contributions] = await Promise.all([
      User.find().select('-passwordHash'),
      Project.find(),
      Contribution.find(),
    ]);

    log(`Users: ${users.length}`, 'data');
    users.forEach((user) => {
      console.log(`  - ${user.email} (${user.roles.join(', ')})`);
    });

    log(`\nProjects: ${projects.length}`, 'data');
    projects.forEach((project) => {
      console.log(`  - ${project.title} (${project.status})`);
      console.log(`    Target: ${project.targetAmount} ${project.currency}`);
      console.log(`    Current: ${project.stats.currentAmount} ${project.currency} (${project.stats.backerCount} backers)`);
      console.log(`    Rewards: ${project.rewards.length}`);
    });

    log(`\nContributions: ${contributions.length}`, 'data');
    contributions.forEach((contrib) => {
      console.log(`  - ${contrib.amount} ${contrib.currency} (${contrib.status})`);
      console.log(`    User: ${contrib.userId || 'Anonymous'}`);
    });

    await disconnectDatabase();
  } catch (error) {
    log(`Database inspection failed: ${error}`, 'error');
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Test data
let userToken = '';
let projectId = '';

const testUser = {
  email: `test-verbose-${Date.now()}@example.com`,
  password: 'TestPassword123',
  firstName: 'Test',
  lastName: 'User',
};

async function runTests() {
  console.log('\n🧪 API Tests (Verbose Mode)\n');
  console.log(`API URL: ${API_URL}\n`);

  // Inspect database first
  await inspectDatabase();

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
    log(`  Token received: ${userToken.substring(0, 20)}...`, 'data');
    if (!userToken) throw new Error('No token received');
  });

  await test('Login user', async () => {
    const { data } = await request('POST', '/api/auth/login', {
      body: { email: testUser.email, password: testUser.password },
    });
    userToken = (data as Record<string, unknown>).token as string;
    log(`  Token received: ${userToken.substring(0, 20)}...`, 'data');
  });

  await test('Get current user', async () => {
    const { data } = await request('GET', '/api/users/me', { token: userToken });
    const user = data as Record<string, unknown>;
    log(`  User: ${user.email} (${(user.roles as string[]).join(', ')})`, 'data');
    if (user.email !== testUser.email) {
      throw new Error('Email mismatch');
    }
  });

  // ========== PROJECTS ==========
  await test('List projects', async () => {
    const { data } = await request('GET', '/api/projects');
    const result = data as Record<string, unknown>;
    const projects = result.data as Array<Record<string, unknown>>;
    log(`  Found ${projects.length} projects`, 'data');

    // Get first project ID for later tests
    if (projects.length > 0) {
      projectId = projects[0]._id as string;
    }
  });

  await test('Get existing project', async () => {
    if (projectId) {
      const { data } = await request('GET', `/api/projects/${projectId}`);
      const project = data as Record<string, unknown>;
      log(`  Project: ${project.title}`, 'data');
      log(`  Rewards: ${(project.rewards as unknown[]).length}`, 'data');
    } else {
      log('  No project available to test', 'data');
    }
  });

  // ========== CONTRIBUTIONS ==========
  if (projectId) {
    await test('Create contribution (guest)', async () => {
      const { data } = await request('POST', '/api/contributions', {
        body: {
          projectId,
          amount: 100,
          currency: 'CZK',
        },
        expectedStatus: 201,
      });
      const contrib = data as Record<string, unknown>;
      log(`  Contribution ID: ${(contrib.contribution as Record<string, unknown>)._id}`, 'data');
      log(`  Client Secret: ${(contrib.clientSecret as string).substring(0, 30)}...`, 'data');
    });
  }

  // ========== LOGOUT ==========
  await test('Logout user', async () => {
    await request('POST', '/api/auth/logout', { token: userToken });
  });

  // ========== RESULTS ==========
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const total = results.length;
  const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / total;

  console.log(`Total: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`Average duration: ${avgDuration.toFixed(0)}ms\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  ❌ ${r.test} (${r.duration}ms)`);
        console.log(`     ${r.error}\n`);
      });
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Details');
  console.log('='.repeat(60) + '\n');

  results.forEach((r) => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.test.padEnd(50)} ${r.duration}ms`);
  });

  console.log('\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
