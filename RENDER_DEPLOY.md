
# 🚀 RENDER DEPLOYMENT GUIDE - 5 MINUTES

## ✅ QUICK DEPLOY (Recommended)

### 1. **Go to Render Dashboard**
https://dashboard.render.com/

### 2. **Click "New +" → "Web Service"**

### 3. **Connect GitHub Repository**
- Repository: `Counterbalance-Economics/vctt-agi-engine`
- Branch: `main`

### 4. **Configure Service**

```yaml
Name: vctt-agi-engine
Runtime: Node
Region: Oregon (or closest to you)
Branch: main
Build Command: npm install && npm run build
Start Command: npm run start:prod
```

### 5. **Add Environment Variables**

Click "Advanced" → Add Environment Variables:

```bash
NODE_ENV=production
PORT=8000
OPENAI_API_KEY=your_openai_api_key_here
MAX_REPAIR_ITERATIONS=3
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.7
```

**Database URL (if using Render Postgres):**
```bash
DATABASE_URL=postgresql://user:password@host:5432/database
```

### 6. **Select Plan**
- Free Tier: Good for testing (spins down after 15 min inactivity)
- Starter: $7/mo (always on)

### 7. **Click "Create Web Service"**

### 8. **Wait 2-3 Minutes**
Render will:
- ✅ Clone repository
- ✅ Install dependencies (npm install)
- ✅ Build application (npm run build)
- ✅ Deploy to production
- ✅ Give you public URL: `https://vctt-agi-engine.onrender.com`

---

## ✅ VERIFICATION

Once deployed, test these endpoints:

```bash
# Health check
curl https://vctt-agi-engine.onrender.com/health

# Swagger docs
https://vctt-agi-engine.onrender.com/api

# Start session
curl -X POST https://vctt-agi-engine.onrender.com/api/v1/session/start \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "input": "Hello"}'
```

---

## 🔧 TROUBLESHOOTING

### Build Failed?
Check logs in Render dashboard → Logs tab

### Database Connection Error?
Verify DATABASE_URL environment variable is set correctly

### API Key Error?
Verify OPENAI_API_KEY is set in environment variables

---

## 📊 CONFIGURATION FILES

✅ `render.yaml` - Auto-detected by Render
✅ `.node-version` - Forces Node 18.18.0
✅ `.npmrc` - Engine strict mode
✅ `package.json` - Engines field for Node 18.x

---

## 🎯 NEXT STEPS AFTER DEPLOYMENT

1. **Get Backend URL** from Render dashboard
   - Example: `https://vctt-agi-engine.onrender.com`

2. **Update Frontend UI**
   ```bash
   cd /home/ubuntu/vctt_agi_ui
   export VITE_BACKEND_URL=https://vctt-agi-engine.onrender.com
   npm run build
   vercel --prod --token CTzKecV7IAIveJ5XRzz3oY4t --yes
   ```

3. **Test Full Stack**
   - Frontend: https://vcttagiui.vercel.app
   - Backend: https://vctt-agi-engine.onrender.com
   - API Docs: https://vctt-agi-engine.onrender.com/api

---

## 🚀 DEPLOYMENT COMPLETE!

**Total Time:** 3-5 minutes
**Status:** Production Ready
**Cost:** Free (or $7/mo for always-on)

---
