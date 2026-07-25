import type {
  FixtureMaterial,
  FixtureModule,
  FixturePage,
} from "../types";

/**
 * The durable teaching corpus behind the ECON-241 demo world.
 *
 * These records intentionally contain the kind of substantial prose, worked
 * examples, datasets, and prompts that an instructor actually puts around an
 * intermediate microeconomics course. The fixture uses the same text for LMS
 * pages and material extraction, so an agent works from a usable course record
 * rather than from short labels that merely satisfy the schema.
 */

type Week = {
  week: number;
  key: string;
  title: string;
  objectives: string[];
  topic: string;
  centralQuestion: string;
  model: string;
  caseEvidence: string;
  mistake: string;
  application: string;
  workshop: string;
  published: boolean;
};

const assetRoot = "/seed-assets/econ-241/fall-2026";

const weeks: Week[] = [
  {
    week: 1,
    key: "markets",
    title: "Markets, demand, and supply",
    objectives: ["LO1"],
    topic: "market equilibrium, shifts, and shortages",
    centralQuestion: "When a streaming market changes, which decision changed first: the buyer's willingness to purchase, the firm's willingness to supply, or the posted price itself?",
    model: "Students build a demand schedule and a supply schedule for VidStack, locate the clearing price, then separate a movement along a curve from a shift caused by a non-price condition. The point is not to draw a familiar X. It is to state the condition that changed and trace the new equilibrium through price, quantity, and any shortage or surplus.",
    caseEvidence: "VidStack's operations team reports a higher content-delivery cost and a separate increase in student subscriptions after a campus partnership. Those facts do not point in the same direction. The first affects supply, while the second affects demand, so students must reason about magnitudes rather than announce one obvious answer.",
    mistake: "Treating every change in quantity as a shift in demand, or treating a higher listed price as proof that demand moved. A price change can be an outcome of a shift somewhere else.",
    application: "A manager deciding whether to raise price needs a market story before a revenue story. If the service is capacity constrained, a shortage and a price increase mean something different from a price increase after customer preferences weaken.",
    workshop: "Graph the baseline market, annotate two distinct shocks, and write a six-sentence explanation that could be understood without the graph.",
    published: true,
  },
  {
    week: 2,
    key: "consumer-choice",
    title: "Consumer choice and willingness to pay",
    objectives: ["LO2"],
    topic: "reservation value, marginal benefit, and consumer surplus",
    centralQuestion: "What does a single subscription price hide about people who receive very different value from the same service?",
    model: "Students move from a market curve to a six-customer willingness-to-pay schedule. They calculate marginal benefit and consumer surplus at several prices, then explain why the same price creates different gains for a student who watches one series and a family using the service every night.",
    caseEvidence: "The VidStack schedule includes students, single-adult households, families, and heavy viewers. A three-dollar increase excludes two customers outright, reduces surplus for two others, and leaves one household with a large positive surplus. The numbers make a distributional claim visible without pretending the schedule represents every subscriber.",
    mistake: "Calling a high willingness to pay a moral judgment, or confusing the revenue that reaches the firm with the surplus that remains with a customer.",
    application: "A firm can capture more value through a tier or a bundle, but the analysis should state whose surplus changes and what evidence would support the segmentation claim.",
    workshop: "Calculate the surplus change from a price increase, then write a short recommendation that distinguishes efficiency, revenue, and access.",
    published: true,
  },
  {
    week: 3,
    key: "cost-profit",
    title: "Costs, revenue, and profit",
    objectives: ["LO3"],
    topic: "fixed cost, marginal cost, total revenue, and profit",
    centralQuestion: "Why can a digital product with a low serving cost still face a difficult output and pricing decision?",
    model: "Students separate fixed content and platform costs from the marginal cost of serving one additional subscriber. They calculate total revenue, total cost, average cost, marginal cost, and profit across a small output table before using marginal reasoning to defend a quantity choice.",
    caseEvidence: "VidStack pays for a slate of exclusive programs before the term begins, then pays small delivery and support costs as subscribers use the service. The case forces students to distinguish a cost that matters for long-run viability from the incremental cost that matters at the next subscriber.",
    mistake: "Using average cost as though it answered the question about one more unit, or concluding that zero marginal cost means a firm can ignore fixed cost entirely.",
    application: "Platform pricing often looks simple because the product is digital. The firm still needs to recover fixed cost, decide which output is profitable at the margin, and avoid using a unit-cost average as a substitute for a decision rule.",
    workshop: "Build a cost and revenue table, identify the relevant marginal comparison, and explain one conclusion the average-cost column cannot establish by itself.",
    published: true,
  },
  {
    week: 4,
    key: "elasticity",
    title: "Elasticity, incidence, and revenue",
    objectives: ["LO4"],
    topic: "price elasticity, percentage change, and total revenue",
    centralQuestion: "Why can a linear demand curve have a constant slope while customer responsiveness changes across the curve?",
    model: "Students compute elasticity from percentage changes in price and quantity, compare elastic and inelastic ranges, and connect the result to total revenue. The course uses midpoint calculations when comparing discrete prices and makes the denominator explicit so that a steep-looking line never substitutes for a percentage-response argument.",
    caseEvidence: "VidStack raised its flat price from $12.99 to $15.00 and lost 18 percent of subscribers. That observation suggests an elastic range, but it does not identify a full demand curve, a causal mechanism, or the responsiveness of every segment. Students must say what the observed change supports and what it leaves unresolved.",
    mistake: "Equating slope with elasticity, or saying that total revenue rises whenever price rises without first identifying the elasticity range.",
    application: "Elasticity is the bridge between a posted price and a revenue consequence. It also disciplines claims about churn: a customer response can be large in percentage terms even when a graph looks visually shallow.",
    workshop: "Calculate midpoint elasticity at three price changes, classify each interval, and write a short memo explaining the predicted direction of total revenue.",
    published: true,
  },
  {
    week: 5,
    key: "market-power",
    title: "Market power, markup, and churn",
    objectives: ["LO5"],
    topic: "monopoly pricing, marginal revenue, markup, and retention",
    centralQuestion: "What does a firm with market power give up when it pursues a higher price without modeling the customers who leave?",
    model: "Students compare demand, marginal revenue, and marginal cost, then distinguish a price chosen from the demand curve from the quantity chosen where marginal revenue equals marginal cost. They connect markup to substitutes, retention, and the difference between a one-period revenue calculation and customer lifetime value.",
    caseEvidence: "The VidStack management memo celebrates higher revenue per remaining subscriber after the price increase. The retention file shows that churn is concentrated among price-sensitive viewers who were also likely to recommend the service. The evidence creates a real tradeoff rather than a cartoon monopoly story.",
    mistake: "Treating a markup as a moral failing rather than a model outcome, or reading a short-run revenue increase as proof that the decision improved profit or long-run demand.",
    application: "A price can be privately profitable and still reveal a weak product strategy if it sheds the customers most likely to sustain the service. Good analysis names the relevant horizon and the counterfactual.",
    workshop: "Use the churn table to evaluate two prices, identify the marginal condition, and state the evidence required before recommending a retention offer.",
    published: true,
  },
  {
    week: 6,
    key: "price-discrimination",
    title: "Price discrimination and tier design",
    objectives: ["LO6"],
    topic: "segmentation, product fences, and cannibalization",
    centralQuestion: "How can a firm offer different prices without simply giving its highest-value customers a cheaper way to buy the same product?",
    model: "Students distinguish first-, second-, and third-degree price discrimination, then treat a tier as a mechanism: a target segment, a price, a feature bundle, and a fence. They test each fence by asking whether a higher-value customer can downgrade while retaining the value that justified a higher price.",
    caseEvidence: "The segment workbook records willingness to pay, screen count, offline viewing, advertising tolerance, and competitor subscriptions. None of those variables is a perfect segment label. Students must defend why a feature is observable, useful, and sufficiently costly to imitate.",
    mistake: "Calling any list of three prices a tiered strategy, or using a fence that customers experience as arbitrary because it does not correspond to a different use case.",
    application: "Tier design links the early consumer-surplus work to the later pricing case. A good menu can preserve access for price-sensitive viewers while charging more for features that high-value viewers genuinely value.",
    workshop: "Draft a three-tier table, run a downgrade test for each tier, and record the first fence likely to fail.",
    published: true,
  },
  {
    week: 7,
    key: "pricing-session",
    title: "Interactive Pricing Session",
    objectives: ["LO4", "LO5", "LO6"],
    topic: "evidence-grounded pricing recommendations",
    centralQuestion: "Can you move from a subscriber-loss observation to a defensible recommendation without pretending that the data proves more than it does?",
    model: "The assessed session asks students to frame the VidStack problem, use elasticity and willingness to pay, build a tier table, and revise after a cannibalization challenge. The record preserves the intermediate reasoning because a finished table cannot show whether the student made the economic distinctions that support it.",
    caseEvidence: "Students receive the flat-price churn result, the Week 6 segment workbook, the Week 5 retention memo, and their own Exam 1 topic feedback. The course agent can point to those records and question an assumption, but it cannot select the prices or write the final rationale.",
    mistake: "Starting with a polished three-tier answer, treating the 18 percent loss as a universal elasticity estimate, or ignoring the possibility that the middle tier has no separate job.",
    application: "This is the course's central synthesis. A recommendation is valuable only when another person can trace the chain from evidence to model to revision to a limited conclusion.",
    workshop: "Complete the Pricing Strategy Session, then annotate one assumption you would test with a real experiment before adopting the recommendation.",
    published: true,
  },
  {
    week: 8,
    key: "oligopoly",
    title: "Oligopoly and strategic pricing",
    objectives: ["LO5", "LO6"],
    topic: "best responses, strategic interaction, and price competition",
    centralQuestion: "How should a pricing recommendation change when a competitor can react to it?",
    model: "Students use a payoff table and best-response logic to study an entrant that can match, undercut, or ignore VidStack's move. They distinguish a static pricing choice from a strategic setting in which the payoff depends on another firm's response.",
    caseEvidence: "A new competitor launches a lower-priced, ad-supported plan with a smaller catalog. VidStack can match the price, keep its current plan, or reposition premium features. The evidence is deliberately incomplete about switching costs and quality differences, so students must surface assumptions rather than invent certainty.",
    mistake: "Treating a competitor's listed price as the only strategic fact, or asserting a Nash equilibrium without identifying each firm's best response.",
    application: "A firm that ignores likely reactions may mistake a temporary gain for a durable strategy. The analysis should specify the rival's incentive, the consumer segment that can switch, and the evidence that would update the forecast.",
    workshop: "Construct a two-firm payoff table and write a one-page recommendation that makes the rival-response assumption explicit.",
    published: true,
  },
  {
    week: 9,
    key: "bundling",
    title: "Bundling and two-sided platforms",
    objectives: ["LO5", "LO6"],
    topic: "bundles, cross-subsidies, advertising, and platform sides",
    centralQuestion: "When does a bundle create value, and when does it conceal a subsidy from one side of a platform to another?",
    model: "Students compare separate pricing and a bundle when customers value two goods differently. They then extend the analysis to an advertising-supported platform, where viewers care about interruptions and advertisers care about audience scale and composition.",
    caseEvidence: "VidStack considers bundling a sports add-on with its standard plan while expanding the ad tier. The student dataset shows that heavy sports viewers differ from price-sensitive ad-tier viewers. The platform cannot assume that a viewer-side price cut is free when it changes the advertiser product.",
    mistake: "Adding willingness to pay across goods without checking whether the customer valuations offset each other, or treating advertising revenue as unrelated to viewer experience.",
    application: "Bundling can reduce variation in combined willingness to pay and can expand participation, but the mechanism should be visible in the table rather than asserted as a general benefit.",
    workshop: "Compare the profit implications of separate pricing and a bundle, then explain one change in the viewer-side offer that would alter advertiser value.",
    published: true,
  },
  {
    week: 10,
    key: "information",
    title: "Information, signaling, and quality",
    objectives: ["LO4", "LO5"],
    topic: "adverse selection, signaling, and quality uncertainty",
    centralQuestion: "What can a platform credibly tell a customer who cannot evaluate quality before paying?",
    model: "Students examine asymmetric information, adverse selection, and costly signals. They evaluate free trials, refund policies, audience metrics, and quality guarantees by asking whether a low-quality firm could cheaply imitate the signal.",
    caseEvidence: "VidStack publishes a selective viewership chart before launching a new tier. The chart may be informative, promotional, or both. Students identify the missing denominator, the incentive to select a favorable metric, and a more credible signal that would be costly for a weak service to mimic.",
    mistake: "Calling any advertisement a signal, or assuming that more information always benefits the market when the information is strategically selected.",
    application: "Information problems affect churn because customers decide before they know how much value they will receive. A pricing recommendation should therefore consider trial design, cancellation friction, and the credibility of quality claims.",
    workshop: "Evaluate two proposed signals, identify the likely mimicry problem, and recommend a trial policy with a stated consumer-risk tradeoff.",
    published: true,
  },
  {
    week: 11,
    key: "welfare",
    title: "Welfare, surplus, and policy",
    objectives: ["LO2", "LO5"],
    topic: "consumer surplus, producer surplus, and policy evaluation",
    centralQuestion: "What is a regulator measuring when a price practice changes who can buy, who earns, and what trades disappear?",
    model: "Students calculate consumer surplus, producer surplus, total surplus, and deadweight loss under two pricing regimes. They then separate an efficiency claim from a distributional claim and identify the evidence a regulator would need before treating a stylized demand schedule as a policy forecast.",
    caseEvidence: "A proposed merger would combine VidStack with a niche sports catalog. The merged firm claims that a higher bundle price funds new production; consumer advocates point to reduced choice for households that value only one catalog. The data support a calculation, not an automatic policy conclusion.",
    mistake: "Treating total surplus as the only relevant policy value, or treating a transfer between buyers and sellers as though it were deadweight loss.",
    application: "Policy analysis asks whose options change and which trades no longer occur. It should not hide a normative judgment inside a single efficiency number.",
    workshop: "Write a regulator memo that computes the relevant surplus changes and lists three facts still needed before recommending approval or intervention.",
    published: true,
  },
  {
    week: 12,
    key: "behavioral-pricing",
    title: "Behavioral pricing and fairness",
    objectives: ["LO5", "LO6"],
    topic: "reference dependence, fairness, and price perception",
    centralQuestion: "What should an economist do when customers react to a price change in ways a simple willingness-to-pay model does not fully capture?",
    model: "Students add reference prices, loss aversion, and fairness perceptions to the earlier demand framework. They learn to use behavioral evidence as a disciplined extension, not as an excuse to abandon an explicit model whenever an outcome is inconvenient.",
    caseEvidence: "VidStack's subscribers react more strongly to the removal of a grandfathered plan than to an equivalent discount on a new plan. The difference could reflect reference dependence, trust, or an unobserved change in service quality. Students identify competing explanations and the experiment that could separate them.",
    mistake: "Calling a customer response irrational because it violates a narrow model, or using fairness language without identifying a concrete institutional practice that customers experience as unfair.",
    application: "Pricing is not only a mechanism for capturing revenue. It communicates a relationship with customers, especially when a service changes the terms of an existing plan.",
    workshop: "Design an A/B test that distinguishes a reference-price effect from a quality-change explanation and state the ethical constraint on the test.",
    published: false,
  },
  {
    week: 13,
    key: "project-workshop",
    title: "Final project workshop",
    objectives: ["LO6"],
    topic: "model choice, evidence, and revision",
    centralQuestion: "Does the mechanism actually explain the recommendation, or do the prices arrive before the economic argument?",
    model: "Students bring a draft recommendation with a demand story, a cost or competition constraint, a proposed price mechanism, and an explicit limitation. Peer review focuses on the chain of reasoning and on whether the student can say what observation would change the conclusion.",
    caseEvidence: "Project proposals may use a market other than streaming, but each must include a small evidence table and a defensible proxy for willingness to pay, cost, or competitive response. A polished visual is not a substitute for a model.",
    mistake: "Treating a list of prices as a strategy, or treating a data point as causal evidence without discussing selection, measurement, or a counterfactual.",
    application: "The final workshop makes the course's recurring habit explicit: name the decision, name the constraint, choose a model that speaks to it, and state what the model leaves out.",
    workshop: "Exchange drafts, test one assumption in a peer's argument, and revise the claim so that its certainty matches the evidence.",
    published: false,
  },
  {
    week: 14,
    key: "synthesis",
    title: "Review and synthesis",
    objectives: ["LO1", "LO4", "LO5", "LO6"],
    topic: "integrated microeconomic reasoning",
    centralQuestion: "Which model answers the decision in front of us, and what would make us switch models?",
    model: "The final review connects competitive equilibrium, consumer choice, cost, elasticity, market power, strategic response, welfare, and pricing design. Students practice selecting a model before calculating, then explain why a tempting alternative model would answer a different question.",
    caseEvidence: "The synthesis packet revisits the VidStack case with new information about competitor entry, advertising revenue, and customer complaints. The point is not to produce one final correct price but to show how the recommendation changes as the question and evidence change.",
    mistake: "Using every concept at once, or treating a comprehensive review as a list of definitions rather than a set of decision rules.",
    application: "A defensible recommendation is proportionate to the evidence. It becomes stronger when its author can identify the next observation that would support, complicate, or overturn it.",
    workshop: "Complete a cumulative case analysis and write a short reflection identifying the economic distinction you now check first.",
    published: false,
  },
];

