// Quick test script to verify logout behavior
const API_URL = 'http://localhost:4000';

async function request(method, path, options = {}) {
  const { body, token } = options;

  const headers = {
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
  return { status: response.status, data };
}

async function test() {
  console.log('🧪 Testing logout behavior...\n');

  // 1. Login
  console.log('1️⃣ Login...');
  const loginRes = await request('POST', '/api/auth/login', {
    body: {
      email: 'founder@test.cz',
      password: 'Test1234'
    }
  });

  if (loginRes.status !== 200) {
    console.log('❌ Login failed:', loginRes.data);
    return;
  }

  const token = loginRes.data.token;
  console.log(`✅ Login successful, token: ${token.substring(0, 20)}...`);

  // 2. Call protected endpoint (should work)
  console.log('\n2️⃣ Call protected endpoint /api/users/me (should work)...');
  const meRes1 = await request('GET', '/api/users/me', { token });
  console.log(`${meRes1.status === 200 ? '✅' : '❌'} Status: ${meRes1.status}`);
  if (meRes1.status === 200) {
    console.log(`   User: ${meRes1.data.email}`);
  }

  // 3. Logout
  console.log('\n3️⃣ Logout...');
  const logoutRes = await request('POST', '/api/auth/logout', { token });
  console.log(`${logoutRes.status === 200 ? '✅' : '❌'} Status: ${logoutRes.status}`);
  console.log(`   Message: ${logoutRes.data.message}`);

  // 4. Call protected endpoint again (should fail with 401)
  console.log('\n4️⃣ Call protected endpoint /api/users/me again (should fail with 401)...');
  const meRes2 = await request('GET', '/api/users/me', { token });
  console.log(`${meRes2.status === 401 ? '✅' : '❌'} Status: ${meRes2.status}`);
  console.log(`   Message: ${meRes2.data.message || meRes2.data.error}`);

  // Summary
  console.log('\n' + '='.repeat(50));
  if (meRes1.status === 200 && meRes2.status === 401) {
    console.log('✅ LOGOUT FUNGUJE SPRÁVNĚ!');
    console.log('   - Před logout: přístup povolen (200)');
    console.log('   - Po logout: přístup zamítnut (401)');
  } else {
    console.log('❌ BEZPEČNOSTNÍ BUG!');
    if (meRes2.status === 200) {
      console.log('   - Token stále funguje po logout!');
    }
  }
  console.log('='.repeat(50));
}

test().catch(console.error);
