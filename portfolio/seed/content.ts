/**
 * Initial website content, taken from Snigdh's CV (Snigdh_RN_CV.pdf), the source code in this
 * repository (sapthagiri-app/, the Sentinel app at the repo root) and the project brief.
 *
 * Nothing here is invented: no metrics, clients, results or links that aren't in those sources.
 * Every item has a stable `key`. The seed inserts each key at most once (tracked in the seed_log
 * table), so re-running the seed never duplicates content, never overwrites edits made in the
 * admin portal, and never brings back items you deleted.
 */

export type SeedMedia = { key: string; file: string; alt: string };

export const MEDIA: SeedMedia[] = [
  { key: "media:portrait-formal", file: "portrait-formal.png", alt: "Snigdh R.N. in a dark suit, arms crossed, smiling at the camera" },
  { key: "media:portrait-session", file: "portrait-session.jpg", alt: "Snigdh R.N. seated at a conference table with laptops, listening to a speaker" },
  { key: "media:resume", file: "Snigdh_RN_CV.pdf", alt: "Snigdh R.N. — CV" },
  { key: "media:sapthagiri-home", file: "sapthagiri-home.jpg", alt: "Sapthagiri Enterprises storefront home page" },
  { key: "media:sapthagiri-shop", file: "sapthagiri-shop.jpg", alt: "Sapthagiri Enterprises catalogue with filters" },
  { key: "media:sapthagiri-mobile", file: "sapthagiri-mobile.jpg", alt: "Sapthagiri Enterprises storefront on a phone" },
  { key: "media:sapthagiri-admin", file: "sapthagiri-admin.jpg", alt: "Sapthagiri Enterprises owner portal dashboard" },
];