function words(text: string): string {
  return text.replace(/\n\s+/g, "\n").trim();
}

function heading(level: 1 | 2 | 3, text: string): string {
  return `${"#".repeat(level)} ${text}`;
}

function pageBody(week: Week, angle: "model" | "case"): string {
  const emphasis = angle === "model"
    ? `The working model for this reading is ${week.model}`
    : `The case reading begins with this evidence: ${week.caseEvidence}`;
  const counterweight = angle === "model"
    ? `The VidStack example keeps the abstraction accountable. ${week.caseEvidence}`
    : `The model gives the case structure. ${week.model}`;
  return words(`
${heading(1, `${week.title}: ${angle === "model" ? "Analytic framework" : "Case analysis"}`)}

${emphasis}

${heading(2, "What the model explains")}

${week.model} In this course, an economic model is not a decorative graph or a vocabulary word. It is a deliberately limited account of which decision-maker faces which constraint. Before doing arithmetic, identify the unit of analysis, the choice under consideration, the relevant margin, and the variable that is allowed to change. That sequence keeps a calculation from becoming an answer to a question no one asked.

For ${week.topic}, students should make each link in the argument visible. Name the assumption, describe the mechanism, calculate only what the mechanism requires, and interpret the result in ordinary language. A conclusion is incomplete if it gives a number without saying what that number means for buyers, sellers, output, surplus, revenue, or the feasibility of the proposed decision.

${heading(2, "VidStack as an applied case")}

${counterweight} The case is intentionally specific enough to force a judgment and incomplete enough to require restraint. A student can use the available schedule, cost table, retention pattern, or competitor information to defend a conditional recommendation. The same student should not invent a causal estimate, a universal customer preference, or a precise profit forecast that the record does not support.

The useful question is not whether VidStack is literally every platform. The useful question is what an analyst would need to distinguish competing explanations. A price increase may coincide with churn because demand is elastic, because a competitor changed the outside option, because product quality changed, because a promotional period ended, or because the billing experience broke trust. The model helps identify what evidence would separate those possibilities.

${heading(2, "A worked way to reason")}

Start by restating the decision in a sentence. Then list the facts that belong in the model and the facts that are background only. Next, show the comparison: before and after, marginal and average, elastic and inelastic, buyer and seller, or one strategic response and another. Explain the direction of the result before committing to a numerical conclusion. Finally, write the limitation that would most change the recommendation. This method is more valuable than a long answer that hides its reasoning.

${heading(2, "Common error to avoid")}

${week.mistake} When that error appears, stop and identify the missing distinction. Ask whether the argument has confused a cause with an outcome, an average with a margin, a price with a shift, a graph's visual shape with a percentage calculation, or an observed pattern with a causal claim. Correcting the distinction usually changes the sentence before it changes the arithmetic.

${heading(2, "For discussion and written work")}

${week.application} ${week.workshop} A strong response uses the course vocabulary accurately, but it also states what would make the author reconsider. That is how a model remains useful in a setting where the data are real enough to matter and incomplete enough to demand judgment.
`);
}

