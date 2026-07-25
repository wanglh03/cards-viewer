(() => {
  "use strict";

  const MIN_KNOWN_DIGITS = 6;
  const AUTO_CALCULATE_DIGITS = 8;
  const MAX_KNOWN_DIGITS = 15;
  const MIN_RUN_LENGTH = 3;
  const PAGE_SIZE = 100;

  const lengthInput = document.querySelector("#cardLength");
  const lengthValue = document.querySelector("#cardLengthValue");
  const prefixInput = document.querySelector("#prefixInput");
  const prefixDigitCount = document.querySelector("#prefixDigitCount");
  const calculateButton = document.querySelector("#calculateButton");
  const status = document.querySelector("#luhnStatus");
  const patternTabs = document.querySelector("#patternTabs");
  const resultsEmpty = document.querySelector("#resultsEmpty");
  const resultsCount = document.querySelector("#resultsCount");
  const numberList = document.querySelector("#numberList");
  const pagination = document.querySelector("#pagination");
  const patternDigitTabs = document.querySelector("#patternDigitTabs");
  const suffixInput = document.querySelector("#suffixInput");
  const suffixDigitCount = document.querySelector("#suffixDigitCount");

  let activePattern = null;
  let activeDigit = null;
  let activeDigitCount = 0;
  let activeResults = [];
  let currentPage = 1;
  let hasCalculated = false;
  let suffix = "";

  function getGroupSize(totalLength) {
    if (totalLength === 15) return 5;
    if (totalLength === 18) return 6;
    return 4;
  }

  function formatCardNumber(number, totalLength) {
    const groupSize = getGroupSize(totalLength);
    const groups = [];
    for (let index = 0; index < number.length; index += groupSize) {
      groups.push(number.slice(index, index + groupSize));
    }
    return groups.join(" ");
  }

  function appendFormattedNumber(
    container,
    number,
    totalLength,
    highlightLength,
  ) {
    const groupSize = getGroupSize(totalLength);
    const suffixStart = number.length - highlightLength;
    for (let start = 0; start < number.length; start += groupSize) {
      const group = document.createElement("span");
      group.className = "number-group";
      const end = Math.min(start + groupSize, number.length);
      for (let index = start; index < end; index += 1) {
        const character = document.createTextNode(number[index]);
        if (highlightLength > 0 && index >= suffixStart) {
          const suffix = document.createElement("span");
          suffix.className = "number-suffix";
          suffix.append(character);
          group.append(suffix);
        } else {
          group.append(character);
        }
      }
      container.append(group);
    }
  }

  function getRawInput() {
    return prefixInput.value.replace(/\D/g, "").slice(0, MAX_KNOWN_DIGITS);
  }

  function getRawSpecifiedSuffix() {
    return suffixInput.value.replace(/\D/g, "").slice(0, 12);
  }

  function getSpecifiedSuffixLimit() {
    return Math.max(0, Number(lengthInput.value) - getRawInput().length);
  }

  function syncSpecifiedSuffixLimit() {
    const limit = getSpecifiedSuffixLimit();
    suffixInput.maxLength = limit;
    const raw = getRawSpecifiedSuffix();
    if (raw.length > limit) {
      suffixInput.value = raw.slice(0, limit);
    }
    suffix = getRawSpecifiedSuffix();
    suffixDigitCount.textContent = `${suffix.length} / ${limit} 位`;
  }

  function passesLuhn(number) {
    let sum = 0;
    let doubleDigit = false;
    for (let index = number.length - 1; index >= 0; index -= 1) {
      let digit = Number(number[index]);
      if (doubleDigit) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      doubleDigit = !doubleDigit;
    }
    return sum % 10 === 0;
  }

  function getDigitContribution(digit, doubled) {
    const value = doubled ? digit * 2 : digit;
    return value > 9 ? value - 9 : value;
  }

  function getLongestRun(value) {
    let longest = 0;
    let current = 0;
    let previous = "";
    for (const digit of value) {
      current = digit === previous ? current + 1 : 1;
      longest = Math.max(longest, current);
      previous = digit;
    }
    return longest;
  }

  function getKnownRemainder(known, totalLength) {
    let remainder = 0;
    for (let position = 0; position < known.length; position += 1) {
      const doubled = (totalLength - position - 1) % 2 === 1;
      remainder =
        (remainder + getDigitContribution(Number(known[position]), doubled)) %
        10;
    }
    return remainder;
  }

  function getPatternCount(
    known,
    prefixLength,
    totalLength,
    runLength,
    suffixDigit,
  ) {
    const distributions = Array.from({ length: 11 }, () =>
      Array.from({ length: runLength + 1 }, () => Array(10).fill(0)),
    );
    const knownRemainder = getKnownRemainder(known, totalLength);
    const noPreviousDigit = 10;
    distributions[noPreviousDigit][0][knownRemainder] = 1;

    for (let position = 0; position < prefixLength; position += 1) {
      const next = Array.from({ length: 11 }, () =>
        Array.from({ length: runLength + 1 }, () => Array(10).fill(0)),
      );
      const absolutePosition = known.length + position;
      const doubled = (totalLength - absolutePosition - 1) % 2 === 1;

      for (let lastDigit = 0; lastDigit <= noPreviousDigit; lastDigit += 1) {
        for (let currentRun = 0; currentRun <= runLength; currentRun += 1) {
          for (let remainder = 0; remainder < 10; remainder += 1) {
            const count = distributions[lastDigit][currentRun][remainder];
            if (!count) continue;
            for (let digit = 0; digit <= 9; digit += 1) {
              const nextRun = digit === lastDigit ? currentRun + 1 : 1;
              if (nextRun > runLength) continue;
              const contribution = getDigitContribution(digit, doubled);
              next[digit][nextRun][(remainder + contribution) % 10] += count;
            }
          }
        }
      }
      distributions.splice(0, distributions.length, ...next);
    }

    let suffixContribution = 0;
    for (let position = 0; position < runLength; position += 1) {
      const absolutePosition = known.length + prefixLength + position;
      const doubled = (totalLength - absolutePosition - 1) % 2 === 1;
      suffixContribution += getDigitContribution(suffixDigit, doubled);
    }
    const neededRemainder = (10 - (suffixContribution % 10)) % 10;

    let count = 0;
      const firstLastDigit = prefixLength === 0 ? noPreviousDigit : 0;
      const lastLastDigit = prefixLength === 0 ? noPreviousDigit : 9;
      for (let lastDigit = firstLastDigit; lastDigit <= lastLastDigit; lastDigit += 1) {
      if (prefixLength === 0 || lastDigit !== suffixDigit) {
        for (let currentRun = 0; currentRun <= runLength; currentRun += 1) {
          count += distributions[lastDigit][currentRun][neededRemainder];
        }
      }
    }
    return count;
  }

  function* generatePrefixPatterns(prefixLength, maxRunLength) {
    if (prefixLength === 0) {
      yield "";
      return;
    }

    function* exactLongestRun(targetRun) {
      function* visit(value, previous, currentRun, longestRun) {
        if (value.length === prefixLength) {
          if (longestRun === targetRun) {
            yield value;
          }
          return;
        }
        for (let digit = 0; digit <= 9; digit += 1) {
          const nextRun = digit === previous ? currentRun + 1 : 1;
          if (nextRun > targetRun) continue;
          yield* visit(
            value + digit,
            digit,
            nextRun,
            Math.max(longestRun, nextRun),
          );
        }
      }
      yield* visit("", -1, 0, 0);
    }

    for (
      let targetRun = Math.min(prefixLength, maxRunLength);
      targetRun >= 1;
      targetRun -= 1
    ) {
      yield* exactLongestRun(targetRun);
    }
  }

  function generatePageNumbers(
    known,
    totalLength,
    runLength,
    suffixDigit,
    page,
  ) {
    const prefixLength = totalLength - known.length - runLength;
    if (prefixLength < 0) return [];

    const numbers = [];
    const skipCount = (page - 1) * PAGE_SIZE;
    let matchedCount = 0;
    const suffix = String(suffixDigit).repeat(runLength);
    const prefixPatterns = generatePrefixPatterns(prefixLength, runLength);

    outer: for (const variablePrefix of prefixPatterns) {
      if (prefixLength > 0 && variablePrefix.at(-1) === suffix[0]) continue;
      const number = known + variablePrefix + suffix;
      if (passesLuhn(number)) {
        if (matchedCount < skipCount) {
          matchedCount += 1;
          continue;
        }
        numbers.push(number);
      }
      if (numbers.length >= PAGE_SIZE) break outer;
    }
    return numbers;
  }

  function generateSpecifiedPageNumbers(known, totalLength, suffix, page) {
    const middleLength = totalLength - known.length - suffix.length;
    if (middleLength < 0) return [];
    const numbers = [];
    const skipCount = (page - 1) * PAGE_SIZE;
    let matchedCount = 0;
    const patterns = generatePrefixPatterns(middleLength, middleLength || 1);

    for (const middle of patterns) {
      const number = known + middle + suffix;
      if (!passesLuhn(number)) continue;
      if (matchedCount < skipCount) {
        matchedCount += 1;
        continue;
      }
      numbers.push(number);
      if (numbers.length >= PAGE_SIZE) break;
    }
    return numbers;
  }

  function getSpecifiedCount(known, totalLength, suffix) {
    const middleLength = totalLength - known.length - suffix.length;
    if (middleLength < 0) return 0;
    const distributions = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const knownRemainder = getKnownRemainder(known, totalLength);
    let suffixRemainder = 0;
    for (let index = 0; index < suffix.length; index += 1) {
      const position = known.length + middleLength + index;
      const doubled = (totalLength - position - 1) % 2 === 1;
      suffixRemainder =
        (suffixRemainder +
          getDigitContribution(Number(suffix[index]), doubled)) %
        10;
    }
    for (let position = 0; position < middleLength; position += 1) {
      const next = Array(10).fill(0);
      const absolutePosition = known.length + position;
      const doubled = (totalLength - absolutePosition - 1) % 2 === 1;
      for (let remainder = 0; remainder < 10; remainder += 1) {
        for (let digit = 0; digit <= 9; digit += 1) {
          const contribution = getDigitContribution(digit, doubled);
          next[(remainder + contribution) % 10] += distributions[remainder];
        }
      }
      distributions.splice(0, distributions.length, ...next);
    }
    return distributions[(10 - ((knownRemainder + suffixRemainder) % 10)) % 10];
  }

  function getAvailablePatterns(known, totalLength) {
    const remainingLength = totalLength - known.length;
    const patterns = [];
    for (
      let runLength = remainingLength;
      runLength >= MIN_RUN_LENGTH;
      runLength -= 1
    ) {
      const prefixLength = remainingLength - runLength;
      const digits = [];
      for (let suffixDigit = 0; suffixDigit <= 9; suffixDigit += 1) {
        const count = getPatternCount(
          known,
          prefixLength,
          totalLength,
          runLength,
          suffixDigit,
        );
        if (count > 0) digits.push({ suffixDigit, count });
      }
      const count = digits.reduce((total, item) => total + item.count, 0);
      if (count > 0) {
        patterns.push({ runLength, count, digits });
      }
    }
    return patterns;
  }

  function formatCount(count) {
    return count.toLocaleString("zh-CN");
  }

  function renderTabs(patterns) {
    patternTabs.innerHTML = "";
    patternDigitTabs.innerHTML = "";
    patternTabs.hidden = patterns.length === 0;
    patternDigitTabs.hidden = patterns.length === 0;
    patterns.forEach((pattern, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pattern-tab";
      button.dataset.runLength = String(pattern.runLength);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(index === 0));
      button.innerHTML = `${pattern.runLength}a<span class="pattern-tab-count">${formatCount(pattern.count)} 条</span>`;
      button.addEventListener("click", () => selectPattern(pattern, button));
      patternTabs.append(button);
    });
  }

  function renderDigitTabs(pattern) {
    patternDigitTabs.innerHTML = "";
    pattern.digits.forEach(({ suffixDigit, count }, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pattern-digit-tab";
      button.dataset.suffixDigit = String(suffixDigit);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(index === 0));
      button.innerHTML = `${pattern.runLength}a${suffixDigit}<span class="pattern-tab-count">${formatCount(count)} 条</span>`;
      button.addEventListener("click", () =>
        selectDigit(pattern, suffixDigit, button),
      );
      patternDigitTabs.append(button);
    });
  }

  function selectPattern(pattern, button) {
    activePattern = pattern;
    renderDigitTabs(pattern);
    currentPage = 1;
    patternTabs.querySelectorAll(".pattern-tab").forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    const firstDigit =
      pattern.digits.find((digit) => digit.suffixDigit === 0)?.suffixDigit ??
      pattern.digits[0]?.suffixDigit;
    if (firstDigit !== undefined) {
      selectDigit(
        pattern,
        firstDigit,
        patternDigitTabs.querySelector(".pattern-digit-tab"),
      );
    }
  }

  function selectDefaultPattern(patterns) {
    const pattern = patterns[0];
    if (!pattern) return;
    const selectedDigit =
      pattern.digits.find((digit) => digit.suffixDigit === 0) ||
      pattern.digits[0];
    if (!selectedDigit) return;

    const button = patternTabs.querySelector(
      `[data-run-length="${pattern.runLength}"]`,
    );
    selectPattern(pattern, button);
    const digitButton = patternDigitTabs.querySelector(
      `[data-suffix-digit="${selectedDigit.suffixDigit}"]`,
    );
    if (digitButton) {
      selectDigit(pattern, selectedDigit.suffixDigit, digitButton);
    }
  }

  function selectDigit(pattern, suffixDigit, button) {
    activePattern = pattern;
    activeDigit = suffixDigit;
    activeDigitCount =
      pattern.digits.find((item) => item.suffixDigit === suffixDigit)?.count ||
      0;
    activeResults = [];
    currentPage = 1;
    patternDigitTabs.querySelectorAll(".pattern-digit-tab").forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    renderResults();
  }

  function renderPagination(totalPages) {
    pagination.innerHTML = "";
    if (totalPages <= 1) {
      pagination.hidden = true;
      return;
    }

    pagination.hidden = false;
    const addPageButton = (label, page, disabled = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "page-button";
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener("click", () => {
        currentPage = page;
        renderResults();
      });
      pagination.append(button);
      return button;
    };

    addPageButton("上一页", currentPage - 1, currentPage === 1);
    const pageStart = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    const pageEnd = Math.min(totalPages, pageStart + 4);
    for (let page = pageStart; page <= pageEnd; page += 1) {
      const button = addPageButton(String(page), page);
      button.classList.toggle("is-active", page === currentPage);
      if (page === currentPage) button.setAttribute("aria-current", "page");
    }
    addPageButton("下一页", currentPage + 1, currentPage === totalPages);
  }

  function renderResults() {
    numberList.innerHTML = "";
    const start = (currentPage - 1) * PAGE_SIZE;
    if (suffix) {
      const totalCount = getSpecifiedCount(
        getRawInput(),
        Number(lengthInput.value),
        suffix,
      );
      activeResults = generateSpecifiedPageNumbers(
        getRawInput(),
        Number(lengthInput.value),
        suffix,
        currentPage,
      );
      const fragment = document.createDocumentFragment();
      activeResults.forEach((number) => {
        const item = document.createElement("div");
        item.className = "number-item";
        appendFormattedNumber(
          item,
          number,
          Number(lengthInput.value),
          suffix.length,
        );
        fragment.append(item);
      });
      numberList.append(fragment);
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      const endLabel = Math.min(start + PAGE_SIZE, totalCount);
      resultsCount.textContent = `后缀 ${suffix} · 显示 ${totalCount ? start + 1 : 0}-${endLabel} / 共 ${totalCount} 条`;
      resultsEmpty.hidden = totalCount > 0;
      if (!totalCount) resultsEmpty.textContent = "没有符合 Luhn 校验的卡号。";
      renderPagination(totalPages);
      return;
    }
    activeResults = generatePageNumbers(
      getRawInput(),
      Number(lengthInput.value),
      activePattern.runLength,
      activeDigit,
      currentPage,
    );
    const pageResults = activeResults;
    const fragment = document.createDocumentFragment();
    pageResults.forEach((number) => {
      const item = document.createElement("div");
      item.className = "number-item";
      appendFormattedNumber(
        item,
        number,
        Number(lengthInput.value),
        activePattern.runLength,
      );
      fragment.append(item);
    });
    numberList.append(fragment);

    const totalPages = Math.max(1, Math.ceil(activeDigitCount / PAGE_SIZE));
    const totalCount = activeDigitCount;
    const startLabel = activeResults.length ? start + 1 : 0;
    const endLabel = Math.min(start + PAGE_SIZE, totalCount);
    resultsCount.textContent = `${activePattern.runLength}a${activeDigit} · 显示 ${formatCount(startLabel)}-${formatCount(endLabel)} / 共 ${formatCount(totalCount)} 条`;
    renderPagination(totalPages);
  }

  function clearResults(message) {
    patternTabs.innerHTML = "";
    patternDigitTabs.innerHTML = "";
    numberList.innerHTML = "";
    resultsCount.textContent = "";
    resultsEmpty.hidden = false;
    resultsEmpty.textContent = message;
    pagination.hidden = true;
    activePattern = null;
    activeDigit = null;
    activeDigitCount = 0;
    activeResults = [];
  }

  function appendSpecifiedResults() {
    const suffix = getRawSpecifiedSuffix();
    suffixInput.value = suffix;
    if (!suffix) {
      clearResults("请输入要匹配的后缀。");
      return;
    }
    if (suffix.length < 4) {
      clearResults("后缀至少输入 4 位数字。");
      return;
    }
    if (getRawInput().length + suffix.length > Number(lengthInput.value)) {
      clearResults("前缀和后缀不能超过卡号总位数。");
      return;
    }
    suffix = suffix;
    currentPage = 1;
    update({ force: true });
  }

  function update({ force = false } = {}) {
    const totalLength = Number(lengthInput.value);
    const known = getRawInput();
    syncSpecifiedSuffixLimit();
    const hasSpecifiedSuffix = Boolean(suffix);
    patternTabs.hidden = hasSpecifiedSuffix;
    patternDigitTabs.hidden = hasSpecifiedSuffix;
    lengthValue.value = `${totalLength} 位`;
    lengthValue.textContent = `${totalLength} 位`;
    prefixDigitCount.textContent = `${known.length} 位`;

    if (known.length < MIN_KNOWN_DIGITS) {
      status.textContent = "等待输入";
      status.classList.remove("is-ready");
      clearResults(
        "输入 6 位数字后，按回车或点击计算按钮开始计算。达到 8 位时自动计算。",
      );
      return;
    }
    if (hasSpecifiedSuffix && suffix.length < 4) {
      status.textContent = "等待后缀";
      status.classList.remove("is-ready");
      clearResults("后缀至少输入 4 位数字后开始计算。");
      return;
    }
    if (!force && known.length < AUTO_CALCULATE_DIGITS) {
      status.textContent = "等待确认";
      status.classList.remove("is-ready");
      clearResults("当前前缀少于 8 位，请按回车或点击计算按钮开始计算。");
      return;
    }
    if (known.length >= totalLength) {
      status.textContent = "前缀过长";
      status.classList.remove("is-ready");
      clearResults("已知数字需要少于卡号总位数，才能补全后缀。");
      return;
    }

    if (hasSpecifiedSuffix) {
      status.textContent = "已完成计算";
      status.classList.add("is-ready");
      renderResults();
      return;
    }

    patternTabs.hidden = false;
    patternDigitTabs.hidden = false;

    const patterns = getAvailablePatterns(known, totalLength);
    status.textContent = "已完成计算";
    status.classList.add("is-ready");
    renderTabs(patterns);
    resultsEmpty.hidden = patterns.length > 0;
    numberList.innerHTML = "";
    resultsCount.textContent = "";
    pagination.hidden = true;
    hasCalculated = true;

    if (!patterns.length) {
      patternTabs.hidden = true;
      patternDigitTabs.hidden = true;
      patternDigitTabs.innerHTML = "";
      resultsEmpty.textContent = "没有符合 Luhn 校验的后缀模式。";
      return;
    }
    selectDefaultPattern(patterns);
  }

  function syncInputDisplay() {
    prefixInput.value = formatCardNumber(
      getRawInput(),
      Number(lengthInput.value),
    );
  }

  prefixInput.addEventListener("input", () => {
    syncInputDisplay();
    update({ force: getRawInput().length >= AUTO_CALCULATE_DIGITS });
  });
  prefixInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    update({ force: true });
  });
  calculateButton.addEventListener("click", () => {
    if (getRawSpecifiedSuffix()) {
      appendSpecifiedResults();
    } else {
      update({ force: true });
    }
  });
  suffixInput.addEventListener("input", () => {
    const before = suffixInput.value;
    syncSpecifiedSuffixLimit();
    suffix = suffixInput.value;
    if (!suffix) {
      patternTabs.hidden = false;
      patternDigitTabs.hidden = false;
      update();
      return;
    }
    patternTabs.hidden = true;
    patternDigitTabs.hidden = true;
    update({ force: suffix.length >= 4 });
  });
  suffixInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      appendSpecifiedResults();
    }
  });
  lengthInput.addEventListener("input", () => {
    syncInputDisplay();
    syncSpecifiedSuffixLimit();
    update({
      force: getRawInput().length >= AUTO_CALCULATE_DIGITS || hasCalculated,
    });
  });
  syncSpecifiedSuffixLimit();
  update();
})();
