
# Phase 2 Deployment Guide

**Status**: Ready for production deployment ✅  
**Version**: v2.0.0-phase2  
**Date**: November 17, 2025

---

## ✅ Pre-Deployment Checklist

- ✅ PostgreSQL integration complete
- ✅ All analytics endpoints working
- ✅ UI updated with session history & trust indicators
- ✅ All tests passing (9/9)
- ✅ Documentation updated
- ✅ Git commits tagged (v2.0.0-phase2)

---

## 🚀 Deployment Instructions

### Option 1: Deploy via Platform UI (Recommended)

#### Backend Deployment

**Using the Platform Checkpoint System:**

1. **Save Checkpoint** (if not already done):
   - The assistant will create a checkpoint using `build_and_save_nodejs_service_checkpoint`
   - Checkpoint name: "Phase 2 PostgreSQL Analytics Complete"

2. **Deploy via UI**:
   - Go to your platform dashboard
   - Navigate to the service checkpoints
   - Select the "Phase 2 PostgreSQL Analytics Complete" checkpoint
   - Click "Deploy to Production"
   - The platform will automatically:
     - Build the service
     - Set up PostgreSQL database
     - Configure environment variables
     - Deploy to a public URL

**Environment Variables Needed:**
```
OPENAI_API_KEY=sk-your-key-here
DATABASE_URL=postgresql://... (auto-configured by platform)
PORT=8000 (optional, defaults to 8000)
```

#### UI Deployment

**Using Vercel (Current Setup):**

1. Go to https://vercel.com/dashboard
2. Import the `vctt_agi_ui` repository
3. Configure build settings:
   - Framework: Vite
   - Build Command: `yarn build`
   - Output Directory: `dist`
4. Set environment variable:
   ```
   VITE_API_URL=https://your-backend-url.com
   ```
5. Deploy

**OR Deploy via CLI:**
```bash
cd /home/ubuntu/vctt_agi_ui
vercel --prod
```

---

### Option 2: Manual Deployment (Alternative)

#### Backend to Render.com

1. Connect GitHub repository to Render
2. Create new Web Service:
   - Name: `vctt-agi-backend`
   - Environment: Node
   - Build Command: `cd nodejs_space && yarn install && yarn build`
   - Start Command: `cd nodejs_space && yarn start:prod`
3. Add PostgreSQL database (included in plan)
4. Set environment variables:
   ```
   OPENAI_API_KEY=sk-...
   DATABASE_URL=<auto-populated by Render>
   ```
5. Deploy

#### UI to Vercel

(Same as Option 1 above)

---

## 🔗 URLs After Deployment

### Backend
- Production URL: `https://your-backend-service.onrender.com`
- API Docs: `https://your-backend-service.onrender.com/api`
- Health: `https://your-backend-service.onrender.com/health`

### Frontend
- Production URL: `https://vcttagiui.vercel.app` (or your custom domain)

---

## ✅ Post-Deployment Verification

### 1. Test Backend Health
```bash
curl https://your-backend-url.com/health
# Should return: {"status":"healthy"...}
```

### 2. Test Analytics Endpoints
```bash
# List sessions
curl https://your-backend-url.com/analytics/sessions

# Trust metrics
curl https://your-backend-url.com/analytics/trust-metrics

# Aggregate stats
curl https://your-backend-url.com/analytics/aggregate
```

### 3. Test Session Creation
```bash
curl -X POST https://your-backend-url.com/api/v1/session/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"prod_test","input":"Hello from production!"}'
```

### 4. Test UI
1. Open `https://vcttagiui.vercel.app`
2. Verify "Analytics" button is visible
3. Click "Analytics" - should show dashboard
4. Create new chat - verify trust indicator displays
5. Check session list shows trust scores

---

## 🐛 Troubleshooting

### Backend Issues

**Problem**: Database connection error
- **Solution**: Verify `DATABASE_URL` environment variable is set
- Check PostgreSQL database is running

**Problem**: OpenAI API errors
- **Solution**: Verify `OPENAI_API_KEY` is correct
- Check API quota/billing

**Problem**: 500 errors on analytics endpoints
- **Solution**: Check database has data (create test sessions first)
- Review server logs

### UI Issues

**Problem**: "Failed to fetch sessions"
- **Solution**: Verify `VITE_API_URL` points to correct backend
- Check CORS is enabled on backend

**Problem**: Analytics dashboard empty
- **Solution**: Create some sessions first
- Backend must have PostgreSQL data

**Problem**: Trust indicator not showing
- **Solution**: Ensure backend returns trust_tau in responses
- Check console for errors

---

## 📊 Expected Performance

### Backend
- **Response Time**: < 100ms for analytics
- **Database Queries**: < 50ms
- **Session Creation**: < 2s (includes OpenAI API call)
- **Concurrent Users**: 1000+

### UI
- **Load Time**: < 2s
- **Time to Interactive**: < 3s
- **Analytics Dashboard**: < 1s to load

---

## 🔒 Security Checklist

- ✅ Environment variables used for secrets
- ✅ Database credentials not in code
- ✅ CORS configured for production domains
- ✅ Input validation on all endpoints
- ⚠️ Add rate limiting (Phase 3)
- ⚠️ Add authentication (Phase 3)

---

## 📈 Monitoring

### Key Metrics to Watch
1. **Database Size**: Should grow steadily
2. **Session Count**: Track user engagement
3. **Average Trust Score**: Should be > 0.85
4. **Error Rate**: Should be < 1%
5. **Response Time**: Should be < 100ms

### Recommended Tools
- Render dashboard for backend metrics
- Vercel analytics for UI metrics
- PostgreSQL monitoring (via Render)
- OpenAI API usage dashboard

---

## 🔄 Rolling Back

If deployment issues occur:

### Backend
1. In platform UI, select previous checkpoint
2. Redeploy

### UI
1. In Vercel dashboard, go to Deployments
2. Select previous successful deployment
3. Click "Promote to Production"

---

## 📱 Database Migrations

For future schema changes:
```bash
# Generate migration
cd /home/ubuntu/vctt_agi_engine/nodejs_space
yarn typeorm migration:generate -n MigrationName

# Run migrations
yarn typeorm migration:run
```

---

## 🎯 Success Criteria

Phase 2 deployment is successful when:

- ✅ Backend accessible at production URL
- ✅ All 9 tests passing in production
- ✅ Analytics endpoints returning data
- ✅ UI loading with backend data
- ✅ Trust indicators visible in UI
- ✅ Analytics dashboard functional
- ✅ Sessions persisting across restarts
- ✅ No errors in production logs

---

## 📞 Support

If issues persist:
1. Check server logs (Render dashboard)
2. Check browser console (for UI issues)
3. Review `test-phase2.sh` results
4. Verify environment variables are set
5. Check database connections

---

## 🎉 Next Steps After Deployment

1. Monitor for 24 hours
2. Verify user sessions are being created
3. Check analytics data is accumulating
4. Review trust metric trends
5. Plan Phase 3 features

---

**Deployment Prepared By**: VCTT-AGI Development Team  
**Last Updated**: November 17, 2025  
**Version**: 2.0.0-phase2