const pageSpecs = [
  ["demand-supply-basics", "Market mechanisms: demand, supply, and equilibrium", 1, "model"],
  ["equilibrium-shifts", "Shifts, movements, and market adjustment", 1, "case"],
  ["wtp-marginal-benefit", "Willingness to pay and marginal benefit", 2, "model"],
  ["consumer-surplus", "Consumer surplus and the distribution of value", 2, "case"],
  ["cost-structures", "Fixed cost, marginal cost, and a firm's decision", 3, "model"],
  ["revenue-profit", "Revenue, profit, and the relevant margin", 3, "case"],
  ["elasticity-slope", "Elasticity is not slope", 4, "model"],
  ["elasticity-revenue-relation", "Elasticity, revenue, and the VidStack price change", 4, "case"],
  ["monopoly-markup", "Market power, marginal revenue, and markup", 5, "model"],
  ["churn-retention", "Churn, retention, and pricing mistakes", 5, "case"],
  ["price-discrimination", "Price discrimination and product fences", 6, "model"],
  ["tier-design", "Tier design and the cannibalization test", 6, "case"],
] as const;

export const econ241Pages: FixturePage[] = pageSpecs.map(([slug, title, weekNumber, angle]) => {
  const week = weeks.find((entry) => entry.week === weekNumber)!;
  return {
    slug,
    title,
    bodyMd: pageBody(week, angle),
    objectiveCodes: week.objectives,
  };
});

