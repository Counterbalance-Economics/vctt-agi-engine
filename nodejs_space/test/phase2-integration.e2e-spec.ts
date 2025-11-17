
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Phase 2: PostgreSQL & Analytics Integration (e2e)', () => {
  let app: INestApplication;
  let testSessionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Session Persistence', () => {
    it('/api/v1/session/start (POST) - creates and persists session', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/session/start')
        .send({
          user_id: 'test_phase2_user',
          input: 'Hello, testing Phase 2!',
        })
        .expect(201);

      expect(response.body).toHaveProperty('session_id');
      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('internal_state');
      
      testSessionId = response.body.session_id;
    });

    it('/api/v1/session/step (POST) - adds messages to persisted session', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/session/step')
        .send({
          session_id: testSessionId,
          input: 'Follow-up message to test persistence',
        })
        .expect(201);

      expect(response.body).toHaveProperty('response');
      expect(response.body.internal_state).toHaveProperty('trust_tau');
    });

    it('/api/v1/session/:id (GET) - retrieves persisted session', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/session/${testSessionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('session_id', testSessionId);
      expect(response.body).toHaveProperty('messages');
      expect(response.body.messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Analytics Endpoints', () => {
    it('/analytics/sessions (GET) - lists all sessions', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/sessions')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('sessions');
      expect(Array.isArray(response.body.sessions)).toBe(true);
      expect(response.body.total).toBeGreaterThan(0);

      // Verify session structure
      if (response.body.sessions.length > 0) {
        const session = response.body.sessions[0];
        expect(session).toHaveProperty('session_id');
        expect(session).toHaveProperty('user_id');
        expect(session).toHaveProperty('created_at');
        expect(session).toHaveProperty('message_count');
        expect(session).toHaveProperty('trust_tau');
      }
    });

    it('/analytics/sessions/:sessionId/history (GET) - retrieves full session history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/sessions/${testSessionId}/history`)
        .expect(200);

      expect(response.body).toHaveProperty('session_id', testSessionId);
      expect(response.body).toHaveProperty('messages');
      expect(response.body).toHaveProperty('internal_state');
      expect(Array.isArray(response.body.messages)).toBe(true);
    });

    it('/analytics/trust-metrics (GET) - returns trust metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/trust-metrics')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('metrics');
      expect(Array.isArray(response.body.metrics)).toBe(true);

      if (response.body.metrics.length > 0) {
        const metric = response.body.metrics[0];
        expect(metric).toHaveProperty('session_id');
        expect(metric).toHaveProperty('trust_tau');
        expect(metric).toHaveProperty('timestamp');
        expect(metric).toHaveProperty('regulation');
      }
    });

    it('/analytics/aggregate (GET) - returns aggregate statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/aggregate')
        .expect(200);

      expect(response.body).toHaveProperty('overview');
      expect(response.body).toHaveProperty('trust_metrics');
      expect(response.body).toHaveProperty('repair_metrics');
      expect(response.body).toHaveProperty('regulation');

      expect(response.body.overview).toHaveProperty('total_sessions');
      expect(response.body.overview).toHaveProperty('total_messages');
      expect(response.body.trust_metrics).toHaveProperty('average_trust_tau');
    });

    it('/analytics/cross-session-patterns (GET) - returns pattern analysis', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/cross-session-patterns')
        .expect(200);

      expect(response.body).toHaveProperty('total_sessions');
      expect(response.body).toHaveProperty('patterns');
      expect(response.body).toHaveProperty('insights');
      expect(Array.isArray(response.body.patterns)).toBe(true);
      expect(Array.isArray(response.body.insights)).toBe(true);
    });
  });

  describe('Cross-Session Learning', () => {
    it('trust metrics should show evolution across multiple sessions', async () => {
      // Create multiple sessions
      const session1 = await request(app.getHttpServer())
        .post('/api/v1/session/start')
        .send({
          user_id: 'learning_test_user',
          input: 'First session',
        });

      const session2 = await request(app.getHttpServer())
        .post('/api/v1/session/start')
        .send({
          user_id: 'learning_test_user',
          input: 'Second session',
        });

      // Get trust metrics
      const metrics = await request(app.getHttpServer())
        .get('/analytics/trust-metrics?user_id=learning_test_user')
        .expect(200);

      expect(metrics.body.metrics.length).toBeGreaterThanOrEqual(2);
    });

    it('cross-session patterns should detect improvements', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/cross-session-patterns')
        .expect(200);

      expect(response.body.patterns).toContainEqual(
        expect.objectContaining({
          type: 'trust_evolution',
        })
      );

      expect(response.body.patterns).toContainEqual(
        expect.objectContaining({
          type: 'engagement',
        })
      );
    });
  });

  describe('Health Check', () => {
    it('/health (GET) - confirms database connection', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service');
    });
  });
});
