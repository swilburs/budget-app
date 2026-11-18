# Budget

A YNAB-style budgeting app built from the "Monthly Budget with Automatic Investments and Debt Calculator" spreadsheet.

## What's in it

- **Budget**: the five groups from the spreadsheet (Fixed Costs, Debt Payments, Investments, Sink Funds, Fun Money), with the monthly plan plus YNAB-style *Assigned / Spent / Available*. Leftover money rolls over to the next month. *Ready to Assign* = income received minus money assigned. Each group shows its share of income against its target (60/15/10/15; debt counts toward Fixed, like the sheet).
- **Transactions**: import CSVs from Chase or Bank of America (checking and credit card), or add transactions by hand. New transactions are categorized automatically: first by your rules ("payee contains…"), then by the category you used last time for that payee. Everything lands in a *To review* list until you approve it.
- **Debt**: the Debt Tracker tab. Shows payoff dates, interest left, a warning when most of a payment goes to interest, and an option to roll paid-off payments into the next debt (highest APR first).
- **Retirement**: the Investment Tracker tab, plus a growth chart, an estimated retirement income at a chosen withdrawal rate, and figures in today's dollars.
- **What-if**: change any monthly amount and compare it with your current plan over 30 years (debt-free date, interest, retirement savings, net worth). Then apply the change to your plan, or reset it.

The payoff and projection math matches the spreadsheet's `NPER` and `FV` formulas. The tests check it against the sheet's numbers (Car Loan 54 months, HELOC 551 months, 401k $551,586).

## Data

For now, data is stored in the browser's localStorage. Settings has *Download backup* and *Restore backup*. All state goes through one reducer (`src/lib/store.tsx`), so moving to a shared backend only means replacing load and save.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # money math, budget rollover, CSV parsing, categorization
npm run build
```

## Next

1. Hosted backend (Supabase) with logins, so the budget syncs between phone and laptop and is shared with a partner.
2. Automatic daily bank sync (SimpleFIN, with Plaid as a fallback) to replace CSV import.
3. Claude-suggested categories for payees the rules and history don't know yet.
4. Sinking-fund goals (target amount by date) and reports.