export const econ241Modules: FixtureModule[] = weeks.map((week) => ({
  key: `week-${week.week}`,
  name: week.title,
  summaryMd: words(`
${week.centralQuestion}

${week.model} ${week.workshop} The point for the week is to make the economic distinction visible enough that a classmate can audit the reasoning, not merely to arrive at a familiar label or a convenient number.
`),
  objectiveCodes: week.objectives,
  week: week.week,
  published: week.published,
}));

function materialText(week: Week, format: "slides" | "reader" | "workbook"): string {
  const label = format === "slides" ? "Lecture slides with speaker notes" : format === "reader" ? "Course reader" : "Data workbook and worked analysis";
  const formatGuidance = format === "slides"
    ? "The deck introduces the definitions, diagram sequence, and questions to pause on in class. Speaker notes spell out the assumptions behind each graph so that the visible slide does not carry the entire explanation by itself."
    : format === "reader"
      ? "The reader is the sustained explanation for the week. It connects the formal model to the VidStack case and gives students a reference they can cite when they write a recommendation or ask Atlas to check a setup."
      : "The workbook contains the inputs, labels, calculations, and interpretation prompts used in discussion. It is deliberately small enough to inspect, but large enough that a student has to decide which column or comparison is relevant before using it.";
  return words(`
${heading(1, `ECON-241 / Week ${week.week} / ${label}`)}

${heading(2, "Purpose")}

${week.centralQuestion} ${formatGuidance}

${heading(2, "Core economic claim")}

${week.model}

${heading(2, "VidStack record")}

${week.caseEvidence}

${heading(2, "How to use this material")}

Read or inspect the record in this order: first identify the decision, then identify the constraint, then choose the comparison that the model requires. State the conclusion in words before relying on a calculation. If the record does not establish a causal claim, say what competing explanation remains. The assignment prompts use this same sequence because a defensible answer has to show how the evidence entered the reasoning.

${heading(2, "Check your reasoning")}

${week.mistake} Before submitting work, write one sentence that distinguishes the tempting but wrong interpretation from the claim the evidence actually supports. Then name the next observation, experiment, or data field that would materially change the recommendation.

${heading(2, "Practice")}

${week.workshop} A complete response should include the relevant model, an interpretation of the case evidence, and a limitation. Do not replace a missing assumption with generic confidence or a polished conclusion.
`);
}

