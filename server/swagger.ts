const bearerSecurity = [{ bearerAuth: [] }];

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Al-Amin Group of Schools REST API',
    version: '1.0.0',
    description:
      'Standalone REST API backend for Al-Amin Group of Schools Management System.\n\n' +
      '**How to test protected endpoints in Swagger UI:**\n' +
      '1. Expand `POST /api/auth/login` below and click **Try it out** -> **Execute** using the prefilled demo admin credentials (`admin@alaminschools.edu` / `admin123`).\n' +
      '2. Copy the returned `token` from the response body.\n' +
      '3. Click the green **Authorize** button at the top-right and paste the token.\n' +
      '4. Now every school endpoint is unlocked and ready to execute!'
  },
  servers: [
    {
      url: '/api',
      description: 'Current API Server'
    }
  ],
  tags: [
    { name: 'System', description: 'Health check, bootstrap snapshot, and real-time SSE stream' },
    { name: 'Auth', description: 'JWT Login and current profile (self-registration is disabled; Admin provisions accounts)' },
    { name: 'Students', description: 'Student directory, profiles, and subject enrollment' },
    { name: 'Teachers', description: 'Teaching staff directory and class allocations' },
    { name: 'Subjects', description: 'School curriculum catalog' },
    { name: 'Timetable', description: 'Weekly lesson schedule, rescheduling, and alerts' },
    { name: 'Attendance', description: 'Class roll call and student attendance logs' },
    { name: 'Grades & Reports', description: 'CA1/CA2/Exam grading and full report cards' },
    { name: 'Resources & Equipment', description: 'Learning resources, lab inventory, and maintenance' },
    { name: 'Documents', description: 'School policy documents and class access controls' },
    { name: 'Announcements', description: 'Campus notices and pinned events' },
    { name: 'Availability', description: 'Teacher consultation hours' },
    { name: 'Assignments', description: 'Homework, classwork, and student submissions' },
    { name: 'Requests', description: 'Student academic help and booking requests' },
    { name: 'Enquiries', description: 'Public admission enquiries & appointment bookings' },
    { name: 'Files', description: 'Multipart upload & secure file download' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'API Health & Storage Mode Check',
        responses: {
          200: {
            description: 'Backend API is healthy'
          }
        }
      }
    },
    '/bootstrap': {
      get: {
        tags: ['System'],
        summary: 'Fetch complete school data snapshot for frontend hydration',
        security: bearerSecurity,
        responses: { 200: { description: 'Complete school snapshot object' }, 401: { description: 'Unauthorized' } }
      }
    },
    '/events': {
      get: {
        tags: ['System'],
        summary: 'Server-Sent Events (SSE) stream for live multi-device updates',
        security: bearerSecurity,
        parameters: [
          { name: 'token', in: 'query', schema: { type: 'string' }, description: 'Optional JWT token for EventSource clients' }
        ],
        responses: { 200: { description: 'text/event-stream connection' } }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in with email and password to receive a JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@alaminschools.edu' },
                  password: { type: 'string', example: 'admin123' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful, returns { token, user }' },
          401: { description: 'Invalid credentials' }
        }
      }
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Self-registration is disabled (Admin only via /students or /teachers)',
        description:
          'Public self-registration is disabled. Only a School Administrator can add students (`POST /api/students`) and teachers (`POST /api/teachers`), which automatically provisions their login credentials.',
        responses: {
          403: { description: 'Self-registration is disabled. Admin must add users.' }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get currently authenticated user profile',
        security: bearerSecurity,
        responses: { 200: { description: 'Authenticated user object' }, 401: { description: 'Unauthorized' } }
      }
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout current session',
        responses: { 200: { description: 'Logged out cleanly' } }
      }
    },
    '/students': {
      get: {
        tags: ['Students'],
        summary: 'List all students',
        security: bearerSecurity,
        responses: { 200: { description: 'Array of student records' } }
      },
      post: {
        tags: ['Students'],
        summary: 'Admit a new student & provision portal login (Admin only)',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'class'],
                properties: {
                  name: { type: 'string', example: 'Sadiq Abdullahi' },
                  class: { type: 'string', example: 'SSS 2' },
                  department: { type: 'string', example: 'Science' },
                  gender: { type: 'string', example: 'Male' },
                  email: { type: 'string', example: 'sadiq@student.alamin.sch.ng' },
                  portalPassword: { type: 'string', example: 'StudentPass123' },
                  parentName: { type: 'string', example: 'Alhaji Abdullahi' },
                  parentPhone: { type: 'string', example: '+234 803 000 1122' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Created student record and provisioned portal credentials' }, 403: { description: 'Admin access required' }, 409: { description: 'Email already exists' } }
      }
    },
    '/students/{id}': {
      get: {
        tags: ['Students'],
        summary: 'Get a single student by ID',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'stu_101' } }],
        responses: { 200: { description: 'Student profile' }, 404: { description: 'Not found' } }
      },
      put: {
        tags: ['Students'],
        summary: 'Update a student record',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Updated student' } }
      },
      delete: {
        tags: ['Students'],
        summary: 'Remove a student record (Admin)',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } }
      }
    },
    '/students/{id}/enroll-subject': {
      post: {
        tags: ['Students'],
        summary: 'Enroll a student in a subject',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'stu_101' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subject'],
                properties: { subject: { type: 'string', example: 'Computer Studies / ICT' } }
              }
            }
          }
        },
        responses: { 200: { description: 'Updated student with enrolled subject' } }
      }
    },
    '/teachers': {
      get: {
        tags: ['Teachers'],
        summary: 'List all teaching staff',
        security: bearerSecurity,
        responses: { 200: { description: 'Array of teachers' } }
      },
      post: {
        tags: ['Teachers'],
        summary: 'Create a teaching staff profile & provision portal login (Admin only)',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email'],
                properties: {
                  name: { type: 'string', example: 'Mrs. Hafsat Umar' },
                  email: { type: 'string', example: 'hafsat.umar@alamin.sch.ng' },
                  portalPassword: { type: 'string', example: 'TeacherPass123' },
                  phone: { type: 'string', example: '+234 805 111 4455' },
                  qualification: { type: 'string', example: 'B.Sc. Biology, TRCN' },
                  formTeacherOf: { type: 'string', example: 'JSS 2' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Teacher created and portal credentials provisioned' }, 403: { description: 'Admin access required' }, 409: { description: 'Email already exists' } }
      }
    },
    '/teachers/{id}': {
      get: {
        tags: ['Teachers'],
        summary: 'Get teacher by ID',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'tch_101' } }],
        responses: { 200: { description: 'Teacher object' } }
      },
      put: {
        tags: ['Teachers'],
        summary: 'Update teacher profile',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Updated teacher' } }
      },
      delete: {
        tags: ['Teachers'],
        summary: 'Delete teacher profile (Admin)',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } }
      }
    },
    '/teachers/me': {
      get: {
        tags: ['Teachers'],
        summary: 'Get the authenticated teacher profile',
        security: bearerSecurity,
        responses: {
          200: { description: 'Authenticated teacher profile' },
          403: { description: 'Teacher access required' },
          404: { description: 'Teacher profile not found' }
        }
      }
    },
    '/teachers/{id}/assign-class': {
      post: {
        tags: ['Teachers'],
        summary: 'Assign a class & subject to a teacher',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'tch_101' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['class', 'subject'],
                properties: {
                  class: { type: 'string', example: 'SSS 1' },
                  subject: { type: 'string', example: 'Physics' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Updated teacher allocations' } }
      },
      delete: {
        tags: ['Teachers'],
        summary: 'Remove a class & subject allocation from a teacher',
        security: bearerSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'class', in: 'query', schema: { type: 'string' } },
          { name: 'subject', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Updated teacher allocations' } }
      }
    },
    '/subjects': {
      get: {
        tags: ['Subjects'],
        summary: 'List curriculum subjects, optionally filtered by class and department',
        security: bearerSecurity,
        parameters: [
          { name: 'class', in: 'query', schema: { type: 'string' } },
          { name: 'department', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Subject list' } }
      },
      post: {
        tags: ['Subjects'],
        summary: 'Add a curriculum subject',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Further Mathematics' },
                  allClasses: { type: 'boolean', example: false },
                  classes: { type: 'array', items: { type: 'string' }, example: ['SSS 1', 'SSS 2', 'SSS 3'] },
                  allDepartments: { type: 'boolean', example: false },
                  departments: { type: 'array', items: { type: 'string' }, example: ['Science'] }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Subject created' } }
      }
    },
    '/subjects/{id}': {
      put: {
        tags: ['Subjects'],
        summary: 'Update a curriculum subject',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Subject updated' } }
      },
      delete: {
        tags: ['Subjects'],
        summary: 'Delete a curriculum subject',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } }
      }
    },
    '/timetable': {
      get: {
        tags: ['Timetable'],
        summary: 'Get weekly timetable slots (optionally filtered by class)',
        security: bearerSecurity,
        parameters: [{ name: 'class', in: 'query', schema: { type: 'string', example: 'SSS 2' } }],
        responses: { 200: { description: 'Timetable slots' } }
      },
      post: {
        tags: ['Timetable'],
        summary: 'Create a timetable slot',
        security: bearerSecurity,
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Slot created' } }
      }
    },
    '/timetable/{id}': {
      put: {
        tags: ['Timetable'],
        summary: 'Update a timetable slot',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Slot updated' } }
      },
      delete: {
        tags: ['Timetable'],
        summary: 'Delete a timetable slot',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Slot deleted' } }
      }
    },
    '/timetable/reschedule': {
      post: {
        tags: ['Timetable'],
        summary: 'Reschedule or swap a class period with conflict checks & alerts',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['slotId', 'targetDay', 'targetStartTime', 'targetEndTime'],
                properties: {
                  slotId: { type: 'string', example: 'tt-sss2-mon1' },
                  targetDay: { type: 'string', example: 'Tuesday' },
                  targetStartTime: { type: 'string', example: '08:30' },
                  targetEndTime: { type: 'string', example: '09:30' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Rescheduled successfully' }, 409: { description: 'Schedule conflict' } }
      }
    },
    '/alerts': {
      get: {
        tags: ['Timetable'],
        summary: 'List timetable alerts',
        security: bearerSecurity,
        responses: { 200: { description: 'Array of alerts' } }
      }
    },
    '/alerts/{id}': {
      delete: {
        tags: ['Timetable'],
        summary: 'Dismiss an alert',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Alert dismissed' } }
      }
    },
    '/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'Get attendance registers, optionally filtered by date and class',
        security: bearerSecurity,
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', example: '2026-11-17' } },
          { name: 'class', in: 'query', schema: { type: 'string', example: 'SSS 2' } }
        ],
        responses: { 200: { description: 'Map of matching date_className attendance entries' } }
      },
      post: {
        tags: ['Attendance'],
        summary: 'Save or update daily class attendance',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['date', 'className', 'records'],
                properties: {
                  date: { type: 'string', example: '2026-11-17' },
                  className: { type: 'string', example: 'SSS 2' },
                  submittedBy: { type: 'string', example: 'Academic Staff' },
                  records: { type: 'object', example: { stu_101: 'present', stu_102: 'late' } }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Attendance saved' } }
      }
    },
    '/attendance/student/{studentId}': {
      get: {
        tags: ['Attendance'],
        summary: 'Get attendance history & summary stats for a student',
        security: bearerSecurity,
        parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string', example: 'stu_101' } }],
        responses: { 200: { description: 'Student attendance breakdown' } }
      }
    },
    '/grades': {
      get: {
        tags: ['Grades & Reports'],
        summary: 'List all saved grades map',
        security: bearerSecurity,
        responses: { 200: { description: 'Map of grade entries' } }
      },
      post: {
        tags: ['Grades & Reports'],
        summary: 'Record or update CA1, CA2, and Exam score for a student subject',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['studentId', 'term', 'subject'],
                properties: {
                  studentId: { type: 'string', example: 'stu_101' },
                  session: { type: 'string', example: '2026/2027' },
                  term: { type: 'string', example: 'Term1' },
                  subject: { type: 'string', example: 'Mathematics' },
                  ca1: { type: 'number', example: 18 },
                  ca2: { type: 'number', example: 19 },
                  exam: { type: 'number', example: 54 },
                  remark: { type: 'string', example: 'Excellent' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Grade saved with calculated WAEC grade' } }
      }
    },
    '/reports/{studentId}': {
      get: {
        tags: ['Grades & Reports'],
        summary: 'Generate full academic report card for a student',
        security: bearerSecurity,
        parameters: [
          { name: 'studentId', in: 'path', required: true, schema: { type: 'string', example: 'stu_101' } },
          { name: 'term', in: 'query', schema: { type: 'string', example: 'Term1' } },
          { name: 'session', in: 'query', schema: { type: 'string', example: '2026/2027' } }
        ],
        responses: { 200: { description: 'Full term report card' } }
      }
    },
    '/resources': {
      get: {
        tags: ['Resources & Equipment'],
        summary: 'List learning resources',
        security: bearerSecurity,
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'subject', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'class', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }
        ],
        responses: { 200: { description: 'Resources array or paginated result when page/limit is provided' } }
      },
      post: { tags: ['Resources & Equipment'], summary: 'Add a learning resource', security: bearerSecurity, requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 201: { description: 'Resource created' } } }
    },
    '/resources/{id}': {
      put: { tags: ['Resources & Equipment'], summary: 'Update a learning resource', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'Updated resource' } } },
      delete: { tags: ['Resources & Equipment'], summary: 'Delete a learning resource', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deleted' } } }
    },
    '/equipment': {
      get: { tags: ['Resources & Equipment'], summary: 'List school lab & ICT equipment', security: bearerSecurity, responses: { 200: { description: 'Equipment array' } } },
      post: { tags: ['Resources & Equipment'], summary: 'Add equipment item', security: bearerSecurity, requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 201: { description: 'Equipment created' } } }
    },
    '/equipment/{id}': {
      delete: { tags: ['Resources & Equipment'], summary: 'Delete equipment item', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deleted' } } }
    },
    '/maintenance': {
      get: { tags: ['Resources & Equipment'], summary: 'List maintenance requests', security: bearerSecurity, responses: { 200: { description: 'Maintenance array' } } },
      post: { tags: ['Resources & Equipment'], summary: 'Log a maintenance issue', security: bearerSecurity, requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 201: { description: 'Maintenance request logged' } } }
    },
    '/maintenance/{id}': {
      patch: { tags: ['Resources & Equipment'], summary: 'Update maintenance request status', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'completed' } } } } } }, responses: { 200: { description: 'Status updated' } } }
    },
    '/documents': {
      get: {
        tags: ['Documents'],
        summary: 'List school documents',
        security: bearerSecurity,
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'access', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }
        ],
        responses: { 200: { description: 'Documents array or paginated result when page/limit is provided' } }
      },
      post: { tags: ['Documents'], summary: 'Upload/register a school document record', security: bearerSecurity, requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 201: { description: 'Document created' } } }
    },
    '/documents/{id}/access': {
      patch: { tags: ['Documents'], summary: 'Update document access level & allowed classes', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { accessLevel: { type: 'string', example: 'students' }, allowedClasses: { type: 'array', items: { type: 'string' } } } } } } }, responses: { 200: { description: 'Access updated' } } }
    },
    '/documents/{id}': {
      delete: { tags: ['Documents'], summary: 'Delete a document', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deleted' } } }
    },
    '/announcements': {
      get: {
        tags: ['Announcements'],
        summary: 'List announcements',
        security: bearerSecurity,
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'audience', in: 'query', schema: { type: 'string' } },
          { name: 'scope', in: 'query', schema: { type: 'string', enum: ['all', 'admin', 'mine'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }
        ],
        responses: { 200: { description: 'Announcements array or paginated result when page/limit is provided' } }
      },
      post: { tags: ['Announcements'], summary: 'Publish an announcement', security: bearerSecurity, requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 201: { description: 'Created' } } }
    },
    '/announcements/{id}': {
      put: { tags: ['Announcements'], summary: 'Update an announcement', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Announcements'], summary: 'Delete an announcement', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deleted' } } }
    },
    '/availability': {
      get: { tags: ['Availability'], summary: 'List teacher consultation availability slots', security: bearerSecurity, responses: { 200: { description: 'Availability slots' } } },
      post: { tags: ['Availability'], summary: 'Add teacher consultation availability slot', security: bearerSecurity, requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 201: { description: 'Created' } } }
    },
    '/availability/{id}/toggle': {
      patch: { tags: ['Availability'], summary: 'Toggle availability slot open/closed', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Toggled' } } }
    },
    '/availability/{id}': {
      delete: { tags: ['Availability'], summary: 'Delete availability slot', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deleted' } } }
    },
    '/assignments': {
      get: {
        tags: ['Assignments'],
        summary: 'List assignments',
        security: bearerSecurity,
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'class', in: 'query', schema: { type: 'string' } },
          { name: 'subject', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }
        ],
        responses: { 200: { description: 'Assignments array or paginated result when page/limit is provided' } }
      },
      post: { tags: ['Assignments'], summary: 'Create a new assignment', security: bearerSecurity, requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 201: { description: 'Created' } } }
    },
    '/assignments/{id}': {
      put: { tags: ['Assignments'], summary: 'Update assignment (including grading submissions)', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Assignments'], summary: 'Delete assignment', security: bearerSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deleted' } } }
    },
    '/assignments/{id}/submit': {
      post: {
        tags: ['Assignments'],
        summary: 'Submit student work for an assignment',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'asg-1' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  notes: { type: 'string', example: 'Completed questions 1 to 20.' },
                  fileName: { type: 'string', example: 'solution.pdf' },
                  fileUrl: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Submission recorded' } }
      }
    },
    '/requests': {
      get: { tags: ['Requests'], summary: 'List student academic requests', security: bearerSecurity, responses: { 200: { description: 'Requests array' } } },
      post: { tags: ['Requests'], summary: 'Submit a new student help/booking request', security: bearerSecurity, requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 201: { description: 'Request created' } } }
    },
    '/requests/{id}/status': {
      patch: {
        tags: ['Requests'],
        summary: 'Approve/decline a student request',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['pending', 'approved', 'declined', 'completed'], example: 'approved' },
                  staffResponse: { type: 'string', example: 'See me at the staff room after Zuhr.' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Status updated' } }
      }
    },
    '/enquiries': {
      get: { tags: ['Enquiries'], summary: 'List public parent enquiries & campus tour bookings (Admin)', security: bearerSecurity, responses: { 200: { description: 'Enquiries list' } } },
      post: {
        tags: ['Enquiries'],
        summary: 'Submit a public enquiry or appointment booking',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['parentName', 'email'],
                properties: {
                  kind: { type: 'string', enum: ['enquiry', 'appointment'], example: 'enquiry' },
                  parentName: { type: 'string', example: 'Alhaji Musa Bello' },
                  studentName: { type: 'string', example: 'Maryam Musa' },
                  email: { type: 'string', example: 'musa@alamin-parents.ng' },
                  phone: { type: 'string', example: '+234 803 111 0000' },
                  message: { type: 'string', example: 'Interested in JSS 1 admission for 2026/2027.' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Enquiry received' } }
      }
    },
    '/files/upload': {
      post: {
        tags: ['Files'],
        summary: 'Upload a file (resource, document, or assignment attachment)',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  folder: { type: 'string', example: 'resources' },
                  file: { type: 'string', format: 'binary' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'File metadata and download URL' } }
      }
    },
    '/files/download/{folder}/{filename}': {
      get: {
        tags: ['Files'],
        summary: 'Download an uploaded file',
        parameters: [
          { name: 'folder', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'filename', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Binary file stream' }, 404: { description: 'File not found' } }
      }
    },
    '/auth/profile/avatar': {
      post: {
        tags: ['Auth'],
        summary: 'Upload and update profile avatar photo',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  avatar: { type: 'string', format: 'binary', description: 'Avatar image file' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Avatar updated successfully' },
          400: { description: 'No image uploaded' }
        }
      }
    },
    '/classes': {
      get: {
        tags: ['Classes'],
        summary: 'List all academic classes',
        security: bearerSecurity,
        responses: { 200: { description: 'Array of classes' } }
      },
      post: {
        tags: ['Classes'],
        summary: 'Create a new class',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'SSS 1' },
                  category: { type: 'string', example: 'Senior' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Class created' }, 400: { description: 'Invalid payload' } }
      }
    },
    '/classes/{id}': {
      delete: {
        tags: ['Classes'],
        summary: 'Delete an academic class',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Class removed' }, 404: { description: 'Class not found' } }
      }
    },
    '/students/{id}/credentials': {
      post: {
        tags: ['Students'],
        summary: 'Generate or reset student login credentials',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  password: { type: 'string', example: 'studentPass123' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Credentials updated' } }
      }
    },
    '/teachers/{id}/credentials': {
      post: {
        tags: ['Teachers'],
        summary: 'Generate or reset teacher login credentials',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  password: { type: 'string', example: 'teacherPass123' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Credentials updated' } }
      }
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset OTP code',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['identifier'],
                properties: {
                  identifier: { type: 'string', example: 'staff@alaminschools.edu' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'OTP dispatched' } }
      }
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password using verified OTP code',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['identifier', 'otp', 'newPassword'],
                properties: {
                  identifier: { type: 'string', example: 'staff@alaminschools.edu' },
                  otp: { type: 'string', example: '123456' },
                  newPassword: { type: 'string', example: 'newSecret123' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Password reset successful' } }
      }
    },
    '/academic/promotion-candidates': {
      get: {
        tags: ['Academic'],
        summary: 'Fetch students eligible for end-of-year promotion',
        security: bearerSecurity,
        responses: { 200: { description: 'Candidates list' } }
      }
    },
    '/academic/rollover-session': {
      post: {
        tags: ['Academic'],
        summary: 'Execute annual session rollover and batch student promotion',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nextSession', 'promotions'],
                properties: {
                  nextSession: { type: 'string', example: '2026/2027' },
                  promotions: { type: 'array', items: { type: 'object' } }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Session rollover executed' } }
      }
    },
    '/academic/sessions': {
      get: {
        tags: ['Academic'],
        summary: 'List academic sessions and terms',
        security: bearerSecurity,
        responses: { 200: { description: 'Academic sessions and active term' } }
      }
    },
    '/settings': {
      get: {
        tags: ['Settings'],
        summary: 'Get institution settings',
        security: bearerSecurity,
        responses: { 200: { description: 'Current institution settings' } }
      },
      put: {
        tags: ['Settings'],
        summary: 'Update institution settings',
        security: bearerSecurity,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  institutionName: { type: 'string' },
                  officialEmail: { type: 'string' },
                  phone: { type: 'string' },
                  address: { type: 'string' },
                  website: { type: 'string' },
                  registrationNumber: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Updated settings' } }
      }
    }
  }
};
