import { RobinhoodCsvParser } from './parsers/robinhood-csv';
import { Portfolio } from './types/portfolio';

// Sample CSV data for testing
const sampleCsv = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
2024-01-15,2024-01-15,2024-01-17,NVDA,NVDA 1/19/2024 Call $500.00,STO,1,5.50,550.00
2024-01-20,2024-01-20,2024-01-22,NVDA,NVDA 1/19/2024 Call $500.00,BTC,1,2.00,-200.00
2024-01-10,2024-01-10,2024-01-12,NVDA,NVDA,SELL,100,500.00,50000.00
2024-01-05,2024-01-05,2024-01-07,NVDA,NVDA,BUY,100,450.00,-45000.00`;

export function testRobinhoodParser() {
  console.log('Testing Robinhood CSV Parser...');
  
  // Parse CSV
  const trades = RobinhoodCsvParser.loadCsv(sampleCsv);
  console.log('Parsed trades:', trades.length);
  
  // Reverse trades to process in chronological order
  trades.reverse();
  
  // Create portfolio and load trades
  const portfolio = new Portfolio();
  portfolio.loadShares(trades);
  portfolio.loadOptions(trades);
  
  console.log('Portfolio Results:');
  console.log('Total Realized PnL:', portfolio.realizedPnL);
  
  console.log('Share Positions:');
  for (const [symbol, position] of portfolio.sharePositions) {
    console.log(`  ${symbol}: Quantity=${position.quantity}, CostBasis=${position.costBasis}, RealizedPnL=${position.realizedPnL}`);
  }
  
  console.log('Options Positions:');
  for (const [symbol, position] of portfolio.optionsPositions) {
    console.log(`  ${symbol}: Quantity=${position.quantity}, TotalCredit=${position.totalCredit}, RealizedPnL=${position.realizedPnL}`);
  }
  
  return {
    trades,
    portfolio,
    sharePositions: Object.fromEntries(portfolio.sharePositions),
    optionsPositions: Object.fromEntries(portfolio.optionsPositions),
    realizedPnL: portfolio.realizedPnL,
  };
}

// Run test if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  testRobinhoodParser();
} 