const contentTypes = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export const econ241Materials: FixtureMaterial[] = [
  {
    key: "syllabus-pdf",
    displayName: "ECON-241 Syllabus and course schedule",
    filename: "econ241-syllabus-fall2026.pdf",
    contentType: contentTypes.pdf,
    sizeBytes: 842_000,
    kind: "syllabus",
    week: 1,
    pageCount: 13,
    assetPath: `${assetRoot}/econ241-syllabus-fall2026.pdf`,
    extractedText: buildSyllabus(),
  },
  ...weeks.flatMap((week) => [
    {
      key: `w${String(week.week).padStart(2, "0")}-slides`,
      displayName: `Week ${week.week} lecture slides: ${week.title}`,
      filename: `econ241-w${String(week.week).padStart(2, "0")}-${week.key}-lecture-slides.pptx`,
      contentType: contentTypes.pptx,
      sizeBytes: 1_240_000 + week.week * 24_000,
      kind: "slides" as const,
      week: week.week,
      pageCount: 22 + (week.week % 5),
      assetPath: `${assetRoot}/econ241-lecture-slides-weeks-1-14.pptx`,
      extractedText: materialText(week, "slides"),
    },
    {
      key: `w${String(week.week).padStart(2, "0")}-reader`,
      displayName: `Week ${week.week} course reader: ${week.topic}`,
      filename: `econ241-w${String(week.week).padStart(2, "0")}-${week.key}-course-reader.pdf`,
      contentType: contentTypes.pdf,
      sizeBytes: 620_000 + week.week * 19_000,
      kind: "reading" as const,
      week: week.week,
      pageCount: 10 + (week.week % 4),
      assetPath: `${assetRoot}/econ241-course-reader-weeks-1-14.pdf`,
      extractedText: materialText(week, "reader"),
    },
    {
      key: `w${String(week.week).padStart(2, "0")}-workbook`,
      displayName: `Week ${week.week} evidence workbook: ${week.topic}`,
      filename: `econ241-w${String(week.week).padStart(2, "0")}-${week.key}-evidence-workbook.xlsx`,
      contentType: contentTypes.xlsx,
      sizeBytes: 92_000 + week.week * 4_800,
      kind: week.week === 10 || week.week === 12 ? "assessment" as const : "dataset" as const,
      week: week.week,
      pageCount: 4,
      assetPath: `${assetRoot}/econ241-data-workbook.xlsx`,
      extractedText: materialText(week, "workbook"),
    },
  ]),
  {
    key: "pricing-session-case-pack",
    displayName: "Pricing Strategy Session: case, rubric, and submission guide",
    filename: "econ241-pricing-strategy-session-case-pack.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 764_000,
    kind: "assessment",
    week: 7,
    pageCount: 18,
    assetPath: `${assetRoot}/econ241-pricing-strategy-session-case-pack.docx`,
    extractedText: `${materialText(weeks[6], "reader")}

${heading(1, "Pricing Strategy Session")}

This pack is the assessed Week 7 record. It contains the VidStack subscriber-loss case, the course rubric, a blank tier-design worksheet, an example of a limitation statement, and the submission checklist. Students should use the material to ground their reasoning, not to copy a ready-made pricing recommendation. The same case is available to Atlas during the governed session, along with the syllabus, Week 4 through Week 6 materials, and the student's Exam 1 feedback.

The central evidence is an 18 percent subscriber loss after a move from $12.99 to $15.00. Begin by identifying the hidden customer groups, then state which part of the loss can be interpreted through elasticity and which part remains an open empirical question. A useful tier table names the segment, the price, the feature bundle, the fence, the downgrade risk, and the evidence needed to validate the choice. After the cannibalization prompt, revise at least one feature or price and explain why the change improves the mechanism rather than merely making the table look different.`,
  },
  {
    key: "instructor-exam2-outline",
    displayName: "Exam 2 drafting notes and item-analysis outline",
    filename: "econ241-exam2-drafting-outline.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 422_000,
    kind: "assessment",
    week: 10,
    pageCount: 9,
    visibility: "instructors",
    assetPath: `${assetRoot}/econ241-exam2-drafting-outline.docx`,
    extractedText: `${materialText(weeks[9], "reader")}

${heading(1, "Instructor-only Exam 2 drafting outline")}

This planning document records the coverage, cognitive demand, item sequence, and diagnostic purpose for the second exam. Elasticity is weighted up because the first exam showed a persistent slope confusion, but the revised items require students to interpret a percentage-response calculation in a market story rather than repeat a formula. The outline includes a short item-analysis table, alternate prompt versions, and notes about which misconceptions should receive written feedback after grading.

The document is not visible to students. It gives the instructor a realistic planning artifact that Atlas can cite when preparing practice or explaining why a proposed review set emphasizes a specific distinction.`,
  },
];

