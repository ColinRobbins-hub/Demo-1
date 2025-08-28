/* Stock Market Prediction Game - Client-side JavaScript */

const dom = {
  form: document.getElementById('setup-form'),
  apiKey: document.getElementById('apiKey'),
  ticker: document.getElementById('ticker'),
  startBtn: document.getElementById('start-btn'),
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  statusTicker: document.getElementById('status-ticker'),
  currentDate: document.getElementById('current-date'),
  score: document.getElementById('score'),
  instruction: document.getElementById('instruction'),
  feedback: document.getElementById('feedback'),
  guessUp: document.getElementById('guess-up'),
  guessDown: document.getElementById('guess-down'),
  endGame: document.getElementById('end-game'),
  reset: document.getElementById('reset'),
  chartCanvas: document.getElementById('chart'),
};

/**
 * Global game state
 */
const state = {
  symbol: null,
  apiKey: null,
  data: [], // ascending by date: [{ date: Date, dateStr: 'YYYY-MM-DD', close: number }]
  chart: null,
  currentIndex: null, // index in data of the current (hidden) reference day
  score: 0,
  inProgress: false,
};

function setLoading(isLoading) {
  dom.loading.hidden = !isLoading;
  dom.startBtn.disabled = isLoading;
  dom.ticker.disabled = isLoading;
  dom.apiKey.disabled = isLoading;
}

function showError(message) {
  dom.error.hidden = false;
  dom.error.textContent = message;
}

function clearError() {
  dom.error.hidden = true;
  dom.error.textContent = '';
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseTimeSeries(json) {
  const series = json['Time Series (Daily)'];
  if (!series || typeof series !== 'object') {
    return [];
  }
  const entries = Object.entries(series)
    .map(([dateStr, bar]) => ({
      dateStr,
      date: new Date(dateStr + 'T00:00:00'),
      close: parseFloat(bar['5. adjusted close'] || bar['4. close']),
    }))
    .filter(p => Number.isFinite(p.close))
    .sort((a, b) => a.date - b.date);
  return entries;
}

function pickRandomStartIndex(entries) {
  if (!entries.length) return null;
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - 100);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() - 7);

  // Build list of eligible indices: date between [minDate, maxDate],
  // and with at least 7 prior trading days and at least 1 following day
  const eligible = [];
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    if (e.date >= minDate && e.date <= maxDate) {
      const hasSevenPrior = i - 7 >= 0;
      const hasNext = i + 1 < entries.length;
      if (hasSevenPrior && hasNext) {
        eligible.push(i);
      }
    }
  }
  if (!eligible.length) return null;
  const randomIndex = Math.floor(Math.random() * eligible.length);
  return eligible[randomIndex];
}

function createChart(labels, data) {
  if (state.chart) {
    state.chart.destroy();
  }
  const ctx = dom.chartCanvas.getContext('2d');
  state.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Adjusted Close',
        data,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        tension: 0.25,
        pointRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: '#9fb0d1', autoSkip: true, maxTicksLimit: 10 },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
        y: {
          ticks: { color: '#9fb0d1' },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
      },
      plugins: {
        legend: { labels: { color: '#e6ebf5' } },
        tooltip: { mode: 'nearest', intersect: false },
      },
    },
  });
}

function updateChart(nextLabel, nextValue) {
  if (!state.chart) return;
  state.chart.data.labels.push(nextLabel);
  state.chart.data.datasets[0].data.push(nextValue);
  state.chart.update();
}

function resetUI() {
  state.symbol = null;
  state.apiKey = null;
  state.data = [];
  state.currentIndex = null;
  state.score = 0;
  state.inProgress = false;
  dom.statusTicker.textContent = '—';
  dom.currentDate.textContent = '—';
  dom.score.textContent = '0';
  dom.instruction.textContent = 'Enter a ticker and press Start Game.';
  dom.feedback.textContent = '';
  dom.guessUp.disabled = true;
  dom.guessDown.disabled = true;
  dom.endGame.disabled = true;
  dom.reset.disabled = false;
  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }
}