/** `{{media:key}}` placeholders are replaced with the uploaded media ids at seed time. */
export const SETTINGS = {
  name: "Snigdh R.N.",
  shortName: "SRN",
  location: "Bangalore, India",
  roleLine: "Applied Finance & Analytics · Markets Research · Quantitative Strategy · Software",
  headline: "Separating the *signal*\nfrom the story.",
  heroIntro:
    "I research capital markets, test systematic strategies and build the software that does both — from foreign portfolio flow analysis and backtests to full-stack websites for real businesses.",
  heroStats: [
    { value: "9", suffix: "+", label: "National case competition finals" },
    { value: "15", suffix: "+", label: "First places at Bangalore finance & business fests" },
    { value: "1471", suffix: "", label: "Logged tests behind a podium-finishing quant strategy" },
    { value: "6.25", suffix: "×", label: "Median ratio of reported FPI AUC change to true flow, from my research" },
  ],
  showTicker: true,

  aboutLead:
    "I'm a B.Com (Applied Finance & Analytics) student at Christ University, Bangalore, working where finance, research and software meet.",
  aboutBody: [
    "Most of my work follows the same arc: a question about markets, a dataset, and a tool to test it. At **Cautilya Capitals** I helped the founder adapt Jay Kaeppel's seasonality-based market research to Indian markets, backtested F&O strategies, and led a project tracking foreign portfolio investment (FPI) inflows from NSDL data, building the dashboards and internal tools that the research needed.",
    "That FPI work grew into my independent research paper, submitted to IIMC-FRC. It argues that the widely reported change in FPI assets under custody mostly measures price movements, not money moving in or out of India.",
    "Alongside research, I compete. I've been a finalist in 9+ national case competitions hosted by IIMs, IITs and other leading institutes. In 2026 I placed second at Viksit: Economicus and third at The Capital Verdict at IIT Bombay's Avenues. The Capital Verdict was my first quantitative finance competition, and I presented the finals solo.",
    "And I build: Alpha-Beta, a PDF utility app deployed for college-wide use, and full-stack websites for businesses, including Sapthagiri Enterprises in Bangalore.",
  ].join("\n\n"),
  interests: [
    "Investment banking & corporate finance",
    "Quantitative finance",
    "Systematic strategy research & backtesting",
    "Algorithmic trading",
    "Capital markets & macroeconomic research",
    "Building practical software & digital products",
  ],
  portraitPrimaryId: "{{media:portrait-formal}}",
  portraitPrimaryCaption: "Fig. 01: Snigdh R.N.",
  portraitSecondaryId: "{{media:portrait-session}}",
  portraitSecondaryCaption: "Fig. 02: In session",
  milestones: [
    { year: "2023–24", title: "State-level cricket", text: "Represented Mysore at Under-16 state-level tournaments." },
    { year: "2024–25", title: "B.Summit v11", text: "Student Coordinator. Led a 25-person team and brought in INR 4 lakh in sponsorship." },
    { year: "2025", title: "Cautilya Capitals", text: "Equity & markets analyst intern: seasonality research, F&O backtests and FPI flow tracking." },
    { year: "Research", title: "Paper submitted to IIMC-FRC", text: "Marked to Market, Mistaken for Money: what FPI custody data really measures." },
    { year: "2026", title: "Christ University", text: "Began a B.Com in Applied Finance & Analytics, after 95% in Class XII." },
    { year: "2026", title: "Avenues, IIT Bombay", text: "2nd at Viksit: Economicus and 3rd at The Capital Verdict." },
    { year: "2026", title: "Building for businesses", text: "Designed and built a full-stack website for Sapthagiri Enterprises." },
    { year: "2026", title: "Colossus '26", text: "Invited to judge the Finance & Investment Banking competition." },
  ],

  sectionCopy: {
    about: { eyebrow: "About", title: "Markets, mathematics and the *software* in between.", intro: "" },
    research: {
      eyebrow: "Research",
      title: "Reading the flows *behind* the prices.",
      intro: "Independent research on foreign portfolio capital in India, and on what one of the market's most-quoted statistics actually measures.",
    },
    projects: {
      eyebrow: "Selected work",
      title: "Things I've *built* and tested.",
      intro: "Client websites, research tools and strategy studies. Outcomes are listed only where they can be verified.",
    },
    achievements: {
      eyebrow: "Achievements",
      title: "Competing where the cases are *hard*.",
      intro: "National case competitions, quantitative finals and finance fests.",
    },
    experience: { eyebrow: "Experience", title: "Where the work *happened*.", intro: "Internship, positions of responsibility, leadership and sport." },
    skills: {
      eyebrow: "Toolkit",
      title: "Skills, with the *evidence* attached.",
      intro: "No ratings or progress bars. Just what I use and where I've used it.",
    },
    contact: {
      eyebrow: "Contact",
      title: "Let's talk *markets*.",
      intro: "Internships, research collaborations, competition panels or a website for your business. The quickest ways to reach me are below.",
    },
  },

  email: "snigdhrn06@gmail.com",
  phone: "+91 63616 86265",
  whatsappNumber: "916361686265",
  whatsappMessage: "Hi Snigdh, I came across your portfolio and would like to connect.",
  linkedinUrl: "https://www.linkedin.com/in/snigdh-r-n-850421383/",
  showFloatingWhatsapp: true,
  contactFormEnabled: true,

  resumeMediaId: "{{media:resume}}",
  resumeLabel: "Résumé",

  siteUrl: "",
  seoTitle: "Snigdh R.N. | Finance, Quant Research & Software",
  seoDescription:
    "Snigdh R.N. is a B.Com (Applied Finance & Analytics) student at Christ University, Bangalore, working on capital markets research, quantitative strategy backtesting, national case competitions and full-stack software.",

  accent: "lime",
  introEnabled: true,
  cursorEnabled: true,

  footerNote:
    "Research figures are as reported in my working paper. Backtests are historical simulations, not live trading results.",
};

type Seed<T> = { key: string; data: T };