function assignmentBrief(title: string, week: Week, requiredWork: string, evidence: string): string {
  return words(`
${heading(2, title)}

${requiredWork}

Use the Week ${week.week} materials on ${week.topic}. Your response must identify the decision-maker and the relevant constraint before it uses a graph, schedule, or calculation. Show the comparison that your conclusion depends on, then interpret the result in the VidStack setting. ${evidence}

Submit work that another student could audit: labeled calculations or tables, a written explanation of the economic mechanism, and one stated limitation. A correct-looking number without an interpretation is incomplete. If you use Atlas, ask it to test a setup, challenge an assumption, or point to the relevant course record. The submitted analysis and wording must remain your own.
`);
}

export const econ241AssignmentDescriptions: Record<string, string> = {
  ps1: assignmentBrief("Problem Set 1: Equilibrium and market shifts", weeks[0], "Build a baseline demand and supply schedule for VidStack. Then analyze one preference shock and one content-delivery cost shock. Draw each market, identify whether the curve shifts or the point moves along a curve, and explain the resulting change in equilibrium price and quantity.", "Include a paragraph explaining why a posted price change alone does not tell us which curve moved."),
  "reading-check-1": assignmentBrief("Reading Check: Equilibrium and surplus", weeks[1], "Answer six short questions that move from equilibrium to reservation value. Use complete sentences and one labeled schedule or graph where it clarifies the reasoning.", "One answer must separate a revenue claim from a consumer-surplus claim."),
  ps2: assignmentBrief("Problem Set 2: Willingness to pay and consumer surplus", weeks[1], "Use the six-customer VidStack schedule to calculate marginal benefit and consumer surplus at a flat price. Recalculate after a price increase, identify which customers exit, and explain what changes for remaining customers and the firm.", "End with a short note on the difference between an efficiency statement and an access or fairness statement."),
  ps3: assignmentBrief("Problem Set 3: Costs, revenue, and the firm's decision", weeks[2], "Separate fixed cost, variable cost, average cost, marginal cost, total revenue, and profit in the attached workbook. Evaluate several output levels and defend the quantity at which the firm should stop expanding under the stated assumptions.", "Explain why the near-zero cost of one more stream does not settle the firm's long-run pricing decision."),
  "ps4-elasticity": assignmentBrief("Problem Set 4: Elasticity and total revenue", weeks[3], "Calculate midpoint elasticity for three price changes, classify each interval, and state the implied direction of total revenue. Use the calculation itself, not the visual steepness of the curve, to support your conclusion.", "Include a correction of the sentence: 'The slope is constant, so customer sensitivity is constant.'"),
  "exam-1": assignmentBrief("Midterm Exam 1: Markets, firms, and elasticity", weeks[3], "The midterm includes market equilibrium, consumer surplus, costs and profit, market power, and elasticity. Show the model before calculating, label all graphs, and interpret every numerical result in the market story.", "The elasticity section asks you to distinguish slope from percentage responsiveness and to explain how a price change affects total revenue in the relevant range."),
  "ps5-monopoly": assignmentBrief("Problem Set 5: Monopoly markups and churn", weeks[4], "Use the VidStack churn and retention record to compare two pricing choices. Identify the marginal revenue and marginal cost logic, evaluate the customer losses, and state whether the available evidence supports a short-run or long-run conclusion.", "Do not treat a higher revenue-per-subscriber figure as sufficient evidence that the price is better."),
  "session-assignment": assignmentBrief("Pricing Strategy Session", weeks[6], "Work through the VidStack case with the course agent. Frame the subscriber loss, identify customer groups and willingness-to-pay assumptions, build a tier table, and revise it after a cannibalization challenge. The final submission must include prices, target use cases, fences, reasoning, and the evidence you would collect next.", "The agent can question your reasoning and cite course materials. It cannot select the prices or author the final recommendation."),
  "ps6-tiers": assignmentBrief("Problem Set 6: Designing fences", weeks[5], "Design a three-tier menu using the segment workbook. For every tier, name the target use case, price, feature bundle, fence, and likely downgrade risk. Run the downgrade test for a high-value customer and revise one fence after the test.", "Explain why each fence corresponds to a real difference in value rather than a punishment for choosing the cheaper plan."),
  "case-oligopoly": assignmentBrief("Case analysis: A competitor enters", weeks[7], "Write a two-page analysis of VidStack's best response to an entrant with a lower-priced ad tier. Use a payoff table, identify each firm's likely best response, and state the switching-cost or quality assumption your conclusion requires.", "End by naming the observation that would most change your forecast of the competitor's reaction."),
  "ps7-bundling": assignmentBrief("Problem Set 7: Bundles and two-sided platforms", weeks[8], "Compare separate pricing and a bundle for two services with different willingness-to-pay patterns. Then extend the model to the ad tier: explain how a change in the viewer offer changes the advertiser side of the platform.", "Use the workbook to make the value distribution visible rather than asserting that a bundle is always better."),
  "welfare-memo": assignmentBrief("Policy memo: Surplus and a merger review", weeks[10], "Write a one-page memo to a regulator evaluating the proposed catalog merger. Calculate the relevant consumer and producer surplus changes, identify a possible deadweight-loss mechanism, and separate the efficiency claim from the distributional question.", "List three facts a regulator would need before treating the stylized schedule as a policy forecast."),
  "exam-2": assignmentBrief("Midterm Exam 2: Power, discrimination, and welfare", weeks[11], "Exam 2 integrates elasticity, price discrimination, oligopoly, bundles, information, and welfare. Every calculation must be interpreted in the market story, and every recommendation must identify the constraint that makes the model relevant.", "The exam is currently a draft and is visible only to the instructor."),
  "final-project": assignmentBrief("Final pricing project: A defensible market design", weeks[12], "Prepare a pricing recommendation for a market of your choice. Include a demand story, evidence table, relevant cost or competitive constraint, pricing mechanism, consumer-risk discussion, and a clear limitation. The project is graded on the chain from evidence to model to recommendation, not on visual polish alone.", "The project remains a draft while the class reviews examples of a defensible proposal."),
};

