/** Catch common vague date requests without guessing a time period. */
export function initialRuleQuestion(instruction: string): string | null {
  if (/\bolder\s+than\b/i.test(instruction)) return "Tidy cannot select files older than a cutoff yet. Should I include all dates instead, or use a recent-date filter?";
  const vague = /\b(?:old|recent|recently)\b/i.test(instruction);
  const hasPeriod = /\b(?:today|yesterday|day|days|week|weeks|month|months|year|years|all dates|any time)\b/i.test(instruction);
  return vague && !hasPeriod ? "Which date range do you mean? Tidy can include all dates, or files modified within the past day, week, month, or year. Older-than cutoffs are not supported yet." : null;
}