export const PROJECTS: Seed<Record<string, unknown>>[] = [
  {
    key: "project:sapthagiri",
    data: {
      title: "Sapthagiri Enterprises",
      slug: "sapthagiri-enterprises",
      category: "Client work · Full-stack web",
      year: "2026",
      role: "Designer & full-stack developer",
      visual: "storefront",
      accent: "#E3B341",
      summary:
        "A full-stack online storefront and phone-first owner portal for Sapthagiri Enterprises, an established festive and celebrations brand in Bangalore.",
      description:
        "Sapthagiri Enterprises is an established Bangalore business selling festive and celebration products: festival décor, party supplies and children's costumes. I designed and built its website as part of my work building websites for businesses. It has two parts: a storefront customers can order from, and an owner portal that lets the business run its catalogue, orders and customer communication from a phone, without touching code.",
      problem:
        "Festive retail is seasonal. Halloween, Christmas, Diwali and birthdays each bring their own catalogue, banners and pages, and orders are confirmed personally over WhatsApp. The site had to make both easy: keeping content current without a developer, and turning an online order into a WhatsApp conversation with the shop.",
      solution: [
        "- **Storefront:** occasion pages, product photos, prices with discount badges (shown only when an MRP is entered), live search with a `/` shortcut, filters and sorting, product pages with photo zoom, a slide-in bag, saved items and recently viewed items.",
        "- **Celebration planner:** visitors pick an occasion and a budget and see matching products from the live catalogue.",
        "- **Checkout:** delivery or store pickup, address checks and special instructions. Each order is saved, emailed to the shop and handed to WhatsApp with the full order details.",
        "- **Customer accounts:** sign-in with name, mobile number and email, plus a 'My orders' page.",
        "- **Owner portal (/admin):** an order workflow (New → Confirmed → Ready → Delivered) with ready-made customer messages, a customer list with one-tap WhatsApp/email and a spreadsheet export, and full control of products, occasions, banners, stores, the announcement bar and message templates.",
        "- **Phone-first design:** a bottom tab bar and a sticky 'Add to bag' bar on product pages.",
      ].join("\n"),
      contribution:
        "I designed and built it end to end: the storefront interface and its opening animation, the Express API, the PostgreSQL schema, customer and owner authentication, image handling, and deployment on Render with a Neon database.",
      techStack: ["Node.js", "Express", "PostgreSQL", "Neon", "JavaScript", "HTML & CSS", "Render", "WhatsApp click-to-chat"],
      outcomes: [],
      caseStudy: [
        "### Architecture",
        "- **One Express server** serves a JSON API, the storefront and the owner portal. The browser code is plain JavaScript, with no build step.",
        "- **PostgreSQL** holds settings, products, occasions, stores, customers, orders and images. Tables are created and filled with starter content on first start.",
        "- **Images live in the database**, so uploads survive restarts and redeploys on Render's ephemeral filesystem.",
        "- **Security:** the owner password is hashed with scrypt, sessions use signed HTTP-only cookies, and login and order endpoints are rate-limited.",
        "- **Hosting:** a Render web service with Neon Postgres, using a pooled connection for traffic and a direct connection for schema changes.",
        "",
        "### Key decisions",
        "- **WhatsApp-first ordering.** Orders reach the shop the way it already works with customers. For store pickups, the order also goes to that store's own number.",
        "- **No SMS OTP.** OTP messages cost money per login, so customers sign in with name, mobile and email. Their details appear in the portal straight away.",
        "- **Everything editable.** Every customer-facing text, image and price comes from the portal. Discounts appear only when the owner enters an original price.",
        "",
        "### Where it could go next",
        "- Online payments at checkout",
        "- Stock levels synced across stores",
        "- Privacy-friendly analytics to see which occasions and products draw visitors",
      ].join("\n"),
      disclaimer: "Screenshots show the build running locally with its starter sample catalogue, not the shop's live product data.",
      liveUrl: "",
      repoUrl: "",
      featured: true,
      status: "published",
      gallery: [
        { mediaId: "{{media:sapthagiri-home}}", caption: "Storefront home page (local build, sample catalogue)" },
        { mediaId: "{{media:sapthagiri-shop}}", caption: "Catalogue with search, filters and sorting" },
        { mediaId: "{{media:sapthagiri-mobile}}", caption: "Phone layout with the bottom tab bar" },
        { mediaId: "{{media:sapthagiri-admin}}", caption: "Owner portal dashboard" },
      ],
    },
  },
  {
    key: "project:alpha-beta",
    data: {
      title: "Alpha-Beta",
      slug: "alpha-beta-pdf-utility",
      category: "Software · Shipped",
      year: "",
      role: "Developer",
      visual: "documents",
      accent: "#7CC4FF",
      summary: "A full-featured PDF utility app I built and deployed for college-wide use.",
      description:
        "Alpha-Beta is a full-featured PDF utility application that I built and deployed for use across my college.",
      techStack: [],
      featured: true,
      status: "published",
    },
  },
  {
    key: "project:pulse",
    data: {
      title: "PULSE",
      slug: "pulse",
      category: "",
      visual: "pulse",
      summary: "",
      description:
        "Draft placeholder. Add PULSE's real description, features, screenshots and links in the admin portal, then publish it. This draft is never shown publicly.",
      featured: false,
      status: "draft",
    },
  },
  {
    key: "project:capital-verdict",
    data: {
      title: "Trend-Managed European Equity Strategy",
      slug: "capital-verdict-trend-strategy",
      category: "Quant competition · 3rd place",
      year: "2026",
      role: "Solo finalist",
      visual: "drawdown",
      accent: "#C8F560",
      summary:
        "My third-place finals entry at The Capital Verdict (IIT Bombay × QuantInsti, Avenues 2026): a trend-managed European equity strategy, stress-tested across 1,471 logged tests with a locked out-of-sample run.",
      description:
        "The Capital Verdict was my first quantitative finance competition, and I presented the finals solo against teams from IITs and IIMs. I built and stress-tested a trend-managed European equity strategy, logging 1,471 tests and holding back a locked out-of-sample run. In the backtest, the strategy's worst drawdown was −32%, against −51% for the equal-weight benchmark.",
      problem:
        "Build an equity strategy that holds up under scrutiny: one that controls downside risk rather than just maximising backtested return, and defend it live against teams from IITs and IIMs.",
      solution:
        "A trend-managed allocation across European equities. Every test was logged (1,471 in total) so the research process could be audited, and the final configuration was checked on a locked out-of-sample period that played no part in its design.",
      contribution: "Strategy design, backtesting and stress testing, and the solo finals presentation.",
      techStack: ["Backtesting", "Out-of-sample validation", "Risk management", "Trend following"],
      outcomes: [
        "3rd place in the finals: The Capital Verdict, IIT Bombay × QuantInsti (Avenues 2026)",
        "Backtested worst drawdown of −32%, against −51% for the equal-weight benchmark",
        "1,471 logged tests and a locked out-of-sample run",
      ],
      disclaimer: "Historical backtest results from a competition entry. They are not live trading performance and do not predict future returns.",
      featured: true,
      status: "published",
    },
  },
  {
    key: "project:seasonality",
    data: {
      title: "Seasonal Trading Signal Research",
      slug: "seasonal-trading-signals",
      category: "Quant research · Backtesting",
      year: "2025",
      role: "Equity & Markets Analyst (Intern), Cautilya Capitals",
      visual: "seasonality",
      accent: "#8FD3C8",
      summary:
        "Backtesting seasonality-based trading signals across multiple instruments, for an Indian adaptation of Jay Kaeppel's seasonality research.",
      description:
        "At Cautilya Capitals I assisted the founder in developing an Indian adaptation of Jay Kaeppel's seasonality-based market research. My part was the testing: deriving patterns from raw market datasets and backtesting seasonality-based signals and F&O strategies across multiple instruments.",
      caseStudy: [
        "### Research workflow",
        "1. **Raw market data:** start from raw datasets for the instruments under study.",
        "2. **Pattern discovery:** derive recurring seasonal patterns from the data.",
        "3. **Backtesting:** test seasonality-based signals and F&O strategies across multiple instruments.",
        "",
        "This was research and historical testing, carried out under the mentorship of Mr. Arun Ayyar (PhD, IIT Madras) and senior IIT Madras faculty.",
      ].join("\n"),
      techStack: ["Python", "Market data processing", "Backtesting", "Futures & options"],
      disclaimer: "Research and historical backtesting only. Not live trading or investment advice.",
      featured: false,
      status: "published",
    },
  },
  {
    key: "project:fpi-dashboard",
    data: {
      title: "Interactive FPI Correlation Dashboard",
      slug: "fpi-correlation-dashboard",
      category: "Research tooling · Data visualisation",
      year: "2025",
      role: "Project lead, Tracking FPI Inflows (Cautilya Capitals)",
      visual: "heatmap",
      accent: "#F2A65A",
      summary:
        "A Python dashboard showing how foreign portfolio investment flows relate to Indian indices, with a heatmap of FPI flows against crude oil and gold prices.",
      description:
        "Built during the Tracking FPI Inflows project I led at Cautilya Capitals. I scraped and processed FPI data from NSDL, analysed fortnightly trends, and presented the findings in an interactive dashboard. It includes a heatmap correlating FPI inflows with crude oil and gold prices, to identify potential drivers of investment behaviour. The dashboard also became one of the internal tools used in live research workflows.",
      techStack: ["Python", "Web scraping", "NSDL data", "Data visualisation", "Dashboards"],
      featured: false,
      status: "published",
    },
  },
  {
    key: "project:mock-trading",
    data: {
      title: "Mock Stock Trading Platform",
      slug: "mock-trading-platform",
      category: "Research tooling · Simulation",
      year: "2025",
      role: "Developer, Cautilya Capitals",
      visual: "terminal",
      accent: "#B9A6FF",
      summary: "A simulated trading environment for testing strategies before they meet live markets.",
      description:
        "An internal tool I developed at Cautilya Capitals for research and trading workflows: a simulated environment for testing strategies before going live.",
      techStack: ["Python", "Simulation"],
      disclaimer: "A simulation environment. Trades placed in it are not real.",
      featured: false,
      status: "published",
    },
  },
  {
    key: "project:sentinel",
    data: {
      title: "Sentinel",
      slug: "sentinel",
      category: "Fintech · AI",
      visual: "grid",
      summary: "An AI financial-decision firewall that reads the conversation behind a payment to catch scams before money moves.",
      description:
        "Draft created from the Sentinel app in this repository (see the repository README). Review, edit and publish if you'd like to showcase it.\n\nA scammer can talk someone into a perfectly normal-looking UPI transfer. Sentinel reads the conversation behind the payment: it extracts manipulation signals, reconstructs the attack chain, scores the risk, and holds the payment until the user has verified it. All data in the app is synthetic, and no real transactions are executed.",
      techStack: ["Next.js", "TypeScript", "Claude API", "Recharts", "Framer Motion"],
      featured: false,
      status: "draft",
    },
  },
];