function buildSyllabus(): string {
  return words(`
# ECON-241: Intermediate Microeconomics

## Course purpose

Intermediate Microeconomics studies how consumers and firms make choices when resources, information, and alternatives are limited. This course begins with competitive markets and consumer choice, then moves into cost, elasticity, market power, strategic interaction, welfare, and pricing design. We will use a running VidStack case because it gives the models a common setting: a platform has customers with different willingness to pay, real fixed costs, incomplete information, competitors, and a temptation to confuse a higher posted price with a better decision.

The point of the course is not to memorize a graph in isolation. It is to explain what changed, whose decision changed, and how the result affects price, quantity, surplus, revenue, profit, or welfare. A complete answer makes its assumptions visible. It distinguishes a causal claim from an observed pattern, a marginal comparison from an average, and a mathematical result from the interpretation that makes the result useful.

## Instructor and course rhythm

Dr. Amara Osei teaches ECON-241. A normal week includes lecture slides, a course reader, an evidence workbook, a short applied exercise, and a discussion of what the week's model leaves out. The materials folder contains the full course corpus in the same form the agent can ground against. Bring a calculation and an interpretation to office hours. If the graph and the story disagree, that disagreement is the question to investigate rather than an inconvenience to hide.

The course moves through fourteen weekly modules. Weeks 1 through 6 establish the models that support the VidStack case. Week 7 is the assessed Pricing Strategy Session. Weeks 8 through 11 extend the analysis to competition, bundles, information, and policy. Weeks 12 through 14 ask students to use those tools in a final recommendation while acknowledging fairness, uncertainty, and model limits.

## Learning objectives

- LO1: Define market equilibrium and predict how a change in demand, supply, or a market intervention affects price and quantity.
- LO2: Explain willingness to pay, marginal benefit, and consumer surplus using schedules, graphs, and ordinary examples.
- LO3: Calculate fixed cost, variable cost, marginal cost, revenue, and profit, then use them to locate a firm's decision.
- LO4: Analyze price elasticity of demand and distinguish percentage responsiveness from the slope of a curve.
- LO5: Evaluate monopoly pricing, markup choices, churn, competition, information, and welfare consequences.
- LO6: Design a price-discrimination or tiered-pricing scheme with defensible segments, fences, and stated limitations.

## Assessment and feedback

Problem sets ask students to move from a course model to a specific decision. Each submission should show the relevant input, calculation or graph, interpretation, and limitation. The early work covers equilibrium, surplus, cost, and elasticity. The first midterm checks whether students can select and interpret those models under time pressure. Later work covers market power, segmentation, strategic response, bundles, information, and welfare.

The Pricing Strategy Session is an assessed Week 7 record. Students work through the VidStack case with Atlas under a professor-defined contract. The agent may explain a concept, point to a course page, ask a question, or challenge an assumption. It may not choose the student's price, draft the final recommendation, or turn an incomplete thought into a polished answer. The session preserves the student's framing, use of course concepts, revision under challenge, and final design. The professor sees a draft journey report with evidence from the student's own transcript before any grade becomes final.

Feedback is part of the course record. A score and a comment are related but separate: a score records the assessment result, while a comment helps a student identify the next distinction to practice. Students should read feedback alongside the underlying work and revisit an incorrect calculation or assumption before asking for a regrade discussion.

## Working agreements

Economic reasoning improves when its uncertainty is visible. State whether you are describing a model result, interpreting a small dataset, or making a recommendation that needs additional evidence. Do not treat a graph's visual steepness as an elasticity calculation. Do not treat a higher price as evidence that demand shifted. Do not treat an average cost as the answer to a marginal decision. Those distinctions are recurring course habits because each one changes the recommendation a firm, consumer, or regulator would make.

Atlas is available for explanations, guided practice, and questions within the assignment rules. Ask it to check a setup, test an assumption, identify an omitted distinction, or point to a relevant course material. Do not submit work you cannot defend in your own words. The goal is not to avoid help. The goal is to make sure the help leaves a visible trail of your reasoning and revision.

Problem sets may be submitted up to seven calendar days late with a short note explaining what was revised. Work submitted later requires prior approval. Contact Dr. Osei as soon as possible when illness, caregiving, or an emergency affects attendance or deadlines. Students may miss no more than two class meetings without an approved accommodation. The course respects access needs while keeping the shared work visible enough that students and instructor can plan responsibly.

## How to use the materials

Each week contains three kinds of teaching material. The lecture deck introduces the definitions, graphs, and questions that organize class time. The course reader supplies the longer explanation and the applied VidStack evidence. The evidence workbook contains the schedules, tables, calculations, and prompts used in discussion and assignments. Files are named with a stable ECON-241, term, and week identifier so they can be uploaded or replaced without changing the course record.

When using a material in a response, cite it by its title and explain what it contributes. A citation does not replace reasoning. The material should help you establish an assumption, choose a comparison, interpret a calculation, or identify a limitation. If a document does not answer the question, say so and name the evidence you still need.

## Final standard

The course returns to one disciplined sequence: identify the decision, identify the constraint, choose the model that speaks to it, show the comparison, interpret the result, and state what would change your mind. That sequence is the standard for problem sets, exams, the Pricing Strategy Session, and the final project. It is also the reason the course record is intentionally rich: a serious recommendation needs more than a prompt and a short answer to work from.
`);
}

