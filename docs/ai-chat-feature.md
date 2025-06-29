# AI Investment Chat Feature

## Overview

The AI Investment Chat is a professional investment analyst chatbot that provides personalized insights about your options trading portfolio. It uses OpenAI's GPT models to analyze your positions, provide risk assessments, and suggest strategies.

## Features

- **Portfolio Analysis**: AI analyzes your open positions, closed positions, and stock holdings
- **Risk Assessment**: Provides insights on capital at risk, assignment probabilities, and portfolio diversification
- **Strategy Suggestions**: Recommends potential adjustments, exits, or new opportunities
- **Educational Content**: Explains options strategies and concepts using your actual portfolio data
- **Customizable**: Multiple AI personalities and configurable parameters

## Setup

### 1. Get OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-`)

### 2. Configure the Chat

1. Open the Options Income Tracker dashboard
2. Click on the "Chat" tab
3. Click the "Settings" button
4. Enter your OpenAI API key
5. Choose your preferred model and settings
6. Click "Save"

## Configuration Options

### AI Models

- **GPT-4**: Most capable, best for complex analysis
- **GPT-4 Turbo**: Faster, good balance of capability and speed
- **GPT-3.5 Turbo**: Fastest, good for basic analysis

### Temperature Settings

- **Very Focused (0.1)**: Consistent, conservative responses
- **Focused (0.3)**: Balanced with some creativity
- **Balanced (0.7)**: Good mix of analysis and suggestions
- **Creative (1.0)**: More varied responses and ideas
- **Very Creative (1.5)**: Most diverse suggestions

### AI Personalities

#### Conservative

- Focuses on risk management
- Emphasizes capital preservation
- Suggests conservative strategies

#### Aggressive

- Focuses on maximizing returns
- Suggests higher-risk strategies
- Always explains risks clearly

#### Educational

- Teaches options concepts
- Uses portfolio data as examples
- Explains why strategies work/don't work

#### Technical

- Focuses on technical analysis
- Analyzes Greeks and indicators
- Quantitative approach

#### Custom

- Default professional analyst
- Balanced approach to analysis
- Actionable insights

## Usage Examples

### Portfolio Analysis

```
"How is my portfolio performing overall?"
"What are the biggest risks in my current positions?"
"Which positions should I consider closing?"
```

### Strategy Questions

```
"Should I roll my covered calls?"
"What's the best strategy for my TSLA puts?"
"How can I improve my wheel strategy?"
```

### Risk Management

```
"What's my maximum potential loss?"
"Which positions have the highest assignment risk?"
"How diversified is my portfolio?"
```

### Educational Questions

```
"Explain how covered calls work with my positions"
"What are the Greeks and how do they affect my trades?"
"How does the wheel strategy work?"
```

## Data Privacy

- Your API key is stored locally in your browser
- Portfolio data is sent to OpenAI for analysis
- No data is permanently stored by OpenAI
- You can clear chat history at any time

## Troubleshooting

### "API Key Required" Error

- Make sure you've entered your OpenAI API key in settings
- Verify the key starts with `sk-`
- Check that you have sufficient credits in your OpenAI account

### "No Response" Error

- Check your internet connection
- Verify your OpenAI API key is valid
- Try reducing the max tokens setting
- Switch to a different model

### Slow Responses

- Try using GPT-3.5 Turbo for faster responses
- Reduce the max tokens setting
- Check your OpenAI API usage limits

## Tips for Better Results

1. **Be Specific**: Ask about specific positions or strategies
2. **Provide Context**: Mention your goals or concerns
3. **Ask Follow-ups**: Build on previous responses
4. **Use Different Personalities**: Try different AI styles for different types of questions
5. **Review Regularly**: Use the chat to review your portfolio weekly

## Keyboard Shortcuts

- `Ctrl + C`: Switch to Chat tab
- `Ctrl + D`: Switch to Dashboard
- `Ctrl + M`: Switch to Market Analysis

## Support

If you encounter issues with the AI chat feature:

1. Check the troubleshooting section above
2. Verify your OpenAI API key and credits
3. Try clearing your browser cache
4. Contact support with specific error messages