export const RESEARCH: Seed<Record<string, unknown>>[] = [
  {
    key: "research:fpi-paper",
    data: {
      title: "Marked to Market, Mistaken for Money",
      subtitle: "Foreign Portfolio Capital, Valuation Illusions and the Rupee–Yuan Rotation on India's Road to 2047",
      slug: "marked-to-market-mistaken-for-money",
      kind: "paper",
      venue: "Submitted to IIMC-FRC",
      year: "",
      tags: ["FPI flows", "Indian equities", "Stock–flow correction", "Exchange rates"],
      abstract:
        "The fortnightly change in foreign portfolio investors' assets under custody (AUC) is widely reported as if it were money flowing into or out of India. This paper shows that it mostly measures price movements: the reported change is a median **6.25 times** the true flow, and revaluation explains **85%** of its variance. Using a valuation-corrected measure, it re-examines foreign investors' sector allocation and the link between foreign buying and the rupee–yuan exchange rate.",
      question:
        "How much of the widely reported fortnightly change in FPI assets under custody reflects genuine capital flows, and how much is simply the revaluation of existing holdings?",
      motivation:
        "Changes in FPI holdings are routinely read as a gauge of foreign investors' appetite for India. If those changes are dominated by price movements, conclusions drawn from them about flows, sector preferences and investor behaviour can mislead.",
      dataSources: [
        "- **NSDL** depository records of foreign portfolio investment",
        "- **CDSL** depository records",
        "- Coverage: **15 sectors**, **January 2020 – February 2025**",
      ].join("\n"),
      methodology:
        "A **stock–flow correction** splits the change in the value of FPI holdings into two parts: the revaluation of existing holdings caused by price movements, and the genuine net flow of capital. The correction was validated against NSDL and CDSL depository records across 15 sectors from January 2020 to February 2025. The corrected flows were then used to decompose the change in foreign investors' sector allocation and to test how foreign buying relates to the rupee–yuan exchange rate.",
      findings: [
        {
          value: "6.25×",
          label: "Reported AUC change vs. true flow (median)",
          context: "The widely reported fortnightly change in FPI assets under custody is, at the median, 6.25 times the size of the true capital flow.",
        },
        {
          value: "85%",
          label: "Of its variance is revaluation",
          context: "Price-driven revaluation of existing holdings explains 85% of the variance in the reported AUC change.",
        },
        {
          value: "86%",
          label: "Of the financials 'exit' was price, not selling",
          context: "Of the reported fall in FPI allocation to financial stocks between 2020 and 2024, 86% reflects the sector's relative price performance rather than foreign selling.",
        },
        {
          value: "t = −4.46",
          label: "Rupee–yuan and foreign buying",
          context: "Foreign investors tend to buy Indian equities when the rupee strengthens against the yuan and sell when it weakens. This is consistent with India and China competing for emerging-market capital.",
        },
      ],
      readingNote:
        "Figures are as reported in the working paper. The rupee–yuan result is a statistical association. It is consistent with competition between India and China for emerging-market capital, but does not prove it.",
      featured: true,
      status: "published",
    },
  },
];