export const econ241Syllabus = buildSyllabus();

export const econ241CourseDescription = words(`
ECON-241 is a university-level course in intermediate microeconomics taught through a sustained platform-pricing case. Students study demand and supply, consumer choice, cost, elasticity, market power, strategic interaction, bundles, information, welfare, and pricing design. The VidStack case gives the course a shared record: a streaming service with customers who value the product differently, real fixed costs, incomplete information, competitors, and a difficult choice about price.

The course treats an economic model as a tool for a decision, not as a graph to memorize. Students identify the decision-maker, the relevant constraint, the comparison required by the model, and the evidence that supports or limits the conclusion. Assignments combine schedules, graphs, calculations, written explanations, and explicit limitations. A number without an interpretation is incomplete, and a polished recommendation without a visible mechanism is not persuasive.

Materials include weekly slide decks, extended course readers, evidence workbooks, a full syllabus, an assessed session case pack, and instructor-only exam planning records. The course agent can ground explanations and questions in those records. It can challenge an assumption or point to a relevant source, but it cannot replace a student's reasoning or author the student's assessed conclusion. The result is a full course record with enough depth to support real instructor, student, and agent workflows.

The demo term is deliberately populated as a course in motion rather than as a catalog. It has fourteen weekly modules, long teaching pages, current and future assignments, returned feedback, varied student work, and documents that can actually be opened. A professor can find the source behind an explanation, a student can see an assignment in the context of the materials that prepared them for it, and an agent has enough language to make grounded distinctions instead of relying on thin labels. The record is designed for examining real course workflows at realistic text length, including planning, teaching, submission review, assessment feedback, and a governed agent session.
`);
