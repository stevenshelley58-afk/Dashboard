#!/usr/bin/env node
/** Verify all required tools are installed */
import { ToolVerifier } from '../utils/tool_verifier.js';

const verifier = new ToolVerifier();
const stack = verifier.verifyStack();

console.log('\n📋 Tool Verification Report\n');
console.log('Core Tools:');
Object.entries(stack.core).forEach(([tool, available]) => {
  console.log(`  ${tool}: ${available ? '✅' : '❌'}`);
});

console.log('\nCLI Tools:');
Object.entries(stack.clis).forEach(([tool, available]) => {
  console.log(`  ${tool}: ${available ? '✅' : '❌'}`);
});

if (stack.missing.length > 0) {
  console.log(`\n⚠️  Missing tools: ${stack.missing.join(', ')}`);
  console.log('Install missing tools before proceeding.\n');
  process.exit(1);
} else {
  console.log('\n✅ All tools verified!\n');
  process.exit(0);
}

