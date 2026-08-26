# What it costs to run

A plain overview of infrastructure cost, and whether the open-source / "we host it for you" model used by comparable humanitarian software could work here.

Prices checked August 2026 and cited. Anything not confirmed from a primary source is marked **[unverified]** — several are, and one of them matters.

---

## The short answer

**Hosting costs about US$25–30 a month. Roughly $310–330 a year.**

That is not a rounding error in this project's budget — it is smaller than the rounding error. One part-time person costs more in a fortnight than the servers cost in a decade. If hosting cost ever becomes a topic of discussion, something has gone wrong with the conversation.

Two things follow, and both are more useful than the number itself:

- **Messaging, not hosting, is the cost driver** — potentially by two orders of magnitude. See §3.
- **Nonprofit cloud credits can plausibly cover the entire hosting bill**, several times over. See §4.

---

## 1. The workload is unusual, and it helps

Disaster software is **bimodal**. For most of the year it is nearly idle — a handful of centres running ordinary donation drives. Then for two to six weeks it carries a real response: perhaps 5–50 centres, a few hundred concurrent users, tens of thousands of small writes a day.

The data is text. Household records, stock movements, vouchers. Tens of gigabytes at the outside, not terabytes. There is no media library, no analytics warehouse, no machine learning.

That profile is cheap to serve, and it rewards anything that scales to zero between events.

## 2. Four stacks, priced

Assuming ~20 GB of records, ten idle months and two surge months a year.

| Stack | Idle month | Surge month | Per year |
|---|---|---|---|
| **Fly.io `gru` + Neon Launch** | ~$8–10 | ~$106 | **≈ $310** |
| **AWS Lightsail sa-east-1** ($12 instance + $15 managed DB) | $27 | $27 | **≈ $324** |
| **Render** (Starter $7 + Basic-1gb $19) | $26 | $26 | **≈ $312** |
| **DigitalOcean** (App Platform $12 + Postgres 1 GiB $15.15) | $27 | $27 | **≈ $326** |

