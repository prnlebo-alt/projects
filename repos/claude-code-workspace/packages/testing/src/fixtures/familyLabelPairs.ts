import type { FamilyLabelPair } from "../benchmark/metrics.js";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-08-01T12:00:00Z");

/**
 * Frozen labeled corpus for the syndicated-vs-independent source-family
 * gate (BENCHMARK.md gate 5, >= 90% accuracy). Mirrors the scenarios in
 * packages/evidence/src/sourceFamily.test.ts but kept here as data so the
 * benchmark can report an aggregate accuracy number rather than pass/fail
 * per unit test.
 */
export const familyLabelPairs: FamilyLabelPair[] = [
  {
    name: "wire-service near-duplicate (rule 2)",
    expectedSameFamily: true,
    a: {
      snapshotId: "p1a",
      sourceId: "s1a",
      canonicalUrl: "https://prnewswire.example/acme-launch",
      normalizedText:
        'Acme Robotics today announced general availability of its Finance Agent. ' +
        '"This changes everything for revenue teams" said CEO Jane Doe. Price: $1200/month.',
      publishedAt: T0,
      wireService: "PR Newswire",
      wireItemId: "pnw-2026-08-acme-launch"
    },
    b: {
      snapshotId: "p1b",
      sourceId: "s1b",
      canonicalUrl: "https://businesswire.example/acme-launch-copy",
      normalizedText:
        '(BUSINESS WIRE) -- Acme Robotics announced general availability of its Finance Agent today. ' +
        '"This changes everything for revenue teams" said CEO Jane Doe. Price: $1200/month.',
      publishedAt: T0,
      wireService: "PR Newswire",
      wireItemId: "pnw-2026-08-acme-launch"
    }
  },
  {
    name: "defect #4: same wire service, two unrelated releases (no shared item ID) — must stay separate",
    expectedSameFamily: false,
    a: {
      snapshotId: "p11a",
      sourceId: "s11a",
      canonicalUrl: "https://prnewswire.example/acme-launch-unrelated",
      normalizedText: "Acme Robotics today announced general availability of its Finance Agent.",
      publishedAt: T0,
      wireService: "PR Newswire",
      wireItemId: "pnw-2026-08-acme-launch"
    },
    b: {
      snapshotId: "p11b",
      sourceId: "s11b",
      canonicalUrl: "https://prnewswire.example/other-corp-partnership",
      normalizedText: "Other Corp today announced a new logistics partnership in Europe.",
      publishedAt: new Date(T0.getTime() + DAY),
      wireService: "PR Newswire",
      wireItemId: "pnw-2026-08-other-corp"
    }
  },
  {
    name: "near-identical rewrite within 7 days + shared quote (rule 3)",
    expectedSameFamily: true,
    a: {
      snapshotId: "p2a",
      sourceId: "s2a",
      canonicalUrl: "https://outlet-a.example/story",
      normalizedText:
        'Acme Robotics announced the general availability of its new Finance Agent for mid market ' +
        'Salesforce customers this week. "This changes everything for revenue teams" said CEO Jane Doe ' +
        "in a statement. Available now via AppExchange at one thousand two hundred dollars per month.",
      publishedAt: T0
    },
    b: {
      snapshotId: "p2b",
      sourceId: "s2b",
      canonicalUrl: "https://outlet-b.example/story",
      normalizedText:
        'Acme Robotics announced today the general availability of its new Finance Agent for mid market ' +
        'Salesforce customers this week. "This changes everything for revenue teams" said CEO Jane Doe ' +
        "in a statement. Available now via AppExchange at one thousand two hundred dollars per month.",
      publishedAt: new Date(T0.getTime() + 2 * DAY)
    }
  },
  {
    name: "explicit syndication metadata (rule 5)",
    expectedSameFamily: true,
    a: {
      snapshotId: "p3a",
      sourceId: "s3a",
      canonicalUrl: "https://acme.example/press/launch",
      normalizedText: "Original press release text.",
      publishedAt: T0
    },
    b: {
      snapshotId: "p3b",
      sourceId: "s3b",
      canonicalUrl: "https://someblog.example/reposted",
      normalizedText: "Completely reformatted republished text, same underlying announcement.",
      publishedAt: new Date(T0.getTime() + DAY),
      syndicatedFromSnapshotId: "p3a"
    }
  },
  {
    name: "same canonical URL refetched (rule 1)",
    expectedSameFamily: true,
    a: {
      snapshotId: "p4a",
      sourceId: "s4a",
      canonicalUrl: "https://acme.example/finance-agent",
      normalizedText: "Acme Finance Agent product page v1.",
      publishedAt: T0
    },
    b: {
      snapshotId: "p4b",
      sourceId: "s4a",
      canonicalUrl: "https://acme.example/finance-agent",
      normalizedText: "Acme Finance Agent product page v2, pricing updated.",
      publishedAt: new Date(T0.getTime() + DAY)
    }
  },
  {
    name: "two genuinely independent reports, same topic",
    expectedSameFamily: false,
    a: {
      snapshotId: "p5a",
      sourceId: "s5a",
      canonicalUrl: "https://forrester.example/report",
      normalizedText:
        "Industry analysts at Forrester noted this quarter that several Salesforce-native finance " +
        "vendors are racing to add agentic collections tooling, citing Acme Robotics as one of at " +
        "least four companies now shipping similar automation to mid-market revenue teams.",
      publishedAt: T0
    },
    b: {
      snapshotId: "p5b",
      sourceId: "s5b",
      canonicalUrl: "https://techcrunch.example/story",
      normalizedText:
        "TechCrunch reports that Acme Robotics quietly rolled out an AI collections feature, joining " +
        "rivals like Zilliant and Sidetrade in a crowded push toward automated finance workflows for " +
        "smaller Salesforce shops.",
      publishedAt: new Date(T0.getTime() + DAY)
    }
  },
  {
    name: "high similarity + time proximity but NO shared fingerprint (ADR-003)",
    expectedSameFamily: false,
    a: {
      snapshotId: "p6a",
      sourceId: "s6a",
      canonicalUrl: "https://outlet-a.example/story2",
      normalizedText:
        "Acme Robotics announced the general availability of its new Finance Agent for mid market " +
        "Salesforce customers this week. The company said the tool automates collections workflows " +
        "and expands its existing platform. The product is available immediately through the " +
        "Salesforce AppExchange for the standard tier.",
      publishedAt: T0
    },
    b: {
      snapshotId: "p6b",
      sourceId: "s6b",
      canonicalUrl: "https://outlet-b.example/story2",
      normalizedText:
        "Acme Robotics announced the general availability of its new Finance Agent for mid market " +
        "Salesforce customers this week. The company said the tool automates collections workflows " +
        "and expands its existing platform. The product is now available through the Salesforce " +
        "AppExchange for the standard tier.",
      publishedAt: new Date(T0.getTime() + DAY)
    }
  },
  {
    name: "identical text but published 10 days apart (outside 7-day window)",
    expectedSameFamily: false,
    a: {
      snapshotId: "p7a",
      sourceId: "s7a",
      canonicalUrl: "https://outlet-a.example/story3",
      normalizedText: 'Acme announced GA of Finance Agent. "This changes everything" said the CEO. $1200/mo.',
      publishedAt: T0
    },
    b: {
      snapshotId: "p7b",
      sourceId: "s7b",
      canonicalUrl: "https://outlet-b.example/story3",
      normalizedText: 'Acme announced GA of Finance Agent. "This changes everything" said the CEO. $1200/mo.',
      publishedAt: new Date(T0.getTime() + 10 * DAY)
    }
  },
  {
    name: "moderate rewrite (0.80-0.90 similarity) + shared fingerprint (rule 4)",
    expectedSameFamily: true,
    a: {
      snapshotId: "p8a",
      sourceId: "s8a",
      canonicalUrl: "https://outlet-a.example/story4",
      normalizedText:
        'Acme Robotics announced the general availability of its new Finance Agent for mid market ' +
        'Salesforce customers this week. "This changes everything for revenue teams" said CEO Jane Doe ' +
        "in a statement. Available immediately via AppExchange at one thousand two hundred dollars " +
        "per month for the standard tier.",
      publishedAt: T0
    },
    b: {
      snapshotId: "p8b",
      sourceId: "s8b",
      canonicalUrl: "https://outlet-b.example/story4",
      normalizedText:
        'Acme Robotics this week announced general availability for its new Finance Agent built for ' +
        'mid market Salesforce customers. "This changes everything for revenue teams" said CEO Jane ' +
        "Doe in a statement to press. Available now via AppExchange at one thousand two hundred " +
        "dollars per month for the standard tier.",
      publishedAt: new Date(T0.getTime() + 3 * DAY)
    }
  },
  {
    name: "totally unrelated topics, coincidental short overlap",
    expectedSameFamily: false,
    a: {
      snapshotId: "p9a",
      sourceId: "s9a",
      canonicalUrl: "https://weather.example/report",
      normalizedText: "Regional weather forecast calls for rain across the mid-Atlantic this weekend.",
      publishedAt: T0
    },
    b: {
      snapshotId: "p9b",
      sourceId: "s9b",
      canonicalUrl: "https://sports.example/recap",
      normalizedText: "The home team secured a decisive win in Saturday's regional playoff matchup.",
      publishedAt: new Date(T0.getTime() + DAY)
    }
  },
  {
    name: "same canonical publisher item ID, different tracking-param URLs (rule 1)",
    expectedSameFamily: true,
    a: {
      snapshotId: "p10a",
      sourceId: "s10a",
      canonicalUrl: "https://news.example/story?utm_source=twitter",
      canonicalPublisherItemId: "news-12345",
      normalizedText: "Acme Robotics story, shared via Twitter link.",
      publishedAt: T0
    },
    b: {
      snapshotId: "p10b",
      sourceId: "s10b",
      canonicalUrl: "https://news.example/story?utm_source=newsletter",
      canonicalPublisherItemId: "news-12345",
      normalizedText: "Acme Robotics story, shared via newsletter link.",
      publishedAt: new Date(T0.getTime() + DAY)
    }
  }
];
