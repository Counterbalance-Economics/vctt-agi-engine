import { Controller, Get } from '@nestjs/common';

@Controller('api/system')
export class SystemController {
  @Get('env-check')
  checkEnvironment() {
    return {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasAbacusAI: !!process.env.ABACUSAI_API_KEY,
      hasXAI: !!process.env.XAI_API_KEY,
      openaiPrefix: process.env.OPENAI_API_KEY?.substring(0, 7) || 'missing',
      xaiPrefix: process.env.XAI_API_KEY?.substring(0, 7) || 'missing',
      abacusPrefix: process.env.ABACUSAI_API_KEY?.substring(0, 7) || 'missing',
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
    };
  }
}
