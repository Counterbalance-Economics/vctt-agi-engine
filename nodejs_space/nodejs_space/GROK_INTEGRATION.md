# 🤖 Grok Integration - VCTT-AGI Phase 3

## Overview

**Grok (xAI)** has been integrated as a dedicated verification and fact-checking layer in the VCTT-AGI Engine. This enhancement adds real-time web access and truth-seeking capabilities to strengthen the Trust (τ) metric.

## Why Grok?

1. **Real-time access**: Native web search and X (Twitter) semantic search
2. **Truth-seeking focus**: Built to maximize curiosity and minimize bias  
3. **Cost-effective**: Only invoked selectively for verification scenarios (~$0.005/call)
4. **Trust enhancement**: Acts as a "reality anchor" for low-confidence scenarios

## Architecture

### Integration Points

**LLM Service** (`src/services/llm.service.ts`):
- New method: `verifyWithGrok(query, options)`
- Dedicated Grok API client with cost tracking
- Hourly rate limiting (max 20 verifications/hour)
- Separate usage stats for verification calls

**Synthesiser Agent** (`src/agents/synthesiser.agent.ts`):
- Automatic verification trigger when Trust (τ) < 0.8
- Keyword detection for real-time queries ("latest", "current", "verify", etc.)
- Verification results appended to responses

### Configuration

**File**: `src/config/llm.config.ts`

```typescript
models: {
  primary: 'gpt-4o',
  fallback: 'claude-3-5-sonnet-20241022',
  verification: 'grok-beta'  // NEW
}

verification: {
  enableWebSearch: true,
  enableXSearch: true,
  minTrustForVerification: 0.8,
  maxVerificationsPerHour: 20
}
```

## Usage

### Automatic Verification

The system automatically triggers Grok verification when:
1. Trust (τ) drops below 0.8
2. User query contains verification keywords
3. Hourly limit not exceeded

**Example keywords**:
- Time-sensitive: "latest", "recent", "current", "today"
- Factual: "verify", "fact check", "accurate", "statistics"
- Informational: "what is", "who is", "when did"

### Manual Verification (API)

```typescript
// In any service/agent
const verification = await this.llmService.verifyWithGrok(
  'What are the latest developments in AI?',
  {
    enableWebSearch: true,
    enableXSearch: false,
    context: 'Optional context for verification'
  }
);

console.log(verification.content); // Grok's verified response
console.log(verification.cost);    // Cost in USD
console.log(verification.model);   // 'grok-beta'
```

## Cost Analysis

### Pricing
- **Input**: $5.00 per 1M tokens
- **Output**: $15.00 per 1M tokens
- **Typical call**: ~$0.005 per verification

### Budget Impact
- **Estimated usage**: 10-20 verifications/day
- **Daily cost**: $0.05 - $0.10
- **Monthly cost**: ~$1.50 - $3.00
- **Total LLM budget**: Still well under $200/month

### Cost Controls
1. Hourly rate limit: 20 verifications max
2. Only triggers on low trust (τ < 0.8)
3. Keyword detection prevents unnecessary calls
4. Daily budget checks prevent overspending

## Response Format

When verification is triggered, responses include:

```
[Original GPT-4o/Claude response]

---
🔍 Verification (Grok): [Verified facts and sources from Grok]
```

## Environment Setup

### Required API Key

Add to `.env` and Render environment:

```bash
# xAI Grok API Key (get from https://console.x.ai/)
XAI_API_KEY=xai-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Getting Your API Key

1. Go to https://console.x.ai/
2. Sign in with your xAI account
3. Navigate to API Keys
4. Create a new API key
5. Copy and add to environment

## Monitoring

### Logs

Watch for Grok activity:
```bash
🔍 Low trust detected (τ=0.75), invoking Grok for verification...
🔍 Grok verification request: "What's the latest on..."
✅ Grok verification added - cost: $0.0045
```

### Analytics

Grok usage tracked separately in:
- `usageStats.modelBreakdown['grok-beta']`
- Per-message metadata (when verification used)
- Hourly verification count logs

## Testing

### Test Scenarios

1. **Low trust query**: Ask complex question to trigger τ < 0.8
2. **Real-time query**: "What's the latest news on AI?"
3. **Fact-check**: "Verify: Did X happen in 2024?"

### Expected Behavior

- Grok only invokes on qualifying scenarios
- Verification appended to response
- Cost tracked in analytics
- Rate limit enforced

## Phase 3 Completion

With Grok integration:
- ✅ Enhanced Trust (τ) with real-time verification
- ✅ Multi-model LLM stack (GPT-4o + Claude + Grok)
- ✅ Advanced cost tracking and rate limiting
- ✅ Production-ready verification layer

**Phase 3 Progress**: ~50% complete

## Next Steps

1. Add Grok to Ethics Agent for real-time ethical guidance
2. Enable X search for sentiment analysis
3. Add verification confidence scores to Trust (τ) calculation
4. Create admin dashboard for verification analytics

---

**Documentation**: Phase 3 Grok Integration
**Author**: VCTT-AGI Development Team
**Date**: 2025-11-18
