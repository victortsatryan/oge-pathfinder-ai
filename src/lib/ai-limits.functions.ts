import { createServerFn } from "@tanstack/react-start";
import {
  PER_USER_DAILY_LIMIT,
  GLOBAL_DAILY_API_LIMIT,
  checkLimits,
  resolveCallerFromRequest,
} from "@/lib/ai-gateway.server";

export const getAiLimitStatus = createServerFn({ method: "GET" }).handler(async () => {
  const caller = await resolveCallerFromRequest();
  const { userCount, globalApiCount } = await checkLimits(caller);
  return {
    perUserLimit: PER_USER_DAILY_LIMIT,
    globalLimit: GLOBAL_DAILY_API_LIMIT,
    userUsed: userCount,
    userRemaining: Math.max(0, PER_USER_DAILY_LIMIT - userCount),
    globalUsed: globalApiCount,
    globalExhausted: globalApiCount >= GLOBAL_DAILY_API_LIMIT,
    isAuthenticated: !!caller.userId,
  };
});