export const ACHIEVEMENTS: Seed<Record<string, unknown>>[] = [
  {
    key: "ach:viksit",
    data: {
      title: "2nd Place", placement: 2, kind: "award", featured: true, status: "published", year: "2026",
      event: "Viksit: Economicus Case Challenge, Grand Finale",
      institution: "Avenues 2026, IIT Bombay",
      description: "Modelled the FX and jobs impact of AI on India's IT/BPO sector and proposed a pay-per-placement reskilling compact: the SHIFT Compact.",
    },
  },
  {
    key: "ach:capital-verdict",
    data: {
      title: "3rd Place", placement: 3, kind: "award", featured: true, status: "published", year: "2026",
      event: "The Capital Verdict, Finals",
      institution: "IIT Bombay × QuantInsti, Avenues 2026",
      description:
        "Presented the finals solo against teams from IITs and IIMs, in my first quantitative finance competition. Built and stress-tested a trend-managed European equity strategy (1,471 logged tests, locked out-of-sample run). In backtests it cut worst drawdown to −32%, against −51% for the equal-weight benchmark.",
    },
  },
  {
    key: "ach:organon",
    data: {
      title: "1st Place", placement: 1, kind: "award", featured: true, status: "published", year: "2026",
      event: "Organon 'Call for Articles' Competition",
      institution: "IIM Rohtak",
      description: "Recognised for my contribution to ANALYTICA, Organon's monthly magazine.",
    },
  },
  {
    key: "ach:market-verdict",
    data: {
      title: "2nd Place", placement: 2, kind: "award", featured: true, status: "published", year: "2026",
      event: "Market Verdict, National Finance Case Competition & Debate",
      institution: "",
      description: "Ranked 1st in Round 1 out of 1,000+ competitors, ahead of IIM and IIT teams, then cleared the pitch-deck and live cross-examination rounds.",
    },
  },
  {
    key: "ach:policynomics",
    data: {
      title: "1st Runner-Up", placement: 2, kind: "award", featured: false, status: "published", year: "2026",
      event: "Shri Ram Policynomics: Delta, The Policy Conclave",
      institution: "SRCC, in collaboration with Mochatrade",
      description: "",
    },
  },
  {
    key: "ach:mochaverse",
    data: {
      title: "Top 7", placement: null, kind: "award", featured: false, status: "published", year: "2026",
      event: "Mochaverse (VENIX)",
      institution: "IIM Bangalore",
      description: "Cleared a national quantitative screening of 3,000+ participants and was shortlisted to pitch a turnaround strategy to Mochatrade's founders.",
    },
  },
  {
    key: "ach:sbi-quiz",
    data: {
      title: "3rd Place", placement: 3, kind: "award", featured: false, status: "published", year: "",
      event: "SBI National Financial Literacy Quiz",
      institution: "",
      description: "",
    },
  },
  {
    key: "ach:national-finalist",
    data: {
      title: "Finalist, 9+ events", placement: null, kind: "recognition", featured: false, status: "published", year: "",
      event: "National case competitions",
      institution: "IIMs, IITs and other leading institutes",
      description: "",
    },
  },
  {
    key: "ach:bangalore-fests",
    data: {
      title: "1st place at 15+ fests", placement: null, kind: "recognition", featured: false, status: "published", year: "",
      event: "Business & finance fests across Bangalore",
      institution: "Institutes across Bangalore",
      description: "First position at 15+ business and finance fests, plus wins in regional quizzes on finance and investment.",
    },
  },
  {
    key: "ach:colossus-judge",
    data: {
      title: "Invited Judge", placement: null, kind: "invitation", featured: true, status: "published", year: "2026",
      event: "Colossus '26: Finance & Investment Banking competition",
      institution: "Christ Junior College",
      description:
        "Invited to judge the Finance & Investment Banking competition at Colossus '26, Christ Junior College's annual commerce fest. I previously led the same vertical as Event Head.",
    },
  },
];

