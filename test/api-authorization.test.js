import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import express from 'express';

process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';

const [{ default: apiRouter }, auth, { backendStore }] = await Promise.all([
  import('../server/routes.ts'),
  import('../server/auth.ts'),
  import('../server/store.ts')
]);
const { signAuthToken, setAuthAccountResolver } = auth;
const authAccounts = new Map();
setAuthAccountResolver(async (userId) => authAccounts.get(userId) || null);

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
  if (role) {
    const id = userId || `test-${role}`;
    if (!authAccounts.has(id)) {
      authAccounts.set(id, {
        id,
        role,
        authVersion: 1,
        isActive: true,
        ...(role === 'teacher' ? { teacherId: id } : {}),
        ...(role === 'student' ? { studentId: id } : {})
      });
    }
  }
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

test('revoked and inactive accounts cannot use existing tokens', async (t) => {
  await t.test('rejects a stale authorization version', async () => {
    authAccounts.set('stale-teacher', {
      id: 'stale-teacher',
      role: 'teacher',
      teacherId: 'stale-teacher',
      authVersion: 2,
      isActive: true
    });
    const response = await request('/staff-leaves', {
      role: 'teacher',
      userId: 'stale-teacher'
    });
    assert.equal(response.status, 401);
  });

  await t.test('rejects a deactivated account', async () => {
    authAccounts.set('inactive-teacher', {
      id: 'inactive-teacher',
      role: 'teacher',
      teacherId: 'inactive-teacher',
      authVersion: 1,
      isActive: false
    });
    const response = await request('/staff-leaves', {
      role: 'teacher',
      userId: 'inactive-teacher'
    });
    assert.equal(response.status, 401);
  });
});

test('teachers cannot create, edit, or delete timetable slots', async (t) => {
  const cases = [
    { path: '/timetable', method: 'POST', body: { class: 'JSS 1' } },
    { path: '/timetable/slot-1', method: 'PUT', body: { class: 'JSS 1' } },
    { path: '/timetable/slot-1', method: 'DELETE' }
  ];
  for (const route of cases) {
    await t.test(`${route.method} ${route.path}`, async () => {
      const response = await request(route.path, { ...route, role: 'teacher' });
      assert.equal(response.status, 403);
    });
  }
});

test('teachers cannot reschedule another teacher’s timetable slot', async () => {
  const originalGetTeacher = backendStore.getTeacherDirectoryRecord;
  const originalGetSlot = backendStore.getTimetableSlotById;
  let rescheduleCalled = false;
  const originalReschedule = backendStore.rescheduleTeacherSlot;
  backendStore.getTeacherDirectoryRecord = async (id) => ({
    id,
    name: 'Current Teacher',
    assignedClasses: [{ class: 'JSS 1', subject: 'Mathematics' }]
  });
  backendStore.getTimetableSlotById = async () => ({
    id: 'slot-1',
    class: 'JSS 1',
    subject: 'Mathematics',
    type: 'lesson',
    teacherId: 'another-teacher',
    teacherName: 'Another Teacher'
  });
  backendStore.rescheduleTeacherSlot = async () => {
    rescheduleCalled = true;
    return { success: true };
  };
  try {
    const response = await request('/timetable/reschedule', {
      role: 'teacher',
      method: 'POST',
      body: {
        slotId: 'slot-1',
        targetDay: 'Tuesday',
        targetStartTime: '10:00',
        targetEndTime: '11:00'
      }
    });
    assert.equal(response.status, 403);
    assert.equal(rescheduleCalled, false);
  } finally {
    backendStore.getTeacherDirectoryRecord = originalGetTeacher;
    backendStore.getTimetableSlotById = originalGetSlot;
    backendStore.rescheduleTeacherSlot = originalReschedule;
  }
});

