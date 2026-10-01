/**
 * @license
 * Precision Calculator - Vanilla JavaScript Implementation
 * Pure ES6+, zero external libraries, frameworks, or dependencies.
 */

(function () {
  'use strict';

  // --- DOM Elements ---
  const currentDisplay = document.getElementById('current-display');
  const expressionDisplay = document.getElementById('expression-display');
  const errorBadge = document.getElementById('error-badge');
  const displayPanel = document.querySelector('.display-panel');
  const keypad = document.querySelector('.keypad-grid');
  const copyBtn = document.getElementById('copy-btn');
  const copyFeedback = document.getElementById('copy-feedback');
  const historyToggleBtn = document.getElementById('history-toggle-btn');
  const historyDrawer = document.getElementById('history-drawer');
  const historyCloseBtn = document.getElementById('history-close-btn');
  const historyClearBtn = document.getElementById('history-clear-btn');
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');

  // --- Calculator State Model ---
  const state = {
    // Current number string shown on the primary display
    displayValue: '0',
    // Formula text shown above the primary display (e.g. "12 + 5 =")
    expressionText: '',
    // Array of tokens for chained calculation: [number, operator, number, ...]
    tokens: [],
    // Set to true after clicking an operator; next number key replaces displayValue
    waitingForOperand: false,
    // Set to true right after '=' is pressed
    justEvaluated: false,
    // Holds last operation for repeated '=' presses: { operator, operand }
    lastOperation: null,
    // Active operator symbol currently selected ('+', '−', '×', '÷')
    activeOperator: null,
    // Error tracking
    hasError: false,
    errorMessage: '',
    // Calculation history log
    history: []
  };

  // --- Mathematical Utilities ---

  /**
   * Cleans floating point arithmetic artifacts (e.g. 0.1 + 0.2 = 0.30000000000000004)
   * Rounds to 12 significant digits.
   */
  function cleanFloat(num) {
    if (isNaN(num)) return NaN;
    if (!isFinite(num)) return num;
    return parseFloat(Number(num.toPrecision(12)).toString());
  }

  /**
   * Formats a number for display with commas and scientific notation for extreme numbers.
   */
  function formatNumber(num) {
    if (isNaN(num)) return 'Error';
    if (!isFinite(num)) return num > 0 ? 'Infinity' : '-Infinity';

    const cleaned = cleanFloat(num);
    const abs = Math.abs(cleaned);

    // Exponential notation for extreme numbers
    if (abs >= 1e13 || (abs < 1e-7 && abs > 0)) {
      return cleaned.toExponential(6).replace(/\+/, '');
    }

    const parts = cleaned.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  /**
   * Formats an input string currently being typed (preserves trailing decimal like "12." or "12.0")
   */
  function formatDisplayString(str) {
    if (!str || str === '0') return '0';
    if (str === '-') return '-';
    if (str === 'Cannot divide by 0' || str === 'Error' || str === 'Overflow') return str;

    const isNegative = str.startsWith('-');
    const raw = isNegative ? str.slice(1) : str;
    const parts = raw.split('.');

    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const formatted = parts.join('.');
    return isNegative ? '-' + formatted : formatted;
  }

  /**
   * Converts an array of tokens into a formatted display string
   */
  function formatTokensToExpression(tokens) {
    if (!tokens || tokens.length === 0) return '';
    let str = '';
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (typeof t === 'number') {
        str += formatNumber(t) + ' ';
      } else {
        str += t + ' ';
      }
    }
    return str.trim();
  }

  /**
   * Adjusts the font size of the primary display dynamically to prevent overflow
   */
  function adjustFontSize(text) {
    currentDisplay.classList.remove('font-md', 'font-sm', 'font-xs');
    const length = text.length;
    if (length > 15) {
      currentDisplay.classList.add('font-xs');
    } else if (length > 11) {
      currentDisplay.classList.add('font-sm');
    } else if (length > 8) {
      currentDisplay.classList.add('font-md');
    }
  }

  // --- Core Evaluation Engine ---

  /**
   * Evaluates an arithmetic token array using standard PEMDAS operator precedence.
   * Handles: +, −, -, ×, *, ÷, /
   * Returns: { success: boolean, value?: number, error?: string }
   */
  function evaluateTokens(tokenList) {
    if (!tokenList || tokenList.length === 0) {
      return { success: true, value: 0 };
    }

    const list = [...tokenList];

    // First Pass: Multiplications and Divisions (Left-to-Right)
    let i = 0;
    while (i < list.length) {
      const token = list[i];
      if (token === '×' || token === '*' || token === '÷' || token === '/') {
        const left = Number(list[i - 1]);
        const right = Number(list[i + 1]);

        if (isNaN(left) || isNaN(right)) {
          return { success: false, error: 'Invalid Expression' };
        }

        let result = 0;
        if (token === '×' || token === '*') {
          result = cleanFloat(left * right);
        } else {
          if (right === 0) {
            return { success: false, error: 'Cannot divide by 0' };
          }
          result = cleanFloat(left / right);
        }

        if (!isFinite(result)) {
          return { success: false, error: 'Overflow' };
        }

        list.splice(i - 1, 3, result);
        i -= 1;
      } else {
        i += 1;
      }
    }

    // Second Pass: Additions and Subtractions (Left-to-Right)
    i = 0;
    while (i < list.length) {
      const token = list[i];
      if (token === '+' || token === '−' || token === '-') {
        const left = Number(list[i - 1]);
        const right = Number(list[i + 1]);

        if (isNaN(left) || isNaN(right)) {
          return { success: false, error: 'Invalid Expression' };
        }

        let result = 0;
        if (token === '+') {
          result = cleanFloat(left + right);
        } else {
          result = cleanFloat(left - right);
        }

        if (!isFinite(result)) {
          return { success: false, error: 'Overflow' };
        }

        list.splice(i - 1, 3, result);
        i -= 1;
      } else {
        i += 1;
      }
    }

    const finalVal = Number(list[0]);
    if (isNaN(finalVal) || !isFinite(finalVal)) {
      return { success: false, error: 'Calculation Error' };
    }

    return { success: true, value: finalVal };
  }

  // --- UI Renderer ---

  function render() {
    // 1. Error state
    if (state.hasError) {
      displayPanel.classList.add('error-state');
      errorBadge.textContent = state.errorMessage;
      errorBadge.classList.add('visible');
      currentDisplay.textContent = state.errorMessage;
      currentDisplay.classList.add('text-error-state');
      adjustFontSize(state.errorMessage);
      expressionDisplay.textContent = state.expressionText;
      return;
    }

    displayPanel.classList.remove('error-state');
    errorBadge.classList.remove('visible');
    currentDisplay.classList.remove('text-error-state');

    // 2. Expression row (top line)
    expressionDisplay.textContent = state.expressionText;

    // 3. Primary result display
    const formatted = formatDisplayString(state.displayValue);
    currentDisplay.textContent = formatted;
    adjustFontSize(formatted);

    // 4. Highlight active operator button
    const opButtons = document.querySelectorAll('.btn-op');
    opButtons.forEach((btn) => {
      const btnOp = btn.getAttribute('data-operator');
      if (state.activeOperator && btnOp === state.activeOperator) {
        btn.classList.add('operator-active');
      } else {
        btn.classList.remove('operator-active');
      }
    });
  }

  // --- User Action Handlers ---

  /**
   * Reset the calculator completely
   */
  function handleClear() {
    state.displayValue = '0';
    state.expressionText = '';
    state.tokens = [];
    state.waitingForOperand = false;
    state.justEvaluated = false;
    state.lastOperation = null;
    state.activeOperator = null;
    state.hasError = false;
    state.errorMessage = '';
    render();
  }

  /**
   * Digit button press (0–9)
   */
  function handleNumber(digit) {
    if (state.hasError) {
      handleClear();
    }

    // If '=' was just evaluated, typing a number starts a fresh calculation
    if (state.justEvaluated) {
      state.displayValue = digit;
      state.expressionText = '';
      state.tokens = [];
      state.waitingForOperand = false;
      state.justEvaluated = false;
      state.lastOperation = null;
      state.activeOperator = null;
      render();
      return;
    }

    // If waiting for the next operand after an operator
    if (state.waitingForOperand) {
      state.displayValue = digit;
      state.waitingForOperand = false;
      state.activeOperator = null;
      render();
      return;
    }

    // Ongoing number input
    if (state.displayValue === '0') {
      state.displayValue = digit;
    } else if (state.displayValue === '-0') {
      state.displayValue = '-' + digit;
    } else {
      // Prevent overflow
      const rawDigits = state.displayValue.replace(/[^0-9]/g, '');
      if (rawDigits.length >= 15) {
        triggerDisplayShake();
        return;
      }
      state.displayValue += digit;
    }

    render();
  }

  /**
   * Decimal button press (.)
   */
  function handleDecimal() {
    if (state.hasError) {
      handleClear();
    }

    if (state.justEvaluated) {
      state.displayValue = '0.';
      state.expressionText = '';
      state.tokens = [];
      state.waitingForOperand = false;
      state.justEvaluated = false;
      state.lastOperation = null;
      state.activeOperator = null;
      render();
      return;
    }

    if (state.waitingForOperand) {
      state.displayValue = '0.';
      state.waitingForOperand = false;
      state.activeOperator = null;
      render();
      return;
    }

    if (state.displayValue.includes('.')) {
      triggerDisplayShake();
      return;
    }

    state.displayValue += '.';
    render();
  }

  /**
   * Operator button press (+, −, ×, ÷)
   */
  function handleOperator(op) {
    if (state.hasError) {
      handleClear();
    }

    const normalizedOp = op === '-' ? '−' : (op === '*' ? '×' : (op === '/' ? '÷' : op));

    // Case 1: Just evaluated equals - chain calculation with previous result
    if (state.justEvaluated) {
      const currentVal = parseFloat(state.displayValue);
      state.tokens = [currentVal, normalizedOp];
      state.expressionText = formatNumber(currentVal) + ' ' + normalizedOp;
      state.waitingForOperand = true;
      state.justEvaluated = false;
      state.lastOperation = null;
      state.activeOperator = normalizedOp;
      render();
      return;
    }

    // Case 2: Operator clicked consecutively - replace the pending operator
    if (state.waitingForOperand) {
      if (state.tokens.length > 0) {
        state.tokens[state.tokens.length - 1] = normalizedOp;
        state.expressionText = formatTokensToExpression(state.tokens);
        state.activeOperator = normalizedOp;
        render();
      }
      return;
    }

    // Case 3: Standard operator click - push current operand and operator
    const currentVal = parseFloat(state.displayValue);
    state.tokens.push(currentVal);
    state.tokens.push(normalizedOp);

    // If there is already a completed sub-expression with equal or lower precedence,
    // evaluate the intermediate result for immediate live user feedback!
    if (state.tokens.length >= 4) {
      // E.g. [10, '+', 20, '+'] -> evaluate [10, '+', 20] to 30
      const subTokens = state.tokens.slice(0, state.tokens.length - 1);
      const intermediate = evaluateTokens(subTokens);
      if (intermediate.success) {
        // If the new operator has equal or lower precedence than prior operator, collapse tokens
        const priorOp = state.tokens[state.tokens.length - 3];
        const isPriorHigh = priorOp === '×' || priorOp === '÷';
        const isNewLow = normalizedOp === '+' || normalizedOp === '−';

        if (isPriorHigh || isNewLow) {
          state.tokens = [intermediate.value, normalizedOp];
          state.displayValue = cleanFloat(intermediate.value).toString();
        }
      }
    }

    state.expressionText = formatTokensToExpression(state.tokens);
    state.waitingForOperand = true;
    state.activeOperator = normalizedOp;
    render();
  }

  /**
   * Equals button press (=)
   */
  function handleEquals() {
    if (state.hasError) {
      handleClear();
      return;
    }

    // Case A: Repeated equals press (repeat last operation)
    if (state.justEvaluated && state.lastOperation) {
      const currentVal = parseFloat(state.displayValue);
      const repeatTokens = [currentVal, state.lastOperation.operator, state.lastOperation.operand];
      const repeatOutcome = evaluateTokens(repeatTokens);

      if (!repeatOutcome.success) {
        state.hasError = true;
        state.errorMessage = repeatOutcome.error || 'Error';
        render();
        return;
      }

      const repeatResult = repeatOutcome.value;
      const fullExp = `${formatNumber(currentVal)} ${state.lastOperation.operator} ${formatNumber(state.lastOperation.operand)} =`;
      
      state.displayValue = cleanFloat(repeatResult).toString();
      state.expressionText = fullExp;
      addHistoryItem(fullExp, formatNumber(repeatResult), repeatResult);
      render();
      return;
    }

    // Case B: Regular evaluation
    const evalTokens = [...state.tokens];

    if (state.waitingForOperand) {
      // If user typed e.g. "5 +" and pressed "=" -> standard calculator treats as "5 + 5"
      evalTokens.push(parseFloat(state.displayValue));
    } else {
      evalTokens.push(parseFloat(state.displayValue));
    }

    // If no operators, e.g. user just typed "42" and pressed "="
    if (evalTokens.length === 1) {
      const singleVal = evalTokens[0];
      state.expressionText = formatNumber(singleVal) + ' =';
      state.justEvaluated = true;
      render();
      return;
    }

    // Save last operation for repeated equals support
    if (evalTokens.length >= 3) {
      state.lastOperation = {
        operator: evalTokens[evalTokens.length - 2],
        operand: evalTokens[evalTokens.length - 1]
      };
    }

    const fullExpString = formatTokensToExpression(evalTokens) + ' =';
    const outcome = evaluateTokens(evalTokens);

    if (!outcome.success) {
      state.hasError = true;
      state.errorMessage = outcome.error || 'Error';
      state.expressionText = fullExpString;
      state.activeOperator = null;
      render();
      return;
    }

    const finalResult = outcome.value;

    // UPDATE PRIMARY DISPLAY WITH THE CALCULATED SUM / RESULT
    state.displayValue = cleanFloat(finalResult).toString();
    state.expressionText = fullExpString;
    state.tokens = [];
    state.waitingForOperand = true;
    state.justEvaluated = true;
    state.activeOperator = null;

    // Record in history log
    addHistoryItem(fullExpString, formatNumber(finalResult), finalResult);

    render();
  }

  /**
   * Sign toggle (+/−)
   */
  function handleToggleSign() {
    if (state.hasError) return;

    if (state.displayValue === '0' || state.displayValue === '') {
      state.displayValue = '-0';
      render();
      return;
    }

    if (state.displayValue.startsWith('-')) {
      state.displayValue = state.displayValue.slice(1);
    } else {
      state.displayValue = '-' + state.displayValue;
    }

    render();
  }

  /**
   * Percentage button press (%)
   */
  function handlePercentage() {
    if (state.hasError) return;

    let currentVal = parseFloat(state.displayValue);
    if (isNaN(currentVal)) return;

    // Contextual Percentage:
    // If preceded by an operator in tokens:
    // E.g. "200 + 15%" -> 15% of 200 = 30
    if (state.tokens.length >= 2) {
      const prevOp = state.tokens[state.tokens.length - 1];
      const baseNum = Number(state.tokens[state.tokens.length - 2]);

      if ((prevOp === '+' || prevOp === '−' || prevOp === '-') && !isNaN(baseNum)) {
        currentVal = cleanFloat(baseNum * (currentVal / 100));
        state.displayValue = currentVal.toString();
        render();
        return;
      }
    }

    // Standard standalone percentage: value / 100
    currentVal = cleanFloat(currentVal / 100);
    state.displayValue = currentVal.toString();
    render();
  }

  /**
   * Delete / Backspace button press
   */
  function handleDelete() {
    if (state.hasError) {
      handleClear();
      return;
    }

    if (state.justEvaluated) {
      state.expressionText = '';
      state.justEvaluated = false;
      render();
      return;
    }

    // If user clicked an operator and wants to undo it
    if (state.waitingForOperand) {
      if (state.tokens.length > 0) {
        state.tokens.pop(); // Remove operator
        if (state.tokens.length > 0) {
          const prevNum = state.tokens.pop();
          state.displayValue = prevNum.toString();
        }
        state.waitingForOperand = false;
        state.activeOperator = null;
        state.expressionText = formatTokensToExpression(state.tokens);
        render();
      }
      return;
    }

    // Delete last entered digit
    if (state.displayValue.length === 1 || (state.displayValue.length === 2 && state.displayValue.startsWith('-'))) {
      state.displayValue = '0';
    } else {
      state.displayValue = state.displayValue.slice(0, -1);
    }

    render();
  }

  // --- Display Feedback & Animations ---

  function triggerDisplayShake() {
    displayPanel.classList.remove('error-state');
    void displayPanel.offsetWidth; // Force reflow
    displayPanel.classList.add('error-state');
    setTimeout(() => {
      if (!state.hasError) {
        displayPanel.classList.remove('error-state');
      }
    }, 400);
  }

  function flashButton(btn) {
    if (!btn) return;
    btn.classList.add('btn-pressed');
    setTimeout(() => {
      btn.classList.remove('btn-pressed');
    }, 140);
  }

  // --- History Management ---

  function addHistoryItem(expression, formattedResult, numericResult) {
    state.history.unshift({
      expression: expression,
      result: formattedResult,
      numericValue: numericResult
    });

    if (state.history.length > 30) {
      state.history.pop();
    }

    renderHistory();
  }

  function renderHistory() {
    if (state.history.length === 0) {
      historyEmpty.style.display = 'block';
      historyList.innerHTML = '';
      historyList.appendChild(historyEmpty);
      return;
    }

    historyEmpty.style.display = 'none';
    historyList.innerHTML = '';

    state.history.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'history-item';
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${item.expression} ${item.result}`);

      const expSpan = document.createElement('div');
      expSpan.className = 'history-item-exp';
      expSpan.textContent = item.expression;

      const resSpan = document.createElement('div');
      resSpan.className = 'history-item-res';
      resSpan.textContent = item.result;

      card.appendChild(expSpan);
      card.appendChild(resSpan);

      // Load clicked history item into current calculation
      const loadHistory = () => {
        handleClear();
        state.displayValue = item.numericValue.toString();
        render();
        closeHistory();
      };

      card.addEventListener('click', loadHistory);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          loadHistory();
        }
      });

      historyList.appendChild(card);
    });
  }

  function openHistory() {
    historyDrawer.classList.add('open');
    historyDrawer.setAttribute('aria-hidden', 'false');
    historyCloseBtn.focus();
  }

  function closeHistory() {
    historyDrawer.classList.remove('open');
    historyDrawer.setAttribute('aria-hidden', 'true');
    historyToggleBtn.focus();
  }

  function clearHistory() {
    state.history = [];
    renderHistory();
  }

  // --- Copy to Clipboard ---

  async function copyCurrentResult() {
    const textToCopy = state.displayValue;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      copyFeedback.classList.add('visible');
      setTimeout(() => {
        copyFeedback.classList.remove('visible');
      }, 1600);
    } catch {
      // Graceful fallback
    }
  }

  // --- Event Listeners: Keypad Clicks ---

  keypad.addEventListener('click', (event) => {
    const btn = event.target.closest('.calc-btn');
    if (!btn) return;

    flashButton(btn);

    const num = btn.getAttribute('data-num');
    const operator = btn.getAttribute('data-operator');
    const action = btn.getAttribute('data-action');

    if (num !== null) {
      handleNumber(num);
    } else if (operator !== null) {
      handleOperator(operator);
    } else if (action !== null) {
      switch (action) {
        case 'clear':
          handleClear();
          break;
        case 'delete':
          handleDelete();
          break;
        case 'decimal':
          handleDecimal();
          break;
        case 'toggle-sign':
          handleToggleSign();
          break;
        case 'percentage':
          handlePercentage();
          break;
        case 'equals':
          handleEquals();
          break;
      }
    }
  });

  // --- Event Listeners: Keyboard Navigation ---

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && historyDrawer.classList.contains('open')) {
      closeHistory();
      return;
    }

    const key = event.key;

    // Numbers (0–9)
    if (key >= '0' && key <= '9') {
      const btn = document.querySelector(`.calc-btn[data-num="${key}"]`);
      flashButton(btn);
      handleNumber(key);
      return;
    }

    // Decimal (. or ,)
    if (key === '.' || key === ',') {
      const btn = document.querySelector('.calc-btn[data-action="decimal"]');
      flashButton(btn);
      handleDecimal();
      return;
    }

    // Addition (+)
    if (key === '+') {
      const btn = document.querySelector('.calc-btn[data-operator="+"]');
      flashButton(btn);
      handleOperator('+');
      return;
    }

    // Subtraction (-)
    if (key === '-') {
      const btn = document.querySelector('.calc-btn[data-operator="−"]');
      flashButton(btn);
      handleOperator('−');
      return;
    }

    // Multiplication (* or x or X)
    if (key === '*' || key.toLowerCase() === 'x') {
      event.preventDefault();
      const btn = document.querySelector('.calc-btn[data-operator="×"]');
      flashButton(btn);
      handleOperator('×');
      return;
    }

    // Division (/)
    if (key === '/') {
      event.preventDefault();
      const btn = document.querySelector('.calc-btn[data-operator="÷"]');
      flashButton(btn);
      handleOperator('÷');
      return;
    }

    // Equals (Enter or =)
    if (key === 'Enter' || key === '=') {
      event.preventDefault();
      const btn = document.querySelector('.calc-btn[data-action="equals"]');
      flashButton(btn);
      handleEquals();
      return;
    }

    // Delete / Backspace
    if (key === 'Backspace') {
      event.preventDefault();
      const btn = document.querySelector('.calc-btn[data-action="delete"]');
      flashButton(btn);
      handleDelete();
      return;
    }

    // Clear (Escape or c / C)
    if (key === 'Escape' || key.toLowerCase() === 'c') {
      event.preventDefault();
      const btn = document.querySelector('.calc-btn[data-action="clear"]');
      flashButton(btn);
      handleClear();
      return;
    }

    // Percentage (%)
    if (key === '%') {
      const btn = document.querySelector('.calc-btn[data-action="percentage"]');
      flashButton(btn);
      handlePercentage();
      return;
    }

    // Toggle Sign (F9 or Alt + - or n / N)
    if (key === 'F9' || key.toLowerCase() === 'n' || (event.altKey && key === '-')) {
      event.preventDefault();
      const btn = document.querySelector('.calc-btn[data-action="toggle-sign"]');
      flashButton(btn);
      handleToggleSign();
      return;
    }

    // History (h / H)
    if (key.toLowerCase() === 'h' && !event.ctrlKey && !event.metaKey) {
      if (historyDrawer.classList.contains('open')) {
        closeHistory();
      } else {
        openHistory();
      }
      return;
    }
  });

  // --- Header Action Listeners ---
  copyBtn.addEventListener('click', copyCurrentResult);
  historyToggleBtn.addEventListener('click', openHistory);
  historyCloseBtn.addEventListener('click', closeHistory);
  historyClearBtn.addEventListener('click', clearHistory);

  // Initial render
  render();
})();
