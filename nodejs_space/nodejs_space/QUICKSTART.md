# VCTT-AGI Engine - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Python 3.11+
- Valid OpenAI API key (get one at https://platform.openai.com/api-keys)

### Step 1: Configure API Key
```bash
cd /home/ubuntu/vctt_agi_engine
nano .env
```

Replace `sk-test-mock-key-for-local-development` with your real OpenAI API key.

### Step 2: Verify Service is Running
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "VCTT-AGI Engine",
  "database": "connected"
}
```

### Step 3: View API Documentation
Open in your browser: **http://localhost:8000/docs**

### Step 4: Test Analysis Endpoint
```bash
curl -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Renewable energy is essential because it reduces emissions. However, costs are high.",
    "user_id": "quickstart_user"
  }'
```

### Step 5: Run Tests
```bash
cd /home/ubuntu/vctt_agi_engine
pytest tests/ -v
```

Expected: All 21 tests should pass ✅

---

## 📖 Next Steps

- **Read the docs**: Check `DEPLOYMENT.md` for full deployment guide
- **Explore API**: Try different endpoints in Swagger UI
- **Check tests**: Review `TESTING.md` for test details
- **Review architecture**: See `docs/ARCHITECTURE.md`

---

## 🆘 Common Issues

### Issue: Analysis endpoint returns error
**Solution**: Make sure you have a valid OpenAI API key in `.env`

### Issue: Server not running
**Solution**: Start it with:
```bash
cd /home/ubuntu/vctt_agi_engine
python3 -m uvicorn vctt_agi.api.main:app --reload
```

### Issue: Tests failing
**Solution**: Check environment variables:
```bash
export OPENAI_API_KEY=sk-test-mock-key
export DATABASE_URL=sqlite:///:memory:
pytest tests/ -v
```

---

## 📞 Resources

- **API Docs**: http://localhost:8000/docs
- **Full Deployment Guide**: `DEPLOYMENT.md`
- **Testing Guide**: `TESTING.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.txt`

---

**Status**: Service is running and ready to use! 🎉