*Arithmetic ours, on published rates. Sources: [Fly.io](https://fly.io/docs/about/pricing/), [Neon](https://neon.com/pricing), [Lightsail](https://aws.amazon.com/lightsail/pricing/), [Render](https://render.com/pricing), [DigitalOcean](https://www.digitalocean.com/pricing/managed-databases).*

**They converge, which is the point.** At this scale the choice of provider is worth about $20 a year either way. Two things do genuinely differ:

**In-region presence.** Fly.io has `gru` (São Paulo) — the only South American region it operates. AWS Lightsail is available in `sa-east-1` and, unusually, at the *same USD price* as everywhere else, which sidesteps the São Paulo premium that applies to most AWS services. Neither Render nor Railway nor DigitalOcean advertise a South American region on the pages we could read. **Hetzner is the cheapest compute in the world right now and is structurally disqualified**: Germany, Finland, USA and Singapore only.

**Idle behaviour.** Only two options in this set genuinely stop billing when nothing is happening: Fly.io machines with `min_machines_running = 0`, and Neon, whose compute suspends after five minutes with no monthly minimum on the Launch plan. Supabase pauses free projects after a week of inactivity but paid plans never sleep; Railway's "sleeping" services still hold a billed slot. For ten idle months a year that is the difference between $310 and $324 — so it is worth knowing, and not worth agonising over.

> **[unverified]** We could not retrieve AWS's own per-instance prices for `sa-east-1` — the pricing API is unreachable and the pages render regionally in JavaScript. A third-party index ([Opsima](https://www.opsima.ai/blog/aws-regional-costs), Oct 2025) puts RDS in São Paulo at **+64%** over `us-east-1` and EC2 at +31%. Confirm in the console before budgeting on it. Google Cloud SQL rates for `southamerica-east1` are likewise unverified.

## 3. What actually costs money: reaching people

This is where the budget lives, and it is not close.

| Route | Brazil | Colombia |
|---|---|---|
| Twilio SMS, international long code | **$0.0599** / message | **$0.0592** / message |
| Twilio with Twilio.org's 10% non-US discount | ~$0.0539 | ~$0.0533 |
| Brazilian aggregator (published rate card, 100k tier) | **~$0.009–0.012** | — |

A three-week surge across 50 centres at 20,000 messages a day is 420,000 messages:

- **Twilio international route: ≈ US$25,200**
- **A local Brazilian aggregator: ≈ US$3,900**

*Ours, on the published rates above; the BRL conversion assumes ~R$5.4/USD, **[unverified]**.*

**That single routing decision is worth roughly 70 years of hosting.** It is also the strongest possible argument for the design choice already made elsewhere in this project: the WhatsApp broadcast generates a message and copies it to the clipboard for the coordinator to paste into their own group. That costs **nothing**, requires no Meta Business Verification, and reaches people on the channel they actually use. The WhatsApp Business API and SMS gateways are upgrades for large organisations, not the default.

Note also that Twilio.org's discount is **10% outside the US and Canada**, not the 25% US rate, and explicitly **excludes WhatsApp**.

## 4. Nonprofit credits, which change the arithmetic entirely

The annual hosting bill fits inside a single nonprofit grant roughly six times over.

| Programme | Value | Accepts Brazil / Colombia? |
|---|---|---|
| **Microsoft Azure for Nonprofits** | **US$2,000/yr in credits**, plus discounted M365, Power Platform, GitHub Enterprise | Not explicitly restricted; routed via Microsoft validation and TechSoup partners. **The strongest recurring credit we verified for a CNPJ- or ESAL-registered organisation** |
| **Google for Nonprofits** | Workspace free, Ad Grants, Maps credits. **No general Google Cloud compute credits** — a widespread misconception | **Yes, both.** Brazil: OSCIP, CEBAS, UPF, association, private foundation and others. Colombia: registered charitable organisation. Verified via Goodstack |
| **Cloudflare Project Galileo** | Free Business-tier equivalent: DDoS mitigation, WAF, CDN, Workers, Zero Trust | No geographic restriction. **Caveat:** eligibility targets human rights, civil society, journalism and democracy — relief logistics is not squarely inside those categories. Worth asking |
| **Twilio.org Impact Access** | $100 one-time credit; **10% off SMS outside US/Canada** | Yes, via Goodstack |
| **AWS Nonprofit Credit Program** | Up to **$5,000/yr** | **Ambiguous, and the single most valuable thing to confirm.** AWS says "nonprofits all over the world" but enumerates only US 501(c) designations. TechSoup Brasil and TechSoup Colombia both exist; we **could not confirm** the credits appear in either national catalogue **[unverified]** |
| **AWS Imagine Grant** | Up to $200k cash + $100k credits | **No — US 501(c) only.** Brazilian and Colombian entities are ineligible |
| **DigitalOcean for Nonprofits** | $2,500 one-time | **[unverified]** — the $2,500 figure is from the 2023 announcement and the current landing page 404s |

**The structural pattern worth knowing:** the programmes gated on *US legal registration* are AWS Imagine (hard exclusion) and arguably the AWS credit programme. Everything else — Microsoft, Google, Twilio, Cloudflare — routes eligibility through **Goodstack** or **national TechSoup partners**, both of which cover Brazil and Colombia.

A CNPJ-registered Brazilian association, or a Colombian ESAL with statutes and a registration certificate, could realistically assemble Azure credits + Workspace + Ad Grants + Cloudflare + a Twilio discount. **That plausibly covers infrastructure entirely.**

Which brings the cost question back to where it belongs: not servers, but the person who answers the phone.

---

## 5. Could the open-source / hosted model work here?

**Yes — it is the standard shape in this sector, and there are five distinct versions of it with published prices.**

| Project | Licence | Hosted price | Who funds it |
|---|---|---|---|
| **KoboToolbox** | **[unverified]** | Nonprofit: Community **free** (5k submissions/mo, 1 GB) · Professional **$159/mo** · Teams **$289/mo**. Commercial: $25 / $99 / $199 / $359. Hosting in 28 countries, or self-host | Kobo Inc., US nonprofit, independent since 2019. Foundation grants, service agreements, UNHCR and OCHA partnerships |
| **Ushahidi** | **[unverified]** | **Basic $0/mo indefinitely** · **Enterprise from $10,000**. Orgs under $250k/yr budget can apply for free Basic | Ford, Google.org, Knight, Omidyar, MacKenzie Scott, UK Aid, USAID |
| **ODK / ODK Central** | Free to self-host | ODK Cloud **$199/mo** (10k submissions) · **$499/mo** (25k). **No published nonprofit discount** | Get ODK Inc., revenue from ODK Cloud |
| **DHIS2** | Open source, digital public good | No SaaS. **Shared Services Fee**, per production instance per year: public sector $5k–$30k by country income band; private $10k–$50k; **NGOs $7,500 flat** | University of Oslo, historically donor-funded. The levy is new — stated rationale: "donor funding is increasingly fragmented and insufficient" |
| **CiviCRM** | AGPL | No first-party SaaS; partner hosting ecosystem | Social Source Foundation — membership, crowdfunded features, partner network |
| **CommCare** (Dimagi) | **[unverified]** | Free (5 users, testing) · **$100/mo** · $500 · $1,000 · $4,000+ | For-profit social enterprise; subsidy negotiated for national health programmes |

### The five shapes

1. **Grant-subsidised metered free tier.** Kobo Community: free for nonprofits and UN agencies, capped at 5,000 submissions a month. The cap *is* the product boundary. **The closest analogue to CAPEM.**
2. **Two price books for the same product.** Kobo charges $159 vs $199 for identical Professional. Ushahidi does it more bluntly — free for organisations under $250k annual budget, $10,000+ for enterprise. Price discrimination by *purchaser type*, not by feature, is the load-bearing mechanism across the whole sector.
3. **Per-deployment levy on institutional users.** DHIS2, $5k–$50k per instance per year, banded by sector and World Bank income classification. Voluntary, enforced socially by publishing who pays. The newest shape, and a signal about where the sector is heading.
4. **Flat SaaS with no charity rate.** ODK Cloud, CommCare. Betting the buyer is a funded INGO or a ministry, not a local community group.
5. **No first-party hosting; monetise the ecosystem.** CiviCRM. AGPL core, revenue from hosting partners and implementation work.

### The lesson that matters most

**The free tier is almost never funded by the paid tier.** Kobo's is funded by foundation grants and service agreements. Ushahidi's by Ford, Knight, Omidyar, Scott, UK Aid and USAID. DHIS2's by Norwegian aid and now the levy. The paid tiers help; they are not what makes the free tier possible.

That matters because CAPEM's target customer — a parish with no software budget — will *only ever* be a free-tier user. There is no upgrade path. A model that assumes small centres eventually pay is a model that has misread its own customer.

### And a cautionary precedent worth reading closely

On **1 September 2023, UN OCHA transferred the humanitarian KoboToolbox server to Kobo Inc.**, with a legacy window closing 29 February 2024. Free users went from **25,000 submissions a month and unlimited storage** to **5,000 submissions and 1 GB**. OCHA's stated reason was "continued growth and associated costs."

That is the most directly relevant thing in this entire document. A funded institution subsidised free humanitarian access to a widely-used tool, then stopped, and the service degraded by 80% for exactly the users least able to pay. Any plan that depends on institutional subsidy needs an answer for what happens when it ends — because in the closest comparable case, it ended.

---

## 6. What we would actually suggest

**Do not solve this problem yet.** Hosting is ~$25/month; it does not need a business model, a pricing page or a sustainability strategy. Those are answers to a question nobody has asked, because there are no users.

When there are:

1. **Register as a nonprofit in one country** — Brazil (CNPJ + statutes) or Colombia (ESAL). That unlocks Goodstack and TechSoup verification and, with it, most of §4. It is also the prerequisite for almost everything in [production.md](production.md) that is not code.
2. **Confirm the AWS nonprofit credit question by direct enquiry.** Up to $5,000/yr, ambiguous eligibility, one email to find out.
3. **Route messaging locally from day one.** A Brazilian aggregator over Twilio's international route is worth ~$21,000 per surge, which is more than the entire rest of the infrastructure will cost in a lifetime. Better still, keep the WhatsApp copy-to-clipboard path as the default and send no messages at all.
4. **Copy Ushahidi's threshold, not Kobo's cap.** "Free for organisations under $X annual budget" is legible, generous by default, and does not degrade the product for the people who need it most. A submission cap punishes exactly the centre having the worst week of its life.
5. **Assume grant funding for the free tier, and say so.** Then plan explicitly for the grant ending — because OCHA's did.

**The honest summary:** hosting this is close to free. Running it is not, and never was, an infrastructure question. It is one person, reachable, who understands relief operations — and that costs more than every server bill in this document combined, several hundred times over.

---

## Not verified

Do not repeat these as fact without checking:

- AWS RDS and Fargate per-instance prices in `sa-east-1`; Google Cloud SQL rates for `southamerica-east1`
- Whether the AWS Nonprofit Credit Program is obtainable via TechSoup Brasil or TechSoup Colombia — **the highest-value open item**
- Whether DigitalOcean's $2,500 nonprofit credit is still running in 2026
- TechSoup Brasil / Colombia administrative fees and Colombian eligibility documents
- Software licences for KoboToolbox, Ushahidi, ODK Central and CommCare — commonly cited as AGPL or Apache, not confirmed from the LICENSE files
- Zenvia and Infobip per-message rates (neither publishes one); the BRL/USD rate used above
- South American region availability for Render, Railway and DigitalOcean managed databases
- WhatsApp Business API per-message rates for Brazil and Colombia — Meta publishes these only as downloadable rate cards
