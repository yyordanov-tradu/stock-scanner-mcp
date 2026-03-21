# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

**Please do not open public issues for security vulnerabilities.**

### Preferred: GitHub Private Vulnerability Reporting

1. Go to the [Security Advisories](https://github.com/yyordanov-tradu/stock-scanner-mcp/security/advisories) page
2. Click **"Report a vulnerability"**
3. Fill in the details and submit

### Alternative: Email

If you cannot use GitHub's private reporting, email the maintainer directly via the contact information on the [GitHub profile](https://github.com/yyordanov-tradu).

## Response SLA

| Stage              | Timeframe |
|--------------------|-----------|
| Acknowledgment     | 48 hours  |
| Status update      | 7 days    |
| Fix or mitigation  | 30 days   |

## Scope

The following areas are in scope for security reports:

- **API key handling** — leakage in logs, error messages, or HTTP requests
- **Dependency vulnerabilities** — known CVEs in direct or transitive dependencies
- **Input validation** — injection or unexpected behavior from malformed tool inputs
- **Information leakage** — sensitive data exposed in MCP responses or error messages

## Out of Scope

- Vulnerabilities in upstream APIs (Finnhub, Alpha Vantage, TradingView, etc.)
- Issues requiring physical access to the machine running the server
- Denial-of-service via external API rate limits (not controlled by this project)
- Social engineering attacks
