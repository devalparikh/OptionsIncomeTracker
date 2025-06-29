# Data Compression for AI Chat

## Overview

The AI Investment Chat now includes configurable data compression to help reduce OpenAI API costs while maintaining useful analysis capabilities.

## Compression Levels

### None (Default)

- **Token Usage**: Highest (~1000-5000+ tokens depending on portfolio size)
- **Data Included**: All positions, full details, complete historical data
- **Best For**: Detailed analysis, comprehensive portfolio review, complex strategy questions

### Basic

- **Token Usage**: Moderate (~3000 tokens)
- **Data Included**: Top 10 open positions, top 10 closed positions, top 5 stock positions
- **Best For**: General portfolio analysis, performance review, strategy suggestions

### Aggressive

- **Token Usage**: Low (~2000 tokens)
- **Data Included**: Top 5 open positions, top 5 closed positions, top 3 stock positions
- **Best For**: Quick insights, focused analysis on major positions, cost-conscious users

### Minimal

- **Token Usage**: Very Low (~1500 tokens)
- **Data Included**: Top 2-3 open positions, top 2-3 closed positions, top 1-2 stock positions
- **Best For**: Basic questions, simple portfolio overview, maximum cost savings

## How Compression Works

### Position Selection

- **Open Positions**: Sorted by unrealized P&L impact (largest gains/losses first)
- **Closed Positions**: Aggregated by symbol, sorted by total realized P&L
- **Stock Positions**: Sorted by unrealized P&L impact

### Data Retention

- Essential fields are always preserved (symbol, type, strike, expiry, P&L)
- Non-essential fields are removed (detailed timestamps, commission data, etc.)
- Stock quotes are compressed to price, change, and change percentage only

### Aggregation

- Closed positions are grouped by symbol to reduce redundancy
- Summary statistics are calculated for overall portfolio performance
- Historical data is condensed into key metrics

## Cost Impact

### Token Reduction Examples

- **Large Portfolio (50+ positions)**: 70-90% reduction in tokens
- **Medium Portfolio (20-50 positions)**: 50-70% reduction in tokens
- **Small Portfolio (<20 positions)**: 30-50% reduction in tokens

### Cost Savings

- **GPT-4**: $0.03 per 1K input tokens → Significant savings with compression
- **GPT-3.5 Turbo**: $0.0015 per 1K input tokens → Moderate savings
- **GPT-4o**: $0.005 per 1K input tokens → Good balance of cost and capability

## When to Use Each Level

### Use "None" When:

- Analyzing specific positions in detail
- Reviewing complex strategies
- Need comprehensive historical data
- Cost is not a primary concern

### Use "Basic" When:

- General portfolio analysis
- Performance review
- Strategy suggestions
- Good balance of detail and cost

### Use "Aggressive" When:

- Quick insights needed
- Focus on major positions only
- Cost-conscious usage
- Regular monitoring

### Use "Minimal" When:

- Basic portfolio overview
- Simple questions
- Maximum cost savings
- Limited analysis needs

## Configuration

### Setting Compression Level

1. Open the AI Chat
2. Click "Settings" button
3. Select desired compression level from dropdown
4. Click "Save"

### Visual Indicators

- Compression level is shown in the portfolio summary when active
- Token usage estimate is displayed in settings
- Orange badge indicates compression is active

## Limitations

### Reduced Detail

- Fewer positions included in analysis
- Less historical context
- Simplified metrics

### Analysis Impact

- May miss insights from smaller positions
- Limited historical pattern recognition
- Reduced strategy complexity

## Best Practices

1. **Start with Basic**: Good balance for most users
2. **Use Aggressive for Regular Monitoring**: Save costs on routine questions
3. **Switch to None for Deep Analysis**: When you need comprehensive insights
4. **Monitor Token Usage**: Use the estimator to understand costs
5. **Adjust Based on Portfolio Size**: Larger portfolios benefit more from compression

## Troubleshooting

### "Analysis seems incomplete"

- Try increasing compression level (less compression)
- Check if important positions are being excluded

### "Still using too many tokens"

- Try decreasing compression level (more compression)
- Consider using GPT-3.5 Turbo for basic questions

### "Missing important data"

- Ensure critical positions are in your top positions
- Consider using "None" compression for detailed analysis
