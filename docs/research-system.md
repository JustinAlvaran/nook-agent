# Research system

`search_web` is an allowlisted, versioned tool backed by the official Brave Search API. It returns titles, HTTPS URLs, publisher hostnames, publication dates when supplied, retrieval timestamps, and bounded snippets. Results are deduplicated and stored by task. Nook cannot claim research completion when zero valid sources remain.

The provider requires `BRAVE_SEARCH_API_KEY`. No user cookies, browser session, or internal headers are forwarded. Requests time out after ten seconds and reject declared responses over one megabyte.

## Partially implemented

Search execution and source persistence are implemented. Source synthesis and mixed search-to-draft sequential execution are Phase D work. Production remains unchanged until migration application and review deployment.
