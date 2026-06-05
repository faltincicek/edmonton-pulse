# Edmonton Pulse

A live civic data explorer for Edmonton 311 service requests — built for Edmontonians who want to understand what's happening in their city, not just analysts.

**Live at [edmonton311.pplx.app](https://edmonton311.pplx.app)**

---

## What it does

- **Live data** — fetches from Edmonton's Open Data portal daily, no manual updates needed
- **Neighbourhood heatmap** — see which areas have the most open or resolved reports
- **Seasonal benchmarking** — know whether potholes this month are actually worse than normal for this time of year, or whether the city is catching up
- **City response breakdown** — see how many reports were fixed, duplicated, or closed without action
- **17 service categories** — Potholes, Snow & Ice, Graffiti, Encampments, Animal Complaints, and more
- **Dark mode** — because why not

## Data source

Edmonton Open Data portal — [311 Service Requests dataset](https://data.edmonton.ca/resource/q7ua-agfg.json). All data is reported by Edmontonians and resolved by the City of Edmonton. This app visualizes public records only.

## Tech stack

- **Frontend:** React, Tailwind CSS, shadcn/ui, Recharts, Leaflet
- **Backend:** Express, SQLite (via better-sqlite3 + Drizzle ORM)
- **Build:** Vite + TypeScript

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5000](http://localhost:5000).

## Origin

Built in one hour at [Shawn Kanungo](https://linkedin.com/in/shawnkanungo)'s Perplexity Meetup in Edmonton using [Perplexity Computer](https://perplexity.ai/computer).

Prompted by [Furkan Altincicek](https://linkedin.com/in/faltincicek).

## License

MIT