export const EDUCATION: Seed<Record<string, unknown>>[] = [
  {
    key: "edu:christ-university",
    data: {
      institution: "Christ University, Bangalore", qualification: "B.Com", field: "Applied Finance & Analytics",
      startDate: "2026", endDate: "Present", location: "Bangalore", score: "",
      description: "Active participant in the university's finance, entrepreneurship and technology clubs.",
      status: "published",
    },
  },
  {
    key: "edu:christ-junior-college",
    data: {
      institution: "Christ Junior College, Bangalore", qualification: "Class XII", field: "State Board",
      startDate: "2024", endDate: "2026", location: "Bangalore", score: "95%", description: "", status: "published",
    },
  },
];

export const EXPERIENCE: Seed<Record<string, unknown>>[] = [
  {
    key: "exp:cautilya",
    data: {
      organization: "Cautilya Capitals (Cautilya Traders Academy LLP)", role: "Equity & Markets Analyst (Intern)", kind: "work",
      location: "Bangalore", startDate: "Mar 2025", endDate: "Sep 2025",
      summary: "Mentored by Mr. Arun Ayyar (PhD, IIT Madras) and senior IIT Madras faculty.",
      highlights: [
        "Assisted the founder in developing an Indian adaptation of Jay Kaeppel's seasonality-based market research; backtested F&O strategies and derived patterns from raw market datasets.",
        "Led the project Tracking FPI Inflows: scraped and processed FPI data from NSDL and analysed fortnightly trends in foreign portfolio investment.",
        "Built an interactive dashboard presenting the findings, and a heatmap correlating FPI inflows with crude oil and gold prices to identify potential drivers of investment behaviour.",
        "Developed internal tools for live research and trading workflows, including an FPI-flow correlation dashboard and a mock trading platform.",
        "Recognised in the internship certificate for technical and analytical strength, data storytelling and on-time delivery.",
      ],
      status: "published",
    },
  },
  {
    key: "exp:wall-street-society",
    data: {
      organization: "Wall Street Society, Christ University", role: "Junior Analyst, Technicals & Derivatives", kind: "position",
      location: "Bangalore", startDate: "2026", endDate: "Present",
      summary: "The Department of Commerce's only finance and investment cell.",
      highlights: ["Research markets and backtest trading strategies.", "Help host and run flagship events, including SPECUL8 and Opening Bell."],
      status: "published",
    },
  },
  {
    key: "exp:cuca",
    data: {
      organization: "Christ University Commerce Association (CUCA)", role: "Associate, Finance Vertical", kind: "position",
      location: "Bangalore", startDate: "2026", endDate: "Present", summary: "",
      highlights: [
        "Solved complex case studies on M&A, demergers, and capital and bond markets.",
        "Help organise Prayas, the department's national-level annual commerce fest.",
      ],
      status: "published",
    },
  },
  {
    key: "exp:bsummit",
    data: {
      organization: "B.Summit v11, Christ Junior College", role: "Student Coordinator", kind: "leadership",
      location: "Bangalore", startDate: "2024", endDate: "2025", summary: "",
      highlights: [
        "Led an organising team of 25, coordinating logistics and execution for the college's annual business fest.",
        "Brought in sponsorship worth INR 4 lakh in cash and kind.",
        "Addressed a gathering of 450 students on the day of the fest.",
      ],
      status: "published",
    },
  },
  {
    key: "exp:colossus",
    data: {
      organization: "Colossus, Christ Junior College", role: "Event Head, Finance & Investment Banking", kind: "leadership",
      location: "Bangalore", startDate: "2024", endDate: "2025", summary: "",
      highlights: ["Led the Finance & Investment Banking vertical for the college's annual commerce fest."],
      status: "published",
    },
  },
  {
    key: "exp:cricket",
    data: {
      organization: "Mysore, Under-16 State Level", role: "Cricket", kind: "sport",
      location: "Karnataka", startDate: "2023", endDate: "2024", summary: "",
      highlights: ["Represented Mysore at state-level tournaments; consistent district-level performer and team leader."],
      status: "published",
    },
  },
];

