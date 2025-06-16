1 · Scope & Goal
Let the user drag‑and‑drop a Robinhood activity CSV instead of filling the “Add Contract” form.

The upload must end in the exact same database rows your manual workflow creates for

Cash‑Secured Puts (Symbol • Strike • Expiry • OpenDate • Premium • #Contracts)

Covered Calls (the same, plus Share Cost Basis if it’s already in the portfolio table).

Anything else in the CSV (buy‑to‑close, assignments, dividends, deposits, etc.) is parsed so the position can later be updated, but does not create a new “open” record.

2 · What’s in a Robinhood CSV? (Real‑world sample)
Column Example Notes
Activity Date 6/9/2025 Trade date — use as OpenDate
Process Date 6/9/2025 Not needed for tracking
Settle Date 6/10/2025 Needed only for cash reconciliation
Instrument NVDA Underlying ticker; use for Symbol
Description NVDA 6/13/2025 Put $138.00 Encodes Symbol, Expiry, Call/Put, Strike
Trans Code STO Action codes (see §4)
Quantity 1 # contracts for option rows; 100 for share legs of assignments
Price $0.69 Premium per share; multiply by 100 for full‑contract cash
Amount $68.95 Cash after fees (helpful for P/L)

The file is fully quoted (" around every field). Some assignment rows span multiple lines inside one quoted cell, so the parser must handle embedded newlines.

3 · File‑Upload Contract
bash
Copy
Edit
POST /api/upload/robinhood
Content‑Type: multipart/form‑data; file=<csv>

Response 200:
{
“acceptedRows”: 14,
“ignoredRows”: 45,
“newPositions”: 14,
“warnings”: [...]
}
Reject non‑CSV MIME types and files larger than 2 MB.

Detect header row exactly once.

Fail fast (HTTP 400) if required columns are missing.

4 · Action‑Code Mapping
Trans Code Meaning What importer does
STO Sell to Open Creates a new open position (see §5)
BTC Buy to Close Looks up matching open position and closes it (stores close premium & date)
OEXP Option Expired Marks contract Expired Worthless
OASGN Robinhood’s synthetic option assignment opener Pre‑assignment marker; no DB change by itself
Sell (right after OASGN) Shares delivered on call assignment Closes covered‑call position; records sale proceeds & gain/loss
Buy (right after OASGN) Shares purchased on put assignment Closes CSP; records share cost basis
(anything else) ACH, CDIV, INT, GOLD, etc. Skip but store in a cash‑flow table if you already track one

Rows are matched to open positions by composite key (Symbol, Expiry, Call/Put, Strike, Quantity).

5 · Parsing an STO Row → Tracker Input
text
Copy
Edit
Description : NVDA 6/13/2025 Put $138.00
Reg‑Ex (UTC‑0)       :  ^([A-Z]+) (\d{1,2}/\d{1,2}/\d{4}) (Call|Put) \$([0-9.]+)$
Extracted : NVDA | 6/13/2025 | Put | 138.00
Mapped to tracker :
Symbol = NVDA
StrikePrice = 138.00
ExpiryDate = 2025‑06‑13
OpenDate = ActivityDate (2025‑06‑09)
OpenPrice = 0.69 // per‑share premium
NumContracts = 1
OptionType = PUT
ShareCostBasis = NULL // calls only; filled later if shares table matches
Convert Price to float without $ and parentheses.
Store PremiumTotal = Price × 100 × NumContracts for P/L.

6 · Database Touch‑points
scss
Copy
Edit
OptionPositions (PK id)
symbol, strike, expiry, type, open_date, open_price, contracts, cost_basis_shares (nullable)

OptionTransactions (1‑many per position)
position_id, action, trade_date, price_per_share, total_cash

CashFlows (optional)
activity_date, description, amount
Reuse exactly the same service layer the manual form calls:
CreateOptionPosition() for STO rows,
RecordTransaction() for BTC/OEXP/assignment sequels.

7 · Algorithm in Pseudocode
python
Copy
Edit
for row in csv_reader(file, allow_multiline=True):
if is_option_row(row):
data = parse_description(row['Description'])
key = (data.sym, data.exp, data.type, data.strike, row['Quantity'])
match row['Trans Code']:
case 'STO':
create_option_position(key, row)
case 'BTC' | 'OEXP':
close_position(key, row)
case 'OASGN':
cache_assignment_preamble(row) # wait for Sell/Buy row
case 'Sell' | 'Buy':
finalize_assignment(key, row)
else if is_cash_event(row):
record_cash_flow(row)
8 · Edge‑Case Handling
Case Rule
Duplicate STO (same key & open_date) Ignore second row; log warning
Rolls (BTC + STO same day, same symbol) Treat as two distinct transactions; let UI show “Rolled” if close & open dates match
Partial fills Sum premiums until contracts match expected size
Multi‑contract trades Quantity > 1 simply maps to NumContracts; premiums and totals scale linearly
Multi‑line cells Use RFC 4180 parser (csv module with quotechar='"', strict=False)

9 · Validation & UX Feedback
After import, display a summary banner:
“14 option positions imported (10 puts, 4 calls). 2 contracts already existed and were skipped.”

Show each warning (duplicate, unmatched close, etc.) inline with a fix button that opens the original row in edit mode.
