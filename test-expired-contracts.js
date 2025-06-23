const fs = require("fs");

// Test CSV with expired contracts using correct Robinhood format
const testCsv = `Date,Symbol,Type,Quantity,Price,Amount,Description
2024-01-01,AAPL,STO,1,2.50,250.00,AAPL 1/19/2024 Put $150.00
2024-01-19,AAPL,EXP,1,0.00,0.00,Option Expiration for AAPL 1/19/2024 Put $150.00
2024-01-01,TSLA,STO,1,3.00,300.00,TSLA 1/26/2024 Call $200.00
2024-01-26,TSLA,EXP,1,0.00,0.00,Option Expiration for TSLA 1/26/2024 Call $200.00
2024-01-01,NVDA,STO,1,1.50,150.00,NVDA 2/2/2024 Put $400.00
2024-02-02,NVDA,EXP,1,0.00,0.00,Option Expiration for NVDA 2/2/2024 Put $400.00`;

// Write test CSV
fs.writeFileSync("test-expired-contracts.csv", testCsv);

console.log("Test CSV created: test-expired-contracts.csv");
console.log("");
console.log("This CSV contains 3 expired contracts that should:");
console.log('1. Be marked as close_type = "EXPIRED"');
console.log("2. Have realized_pnl = full premium received (minus commissions)");
console.log("3. Have close_price = 0");
console.log("");
console.log("Expected results:");
console.log("- AAPL: realized_pnl = $250.00 (full premium)");
console.log("- TSLA: realized_pnl = $300.00 (full premium)");
console.log("- NVDA: realized_pnl = $150.00 (full premium)");
console.log("");
console.log("Key changes:");
console.log(
  '- Updated description format to match Robinhood: "Option Expiration for SYMBOL DATE TYPE $STRIKE"'
);
console.log(
  '- Changed Trans Code from "Expired" to "EXP" to match Robinhood format'
);
console.log('- Updated date format to match Robinhood: "M/D/YYYY"');
console.log("");
console.log("Upload this CSV to test the expired contract handling.");
