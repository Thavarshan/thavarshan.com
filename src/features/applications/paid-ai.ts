/**
 * Paid-API kill switch. Calling the OpenAI API costs real money, and this project must cost nothing
 * unless the owner deliberately opts in. The API key alone is NOT enough: the explicit flag
 * `ENABLE_PAID_AI=true` is also required for explicit AI mode. The workflow defaults to free template mode.
 */
export function paidAiEnabled(env: Record<string, string | undefined>): boolean {
  return env.ENABLE_PAID_AI === "true";
}
