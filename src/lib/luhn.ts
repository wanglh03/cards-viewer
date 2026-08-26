export type LuhnPattern = { runLength: number; count: number; digits: { suffixDigit: number; count: number }[] };

export const LUHN_MIN_KNOWN_DIGITS = 6;
export const LUHN_AUTO_CALCULATE_DIGITS = 6;
export const LUHN_MAX_KNOWN_DIGITS = 15;
export const LUHN_PAGE_SIZE = 100;

function contribution(digit: number, doubled: boolean) {
  const value = doubled ? digit * 2 : digit;
  return value > 9 ? value - 9 : value;
}

function knownRemainder(known: string, totalLength: number) {
  let remainder = 0;
  for (let position = 0; position < known.length; position += 1) {
    remainder = (remainder + contribution(Number(known[position]), (totalLength - position - 1) % 2 === 1)) % 10;
  }
  return remainder;
}

function patternCount(known: string, prefixLength: number, totalLength: number, runLength: number, suffixDigit: number) {
  const distributions = Array.from({ length: 11 }, () => Array.from({ length: runLength + 1 }, () => Array(10).fill(0)));
  distributions[10][0][knownRemainder(known, totalLength)] = 1;
  for (let position = 0; position < prefixLength; position += 1) {
    const next = Array.from({ length: 11 }, () => Array.from({ length: runLength + 1 }, () => Array(10).fill(0)));
    const doubled = (totalLength - known.length - position - 1) % 2 === 1;
    for (let last = 0; last <= 10; last += 1) for (let current = 0; current <= runLength; current += 1) for (let remainder = 0; remainder < 10; remainder += 1) {
      const count = distributions[last][current][remainder];
      if (!count) continue;
      for (let digit = 0; digit <= 9; digit += 1) {
        const nextRun = digit === last ? current + 1 : 1;
        if (nextRun > runLength) continue;
        next[digit][nextRun][(remainder + contribution(digit, doubled)) % 10] += count;
      }
    }
    distributions.splice(0, distributions.length, ...next);
  }
  let suffixContribution = 0;
  for (let position = 0; position < runLength; position += 1) suffixContribution += contribution(suffixDigit, (totalLength - known.length - prefixLength - position - 1) % 2 === 1);
  const needed = (10 - suffixContribution % 10) % 10;
  let count = 0;
  for (let last = prefixLength === 0 ? 10 : 0; last <= (prefixLength === 0 ? 10 : 9); last += 1) {
    if (prefixLength > 0 && last === suffixDigit) continue;
    for (let current = 0; current <= runLength; current += 1) count += distributions[last][current][needed];
  }
  return count;
}

function* prefixPatterns(length: number, maxRun: number): Generator<string> {
  if (length === 0) { yield ""; return; }
  function* exact(target: number): Generator<string> {
    function* visit(value: string, previous: number, current: number, longest: number): Generator<string> {
      if (value.length === length) { if (longest === target) yield value; return; }
      for (let digit = 0; digit <= 9; digit += 1) {
        const next = digit === previous ? current + 1 : 1;
        if (next <= target) yield* visit(value + digit, digit, next, Math.max(longest, next));
      }
    }
    yield* visit("", -1, 0, 0);
  }
  for (let target = Math.min(length, maxRun); target >= 1; target -= 1) yield* exact(target);
}

export function passesLuhn(value: string) {
  let sum = 0;
  let doubled = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    sum += contribution(Number(value[index]), doubled);
    doubled = !doubled;
  }
  return sum % 10 === 0;
}

export function getLuhnPatterns(known: string, totalLength: number): LuhnPattern[] {
  const remaining = totalLength - known.length;
  const patterns: LuhnPattern[] = [];
  for (let runLength = remaining; runLength >= 3; runLength -= 1) {
    const prefixLength = remaining - runLength;
    const digits = Array.from({ length: 10 }, (_, suffixDigit) => ({ suffixDigit, count: patternCount(known, prefixLength, totalLength, runLength, suffixDigit) })).filter((item) => item.count > 0);
    const count = digits.reduce((sum, item) => sum + item.count, 0);
    if (count) patterns.push({ runLength, count, digits });
  }
  return patterns;
}

export function getSpecifiedLuhnCount(known: string, totalLength: number, suffix: string) {
  const middleLength = totalLength - known.length - suffix.length;
  if (middleLength < 0) return 0;
  let distributions = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let suffixRemainder = 0;
  for (let index = 0; index < suffix.length; index += 1) suffixRemainder = (suffixRemainder + contribution(Number(suffix[index]), (totalLength - known.length - middleLength - index - 1) % 2 === 1)) % 10;
  for (let position = 0; position < middleLength; position += 1) {
    const next = Array(10).fill(0);
    const doubled = (totalLength - known.length - position - 1) % 2 === 1;
    for (let remainder = 0; remainder < 10; remainder += 1) for (let digit = 0; digit <= 9; digit += 1) next[(remainder + contribution(digit, doubled)) % 10] += distributions[remainder];
    distributions = next;
  }
  return distributions[(10 - ((knownRemainder(known, totalLength) + suffixRemainder) % 10)) % 10];
}

export function generateLuhnPage(known: string, totalLength: number, runLength: number, suffixDigit: number, page: number) {
  const prefixLength = totalLength - known.length - runLength;
  const numbers: string[] = [];
  let matched = 0;
  const suffix = String(suffixDigit).repeat(runLength);
  for (const variable of prefixPatterns(prefixLength, runLength)) {
    if (prefixLength > 0 && variable.at(-1) === suffix[0]) continue;
    const number = known + variable + suffix;
    if (!passesLuhn(number)) continue;
    if (matched++ < (page - 1) * LUHN_PAGE_SIZE) continue;
    numbers.push(number);
    if (numbers.length >= LUHN_PAGE_SIZE) break;
  }
  return numbers;
}

export function generateSpecifiedLuhnPage(known: string, totalLength: number, suffix: string, page: number) {
  const middleLength = totalLength - known.length - suffix.length;
  const numbers: string[] = [];
  let matched = 0;
  for (const middle of prefixPatterns(middleLength, middleLength || 1)) {
    const number = known + middle + suffix;
    if (!passesLuhn(number)) continue;
    if (matched++ < (page - 1) * LUHN_PAGE_SIZE) continue;
    numbers.push(number);
    if (numbers.length >= LUHN_PAGE_SIZE) break;
  }
  return numbers;
}

export function formatLuhnNumber(value: string, totalLength: number) {
  const groupSize = totalLength === 15 ? 5 : totalLength === 18 ? 6 : 4;
  return Array.from({ length: Math.ceil(value.length / groupSize) }, (_, index) => value.slice(index * groupSize, (index + 1) * groupSize)).join(" ");
}