/** Skills: category → [name, evidence, project seed key?] */
export const SKILLS: { key: string; name: string; description: string; skills: [string, string, string?][] }[] = [
  {
    key: "skillcat:finance",
    name: "Finance & markets",
    description: "",
    skills: [
      ["Futures & Options (F&O)", "F&O strategy backtests at Cautilya Capitals", "project:seasonality"],
      ["Technical analysis", "Junior Analyst, Technicals & Derivatives, Wall Street Society"],
      ["Fundamental analysis", "Case competitions and CUCA case work"],
      ["Macro analysis", "FPI flows and the rupee–yuan exchange rate in my research paper"],
      ["FPI flow analysis", "Tracking FPI Inflows project and the IIMC-FRC paper", "project:fpi-dashboard"],
    ],
  },
  {
    key: "skillcat:quant",
    name: "Quantitative research",
    description: "",
    skills: [
      ["Backtesting", "1,471 logged tests for The Capital Verdict", "project:capital-verdict"],
      ["Seasonality research", "Indian adaptation of Jay Kaeppel's seasonality research", "project:seasonality"],
      ["Strategy testing environments", "Mock trading platform for pre-live testing", "project:mock-trading"],
    ],
  },
  {
    key: "skillcat:programming",
    name: "Programming & data",
    description: "",
    skills: [
      ["Python", "FPI correlation dashboard", "project:fpi-dashboard"],
      ["SQL", ""],
      ["Excel", ""],
      ["Data scraping & processing", "NSDL FPI data pipeline", "project:fpi-dashboard"],
      ["Dashboard development & data visualisation", "FPI flow-to-index dashboard and heatmap", "project:fpi-dashboard"],
      ["Full-stack web development", "Node.js, Express and PostgreSQL storefront", "project:sapthagiri"],
      ["AI tools & automation", ""],
    ],
  },
  {
    key: "skillcat:modelling",
    name: "Financial modelling",
    description: "",
    skills: [
      ["Financial modelling", "Modelled the FX and jobs impact of AI on India's IT/BPO sector (Viksit: Economicus)"],
      ["Case analysis & pitch decks", "Finalist in 9+ national case competitions"],
    ],
  },
  {
    key: "skillcat:communication",
    name: "Research & communication",
    description: "",
    skills: [
      ["Market research & writing", "IIMC-FRC paper; 1st place, Organon (ANALYTICA magazine)"],
      ["Public speaking & debate", "Market Verdict cross-examination rounds; addressed 450 students at B.Summit v11"],
      ["Event management", "B.Summit v11 and Colossus"],
    ],
  },
];

export const SOCIAL_LINKS: Seed<Record<string, unknown>>[] = [
  { key: "social:linkedin", data: { label: "LinkedIn", url: "https://www.linkedin.com/in/snigdh-r-n-850421383/", icon: "linkedin", status: "published" } },
  { key: "social:email", data: { label: "Email", url: "mailto:snigdhrn06@gmail.com", icon: "mail", status: "published" } },
  { key: "social:github", data: { label: "GitHub", url: "https://github.com/snigdhrn06-lab", icon: "github", status: "draft" } },
];
