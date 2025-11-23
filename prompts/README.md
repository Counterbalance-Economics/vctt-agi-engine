
# VCTT-AGI Prompt Library

This directory contains versioned prompts for the MIN agent system.

## Prompt Files

- **min-agent-v1.txt**: Core MIN agent identity and capabilities
- **goal-decomposition-v1.txt**: Prompt for breaking down goals into subtasks
- **subtask-execution-v1.txt**: Prompt for executing individual subtasks

## Version History

### v1 (2025-11-23)
- Initial versioned prompts
- Explicit code generation authorization
- Safety boundaries clearly defined
- Production-grade instructions
- Jailbreak-resistant phrasing

## Integrity Protection

The `SystemIntegrityService` performs daily checks to ensure these prompts haven't been tampered with or accidentally modified. If a critical section (e.g., "Code generation is explicitly authorized") is missing, the canonical version is automatically restored.

## Usage

Prompts are loaded dynamically by services:
```typescript
import * as fs from 'fs';
const prompt = fs.readFileSync('prompts/min-agent-v1.txt', 'utf8');
```

## Environment Variables

- `ALLOW_CODE_GENERATION=true` (default) - Enables full code generation
- `MIN_AGENT_MODE=production` - Uses production prompts

## Testing

Run `yarn test:prompts` to verify prompt integrity and functionality.