async function fetchTimeSeriesDailyAdjusted(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}&outputsize=compact`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Network error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (json['Error Message']) {
    throw new Error('Invalid ticker symbol. Please try a different one.');
  }
  if (json['Note']) {
    throw new Error('API rate limit reached. Please wait and try again.');
  }
  const entries = parseTimeSeries(json);
  if (!entries.length) {
    throw new Error('No price data available for this ticker.');
  }
  return entries;
}

function startGameWithData(symbol, apiKey, entries) {
  const startIndex = pickRandomStartIndex(entries);
  if (startIndex == null) {
    throw new Error('Not enough recent data to start the game. Try another ticker.');
  }

  state.symbol = symbol.toUpperCase();
  state.apiKey = apiKey;
  state.data = entries;
  state.currentIndex = startIndex;
  state.score = 0;
  state.inProgress = true;

  dom.statusTicker.textContent = state.symbol;
  dom.score.textContent = String(state.score);
  // Current date should correspond to the latest day of data shown (last seeded chart point)
  dom.currentDate.textContent = entries[startIndex - 1].dateStr;
  dom.instruction.textContent = 'Predict if the next day\'s price goes up or down.';
  dom.feedback.textContent = '';

  // Seed chart with the 7 prior trading days before start date (do not include start date)
  const seedStart = startIndex - 7;
  const labels = entries.slice(seedStart, startIndex).map(e => e.dateStr);
  const values = entries.slice(seedStart, startIndex).map(e => e.close);
  createChart(labels, values);

  dom.guessUp.disabled = false;
  dom.guessDown.disabled = false;
  dom.endGame.disabled = false;
  dom.reset.disabled = false;
}

function handleGuess(direction) {
  if (!state.inProgress) return;
  const current = state.data[state.currentIndex];
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.data.length) {
    dom.feedback.textContent = 'No more data to continue. The game has ended.';
    dom.guessUp.disabled = true;
    dom.guessDown.disabled = true;
    state.inProgress = false;
    return;
  }
  const next = state.data[nextIndex];
  const delta = next.close - current.close;

  let correct = false;
  if (direction === 'up') {
    correct = delta > 0;
  } else if (direction === 'down') {
    correct = delta < 0;
  }

  if (correct) {
    state.score += 1;
    dom.feedback.textContent = `Correct! ${next.dateStr}: ${next.close.toFixed(2)} (Δ ${(delta >= 0 ? '+' : '') + delta.toFixed(2)})`;
  } else {
    const unchanged = delta === 0;
    const verdict = unchanged ? 'unchanged' : 'incorrect';
    dom.feedback.textContent = `Your guess was ${verdict}. ${next.dateStr}: ${next.close.toFixed(2)} (Δ ${(delta >= 0 ? '+' : '') + delta.toFixed(2)})`;
  }
  dom.score.textContent = String(state.score);

  // Reveal the next day on the chart and advance the current date
  updateChart(next.dateStr, next.close);
  state.currentIndex = nextIndex;
  dom.currentDate.textContent = next.dateStr;
}

function endGame() {
  dom.guessUp.disabled = true;
  dom.guessDown.disabled = true;
  state.inProgress = false;
  dom.instruction.textContent = 'Game ended. You can reset to play again.';
}

function resetGame() {
  resetUI();
}

dom.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  resetUI();
  const symbolRaw = dom.ticker.value.trim();
  const apiKeyRaw = dom.apiKey.value.trim();
  if (!symbolRaw) {
    showError('Please enter a stock ticker.');
    return;
  }
  if (!apiKeyRaw) {
    showError('Please enter your Alpha Vantage API key.');
    return;
  }
  setLoading(true);
  try {
    const entries = await fetchTimeSeriesDailyAdjusted(symbolRaw, apiKeyRaw);
    startGameWithData(symbolRaw, apiKeyRaw, entries);
  } catch (err) {
    console.error(err);
    showError(err.message || 'Failed to load data.');
  } finally {
    setLoading(false);
  }
});

dom.guessUp.addEventListener('click', () => handleGuess('up'));
dom.guessDown.addEventListener('click', () => handleGuess('down'));
dom.endGame.addEventListener('click', endGame);
dom.reset.addEventListener('click', resetGame);

// Initialize UI state on load
resetUI();

