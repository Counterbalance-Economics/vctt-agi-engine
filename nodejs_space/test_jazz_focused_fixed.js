const axios = require('axios');
const fs = require('fs');

const PREVIEW_URL = 'https://34db5da34.preview.abacusai.app';

const TEST_SCENARIOS = [
  {
    id: 1,
    scenario: 'Simple type annotation',
    filePath: 'utils/helpers.ts',
    instruction: 'Add TypeScript type annotations',
    originalCode: 'function add(a, b) { return a + b; }',
    language: 'typescript',
    expectedComplexity: 'simple'
  },
  {
    id: 2,
    scenario: 'Error handling enhancement',
    filePath: 'api/users.ts',
    instruction: 'Add comprehensive error handling with logging',
    originalCode: `async function fetchUser(id) {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}`,
    language: 'typescript',
    expectedComplexity: 'medium'
  },
  {
    id: 3,
    scenario: 'Security enhancement with rate limiting',
    filePath: 'middleware/auth.ts',
    instruction: 'Add Zod validation, rate limiting, and comprehensive security measures',
    originalCode: `export async function login(req, res) {
  const { email, password } = req.body;
  const user = await authenticateUser(email, password);
  res.json({ token: generateToken(user) });
}`,
    language: 'typescript',
    expectedComplexity: 'complex'
  },
  {
    id: 4,
    scenario: 'React performance optimization',
    filePath: 'components/UserList.tsx',
    instruction: 'Optimize to prevent unnecessary re-renders using React.memo and useCallback',
    originalCode: `function UserList({ users, onSelect }) {
  return (
    <div>
      {users.map(user => (
        <div onClick={() => onSelect(user)}>
          {user.name}
        </div>
      ))}
    </div>
  );
}`,
    language: 'typescript',
    expectedComplexity: 'medium'
  },
  {
    id: 5,
    scenario: 'Database transaction with rollback',
    filePath: 'services/order.ts',
    instruction: 'Wrap in a database transaction with proper error handling and rollback',
    originalCode: `async function createOrder(userId, items) {
  const order = await db.orders.insert({ userId, status: 'pending' });
  await db.orderItems.insertMany(items.map(item => ({ orderId: order.id, ...item })));
  await db.inventory.decrementMany(items);
  return order;
}`,
    language: 'typescript',
    expectedComplexity: 'complex'
  }
];

function simulateUserAcceptance(jazz) {
  if (jazz.trust < 0.70) return false;
  if (jazz.trust >= 0.85 && jazz.voice >= 0.80 && jazz.choice >= 0.80 && jazz.transparency >= 0.80) {
    return true;
  }
  if (jazz.trust >= 0.75 && jazz.suggestions && jazz.suggestions.length >= 3) return true;
  return false;
}

async function runTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  FOCUSED JAZZ COUNTERFACTUAL TEST');
  console.log('  5 Diverse Scenarios | Grok 4.1 Fast Reasoning');
  console.log('  Target: https://34db5da34.preview.abacusai.app');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const results = [];
  
  for (const session of TEST_SCENARIOS) {
    const startTime = Date.now();
    
    try {
      console.log(`\n[Session ${session.id}] ${session.scenario}`);
      console.log(`  Complexity: ${session.expectedComplexity}`);
      console.log(`  Instruction: ${session.instruction}`);
      console.log(`  Processing...`);
      
      const response = await axios.post(
        `${PREVIEW_URL}/api/ide/code-edit`,
        {
          filePath: session.filePath,
          instruction: session.instruction,
          originalCode: session.originalCode,
          language: session.language
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 120000
        }
      );
      
      const processingTime = Date.now() - startTime;
      const jazz = response.data.jazzAnalysis.analysis;
      const suggestions = response.data.jazzAnalysis.suggestions || [];
      const userWouldAccept = simulateUserAcceptance(jazz);
      
      console.log(`  ✅ SUCCESS`);
      console.log(`  τ = ${jazz.trust.toFixed(3)} | V=${jazz.voice.toFixed(2)} | C=${jazz.choice.toFixed(2)} | T=${jazz.transparency.toFixed(2)}`);
      console.log(`  Suggestions: ${suggestions.length}`);
      console.log(`  User acceptance: ${userWouldAccept ? '✅ YES' : '❌ NO'}`);
      console.log(`  Processing time: ${(processingTime / 1000).toFixed(1)}s`);
      
      results.push({
        session,
        jazz,
        suggestions,
        userWouldAccept,
        processingTime,
        success: true
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.log(`  ❌ FAILED: ${error.message}`);
      console.log(`  Processing time: ${(processingTime / 1000).toFixed(1)}s`);
      
      results.push({
        session,
        jazz: { voice: 0, choice: 0, transparency: 0, trust: 0 },
        suggestions: [],
        userWouldAccept: false,
        processingTime,
        success: false,
        error: error.message
      });
    }
  }
  
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  ANALYSIS COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const successfulSessions = results.filter(r => r.success);
  const acceptedSessions = results.filter(r => r.userWouldAccept);
  
  if (successfulSessions.length === 0) {
    console.log('❌ No successful sessions. Cannot generate analysis.');
    return;
  }
  
  const avgTrust = successfulSessions.reduce((sum, r) => sum + r.jazz.trust, 0) / successfulSessions.length;
  const avgVoice = successfulSessions.reduce((sum, r) => sum + r.jazz.voice, 0) / successfulSessions.length;
  const avgChoice = successfulSessions.reduce((sum, r) => sum + r.jazz.choice, 0) / successfulSessions.length;
  const avgTrans = successfulSessions.reduce((sum, r) => sum + r.jazz.transparency, 0) / successfulSessions.length;
  const avgTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
  
  const allSuggestions = [];
  successfulSessions.forEach(r => allSuggestions.push(...r.suggestions));
  
  console.log('📊 SUMMARY:');
  console.log(`   Success Rate: ${(successfulSessions.length / results.length * 100).toFixed(1)}%`);
  console.log(`   Acceptance Rate: ${(acceptedSessions.length / results.length * 100).toFixed(1)}%`);
  console.log(`   Average τ: ${avgTrust.toFixed(3)}`);
  console.log(`   Average Voice: ${avgVoice.toFixed(3)}`);
  console.log(`   Average Choice: ${avgChoice.toFixed(3)}`);
  console.log(`   Average Transparency: ${avgTrans.toFixed(3)}`);
  console.log(`   Average Processing Time: ${(avgTime / 1000).toFixed(1)}s`);
  console.log(`   Total Suggestions: ${allSuggestions.length}`);
  
  // Save data
  fs.writeFileSync('/home/ubuntu/vctt_agi_engine/jazz_test_results.json', JSON.stringify({
    results,
    summary: {
      successRate: successfulSessions.length / results.length,
      acceptanceRate: acceptedSessions.length / results.length,
      avgTrust,
      avgVoice,
      avgChoice,
      avgTrans,
      avgTime,
      totalSuggestions: allSuggestions.length
    }
  }, null, 2));
  
  console.log(`\n✅ Results saved to: jazz_test_results.json\n`);
  console.log('\n🎉 Now generating comprehensive roadmap...\n');
}

runTest().catch(console.error);