test('teachers can reschedule their own assigned timetable lesson', async () => {
  const originalGetTeacher = backendStore.getTeacherDirectoryRecord;
  const originalGetSlot = backendStore.getTimetableSlotById;
  const originalReschedule = backendStore.rescheduleTeacherSlot;
  let rescheduleArgs;
  backendStore.getTeacherDirectoryRecord = async (id) => ({
    id,
    name: 'Current Teacher',
    assignedClasses: [{ class: 'JSS 1', subject: 'Mathematics' }]
  });
  backendStore.getTimetableSlotById = async () => ({
    id: 'slot-1',
    class: 'JSS 1',
    subject: 'Mathematics',
    type: 'lesson',
    teacherId: 'test-teacher',
    teacherName: 'Current Teacher'
  });
  backendStore.rescheduleTeacherSlot = async (...args) => {
    rescheduleArgs = args;
    return { success: true };
  };
  try {
    const response = await request('/timetable/reschedule', {
      role: 'teacher',
      method: 'POST',
      body: {
        slotId: 'slot-1',
        targetDay: 'Tuesday',
        targetStartTime: '10:00',
        targetEndTime: '11:00',
        actorTeacherName: 'Forged Name'
      }
    });
    assert.equal(response.status, 200);
    assert.equal(rescheduleArgs[4], 'Current Teacher');
    assert.equal(rescheduleArgs[5], 'test-teacher');
  } finally {
    backendStore.getTeacherDirectoryRecord = originalGetTeacher;
    backendStore.getTimetableSlotById = originalGetSlot;
    backendStore.rescheduleTeacherSlot = originalReschedule;
  }
});

test('teachers may only update and delete announcements they created', async (t) => {
  const originalGetAnnouncement = backendStore.getAnnouncementById;
  const originalUpdate = backendStore.updateAnnouncement;
  const originalDelete = backendStore.deleteAnnouncement;
  let receivedPatch;
  backendStore.getAnnouncementById = async () => ({
    id: 'announcement-1',
    creatorId: 'another-teacher'
  });
  backendStore.updateAnnouncement = async (_id, patch) => {
    receivedPatch = patch;
    return { id: 'announcement-1' };
  };
  backendStore.deleteAnnouncement = async () => true;
  try {
    await t.test('cannot update another teacher’s announcement', async () => {
      const response = await request('/announcements/announcement-1', {
        role: 'teacher',
        method: 'PUT',
        body: { title: 'Forged change' }
      });
      assert.equal(response.status, 403);
    });
    await t.test('cannot delete another teacher’s announcement', async () => {
      const response = await request('/announcements/announcement-1', {
        role: 'teacher',
        method: 'DELETE'
      });
      assert.equal(response.status, 403);
    });

    backendStore.getAnnouncementById = async () => ({
      id: 'announcement-1',
      creatorId: 'test-teacher'
    });
    await t.test('cannot change ownership metadata on own announcement', async () => {
      const response = await request('/announcements/announcement-1', {
        role: 'teacher',
        method: 'PUT',
        body: {
          title: 'Updated title',
          creatorId: 'another-teacher',
          authorRole: 'School Administration'
        }
      });
      assert.equal(response.status, 200);
      assert.deepEqual(receivedPatch, { title: 'Updated title' });
    });
  } finally {
    backendStore.getAnnouncementById = originalGetAnnouncement;
    backendStore.updateAnnouncement = originalUpdate;
    backendStore.deleteAnnouncement = originalDelete;
  }
});

test('teacher announcement creation uses trusted creator identity', async () => {
  const originalGetTeacher = backendStore.getTeacherDirectoryRecord;
  const originalAddAnnouncement = backendStore.addAnnouncement;
  let createdInput;
  backendStore.getTeacherDirectoryRecord = async (id) => ({
    id,
    name: 'Current Teacher'
  });
  backendStore.addAnnouncement = async (input) => {
    createdInput = input;
    return { id: 'new-announcement' };
  };
  try {
    const response = await request('/announcements', {
      role: 'teacher',
      method: 'POST',
      body: {
        title: 'Class update',
        content: 'Test',
        author: 'Forged Author',
        authorRole: 'Admin',
        creatorId: 'another-teacher',
        isPinned: true
      }
    });
    assert.equal(response.status, 201);
    assert.equal(createdInput.author, 'Current Teacher');
    assert.equal(createdInput.authorRole, 'Teaching Staff');
    assert.equal(createdInput.creatorId, 'test-teacher');
    assert.equal(createdInput.isPinned, false);
  } finally {
    backendStore.getTeacherDirectoryRecord = originalGetTeacher;
    backendStore.addAnnouncement = originalAddAnnouncement;
  }
});
