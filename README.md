# Agency Agents Space

Independent hosted planner for the open-source `msitarzewski/agency-agents` roster.

- Live site: https://agency-agents.space/
- Planner: https://agency-agents.space/planner/
- Pricing: https://agency-agents.space/pricing/
- Source notes: https://agency-agents.space/source-notes/
- Public docs: https://github.com/clauxel/agency-agents-space-docs

This project is not the official Agency Agents desktop app and does not install agents directly. It turns source-grounded roster, division, integration, and NEXUS workflow facts into a planning surface with paid export gates.

## Production Evidence

- Cloudflare Worker routes serve `https://agency-agents.space/` and redirect `www` to the apex domain.
- Cloudflare D1 analytics is bound as `agency-agents-space-analytics`.
- Polar hosted checkout links are configured for Starter, Pro, and Enterprise monthly/annual plans.
- Google Search Console, Bing Webmaster, and IndexNow submissions are recorded in `search-submission-result.json`.
