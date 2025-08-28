# Stock Market Prediction Game

Guess whether a stock's adjusted close price will go up or down each trading day, using real market data from Alpha Vantage. Built as a static site suitable for GitHub Pages.

## Features

- Real data via Alpha Vantage (no demo data)
- Validates tickers and handles API rate-limits
- Random start date within 7–100 days ago, ensures trading day
- Chart.js line chart of the 7 days prior to the start date
- Interactive up/down guesses with scoring and progressive data reveal

## Local Development

Open `index.html` in a browser. Enter any valid ticker (e.g., `MSFT`, `COF`). The Alpha Vantage API key is embedded in the app.

Alpha Vantage Free tier limits apply (typically 5 requests/minute, 100/day). This app makes one request per game start, so it stays within limits.

## Deploy to GitHub Pages

1. Create a new GitHub repository and push this project.
2. Commit and push all files to your `main` (or `master`) branch.
3. In your repository, go to Settings → Pages.
4. Under "Build and deployment", set:
   - Source: `Deploy from a branch`
   - Branch: `main` and folder `/ (root)`
5. Click Save. Your site will be available at the Pages URL shown.

When the site is live, open it and start a game. No API key entry is required.

## How It Works

- Fetches `TIME_SERIES_DAILY_ADJUSTED` for the selected symbol.
- Parses trading days and picks a random start date between 7 and 100 days ago that also has at least 7 prior trading days and a next trading day.
- Initially shows a chart of the 7 days preceding the start date.
- You guess up/down for the day after the start date; the app reveals the next day, updates the chart and your score, and repeats.

## Notes

- If you hit the API rate limit, wait a minute and try again.
- If a ticker has insufficient historical data in the last ~100 days, pick another.

# Demo-1