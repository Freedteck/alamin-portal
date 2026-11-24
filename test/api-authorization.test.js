import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import express from 'express';

process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';

const [{ default: apiRouter }, { signAuthToken }] = await Promise.all([
  import('../server/routes.ts'),
  import('../server/auth.ts')
]);

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

function authHeader(role, userId = `test-${role}`) {
  return {
    Authorization: `Bearer ${signAuthToken({
      id: userId,
      email: `${userId}@example.test`,
      name: userId,
      role,
      ...(role === 'teacher' ? { teacherId: userId } : {}),
      ...(role === 'student' ? { studentId: userId } : {})
    })}`
  };
}

async function request(path, { role, userId, method = 'GET', body } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(role ? authHeader(role, userId) : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

test('protected API routes reject unauthenticated requests', async () => {
  const response = await request('/students');
  assert.equal(response.status, 401);
});

test('non-admin roles cannot access direct messages', async (t) => {
  for (const role of ['teacher', 'student']) {
    await t.test(role, async () => {
      const response = await request('/messages', { role });
      assert.equal(response.status, 403);
    });
  }
});

test('only admins may mutate shared resources', async (t) => {
  for (const role of ['teacher', 'student']) {
    await t.test(role, async () => {
      const response = await request('/resources/resource-1', {
        role,
        method: 'PUT',
        body: { title: 'Unauthorized update' }
      });
      assert.equal(response.status, 403);
    });
  }
});

test('only admins may manage shared catalog and documents', async (t) => {
  const cases = [
    { path: '/subjects', method: 'POST', body: { name: 'Forged subject' } },
    { path: '/subjects/subject-1', method: 'PUT', body: { name: 'Changed subject' } },
    { path: '/equipment', method: 'POST', body: { name: 'Forged equipment' } },
    { path: '/equipment/equipment-1', method: 'DELETE' },
    { path: '/maintenance/maintenance-1', method: 'PATCH', body: { status: 'resolved' } },
    { path: '/documents', method: 'POST', body: { name: 'Forged document' } },
    { path: '/documents/document-1/access', method: 'PATCH', body: { accessLevel: 'all' } },
    { path: '/documents/document-1', method: 'DELETE' }
  ];

  for (const role of ['teacher', 'student']) {
    await t.test(role, async (subtest) => {
      for (const route of cases) {
        await subtest.test(`${route.method} ${route.path}`, async () => {
          const response = await request(route.path, { ...route, role });
          assert.equal(response.status, 403);
        });
      }
    });
  }
});

test('teachers cannot access or modify another teacher profile', async (t) => {
  await t.test('read', async () => {
    const response = await request('/teachers/another-teacher', {
      role: 'teacher',
      userId: 'current-teacher'
    });
    assert.equal(response.status, 403);
  });

  await t.test('update', async () => {
    const response = await request('/teachers/another-teacher', {
      role: 'teacher',
      userId: 'current-teacher',
      method: 'PUT',
      body: { name: 'Changed name', classTeacherOf: ['SSS 3'] }
    });
    assert.equal(response.status, 403);
  });
});

test('students cannot access individual teacher profiles', async () => {
  const response = await request('/teachers/private-teacher-id', {
    role: 'student'
  });
  assert.equal(response.status, 403);
});

test('only students may submit student requests', async () => {
  const response = await request('/requests', {
    role: 'teacher',
    method: 'POST',
    body: { title: 'Forged request' }
  });
  assert.equal(response.status, 403);
});

test('students cannot access staff leave records', async () => {
  const response = await request('/staff-leaves', { role: 'student' });
  assert.equal(response.status, 403);
});
