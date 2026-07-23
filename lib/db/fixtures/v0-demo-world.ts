import { createHash } from "node:crypto";
import type {
  V0DemoWorld,
  ScenarioSlots,
  FixturePackage,
  FixtureCourse,
  V0StudentProfile,
  V0ExamRecord,
  V0SessionAdaptation,
  V0Turn,
  V0SessionAssignment,
  V0Rubric,
  V0ArtifactState,
  V0SideNoteCard,
  V0EvidenceSpan,
  V0JourneyReport,
  V0ClassRollup,
  V0ValidationResult,
  V0ValidationCheck
} from "./types";
import { cs152Course } from "./courses/cs152";
import { stat201Course } from "./courses/stat201";
import { hist310Course } from "./courses/hist310";

// Deterministic UUID from a stable key (sha256 -> UUID v4 shape)
function idFor(key: string): string {
  const h = createHash("sha256").update(`atlas-demo:${key}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

function firstTextPart(parts: unknown): string | null {
  if (!Array.isArray(parts)) return null;
  const firstPart = parts[0];
  if (!firstPart || typeof firstPart !== "object") return null;
  const text = (firstPart as { text?: unknown }).text;
  return typeof text === "string" ? text : null;
}

const scenarioKey = "econ-streaming-pricing";
const courseCode = "ECON-241";
const termSlug = "summer-2026";
const courseKey = `${courseCode}:${termSlug}`;

const orgId = idFor("org:demo-u");
const termId = idFor(`term:${termSlug}`);
const courseId = idFor(`course:${courseKey}`);
const professorUserId = idFor("user:amara");
const featuredStudentUserId = idFor("user:maya");
const sessionAssignmentId = idFor(`assignment:${courseKey}:session-assignment`);
const professorPlanningAgentSessionId = idFor(`agentSession:${courseKey}:amara:planning`);

// Scenario slots
export const scenario: ScenarioSlots = {
  scenarioKey,
  courseCode,
  courseTitle: "Intermediate Microeconomics",
  professorName: "Dr. Amara Osei",
  professorVoice: "Dry, direct, cares more about reasoning than answers.",
  problemTitle: "The Streaming Problem",
  problemStatement: "VidStack lost 18% of subscribers after a flat $15 price hike. Design a new pricing structure and defend it.",
  problemDomain: "pricing",
  conceptWeak: "elasticity",
  confusedWith: "slope",
  conceptNext: "price discrimination",
  artifactType: "tiered pricing table plus rationale",
  stressTest: "cannibalization: who switches tiers, and what happens to revenue",
};

// 31 Students profiles & archetypes
const studentDefs: Array<{
  key: string;
  name: string;
  email: string;
  archetype: V0StudentProfile["archetype"];
  personaNote: string;
  priorWorkPattern: string;
  exam1TopicScores: Record<string, number>;
}> = [
  // Recoverers (3)
  {
    key: "maya",
    name: "Maya Patel",
    email: "student@demo.edu",
    archetype: "Recoverer",
    personaNote: "Visual learner, struggles with formal equations but recovers when challenged on economic intuition.",
    priorWorkPattern: "Consistent submission; struggles on math-heavy sets but excels in written conceptual arguments.",
    exam1TopicScores: { supply_demand: 18, consumer_surplus: 16, cost_revenue: 20, elasticity: 4, market_power: 14 } // 72 total. elasticity gets 4/12 (loses 8).
  },
  {
    key: "amina",
    name: "Amina Rivera",
    email: "arivera@demo.edu",
    archetype: "Recoverer",
    personaNote: "Loves application case studies; occasionally forgets core theory definitions but adapts quickly.",
    priorWorkPattern: "High effort; submits drafts for TA feedback; shows strong improvement curve.",
    exam1TopicScores: { supply_demand: 16, consumer_surplus: 15, cost_revenue: 19, elasticity: 4, market_power: 16 } // 70 total. elasticity gets 4/12.
  },
  {
    key: "zara",
    name: "Zara Williams",
    email: "zwilliams@demo.edu",
    archetype: "Recoverer",
    personaNote: "Active class participant; needs guided pathways to connect graphs with algebraic formulas.",
    priorWorkPattern: "Submits right at deadline; notes show active engagement but spelling errors in definitions.",
    exam1TopicScores: { supply_demand: 17, consumer_surplus: 14, cost_revenue: 18, elasticity: 5, market_power: 15 } // 69 total. elasticity gets 5/12.
  },
  // Strong (6)
  {
    key: "liam",
    name: "Liam Okafor",
    email: "lokafor@demo.edu",
    archetype: "Strong",
    personaNote: "Math-focused, highly analytical, directly models consumer choices without scaffolding.",
    priorWorkPattern: "Submits early; neat derivations; uses formal economic terminology correctly.",
    exam1TopicScores: { supply_demand: 19, consumer_surplus: 19, cost_revenue: 23, elasticity: 11, market_power: 23 } // 95 total.
  },
  {
    key: "clara",
    name: "Clara Dupont",
    email: "cdupont@demo.edu",
    archetype: "Strong",
    personaNote: "Intelligent and structured; makes thorough arguments with robust math models.",
    priorWorkPattern: "Top performer; pristine homework formatting; helps others in discussions.",
    exam1TopicScores: { supply_demand: 18, consumer_surplus: 18, cost_revenue: 21, elasticity: 11, market_power: 22 } // 90 total.
  },
  {
    key: "hiro",
    name: "Hiro Tanaka",
    email: "htanaka@demo.edu",
    archetype: "Strong",
    personaNote: "Quiet but mathematically precise; handles price elasticity calculations effortlessly.",
    priorWorkPattern: "Flawless technical work; minimal text description but extremely accurate formulas.",
    exam1TopicScores: { supply_demand: 18, consumer_surplus: 18, cost_revenue: 20, elasticity: 11, market_power: 21 } // 88 total.
  },
  {
    key: "yusuf",
    name: "Yusuf Khan",
    email: "ykhan@demo.edu",
    archetype: "Strong",
    personaNote: "Curious and fast; wants to build finance applications using intermediate micro theory.",
    priorWorkPattern: "Active in office hours; submits creative solutions to pricing problems.",
    exam1TopicScores: { supply_demand: 18, consumer_surplus: 17, cost_revenue: 20, elasticity: 11, market_power: 21 } // 87 total.
  },
  {
    key: "aravind",
    name: "Aravind Pillai",
    email: "apillai@demo.edu",
    archetype: "Strong",
    personaNote: "Rigorous thinker; writes academic-level proofs for cost structures.",
    priorWorkPattern: "Perfect scores on prior problem sets; highly detailed explanations.",
    exam1TopicScores: { supply_demand: 19, consumer_surplus: 18, cost_revenue: 21, elasticity: 10, market_power: 21 } // 89 total.
  },
  {
    key: "mei",
    name: "Mei Chen",
    email: "mchen@demo.edu",
    archetype: "Strong",
    personaNote: "Analytical and fast; maps supply and demand changes to real market dynamics.",
    priorWorkPattern: "Consistently top 5% of class; structured and thorough.",
    exam1TopicScores: { supply_demand: 19, consumer_surplus: 19, cost_revenue: 22, elasticity: 11, market_power: 22 } // 93 total.
  },
  // Steady (12)
  {
    key: "derek",
    name: "Derek Hutchins",
    email: "dhutchins@demo.edu",
    archetype: "Steady",
    personaNote: "Diligent, takes constructive feedback well; solid but average test performer.",
    priorWorkPattern: "On-time submissions; average scores; follows guidelines carefully.",
    exam1TopicScores: { supply_demand: 16, consumer_surplus: 15, cost_revenue: 18, elasticity: 8, market_power: 17 } // 74 total.
  },
  {
    key: "priya",
    name: "Priya Nair",
    email: "pnair@demo.edu",
    archetype: "Steady",
    personaNote: "Hardworking; understands cost concepts but struggles under timed exams.",
    priorWorkPattern: "Well-organized study sheets; reliable performance on homework sets.",
    exam1TopicScores: { supply_demand: 15, consumer_surplus: 16, cost_revenue: 19, elasticity: 8, market_power: 18 } // 76 total.
  },
  {
    key: "jose",
    name: "Jose Morales",
    email: "jmorales@demo.edu",
    archetype: "Steady",
    personaNote: "Good conceptual grasp; sometimes skips computational steps.",
    priorWorkPattern: "Occasionally forgets page references but general explanations are good.",
    exam1TopicScores: { supply_demand: 16, consumer_surplus: 14, cost_revenue: 17, elasticity: 7, market_power: 16 } // 70 total.
  },
  {
    key: "anna",
    name: "Anna Kowalski",
    email: "akowalski@demo.edu",
    archetype: "Steady",
    personaNote: "Asks good clarifying questions; seeks logical connections between topics.",
    priorWorkPattern: "Steady submissions; well-articulated rationales.",
    exam1TopicScores: { supply_demand: 17, consumer_surplus: 15, cost_revenue: 19, elasticity: 9, market_power: 18 } // 78 total.
  },
  {
    key: "malik",
    name: "Malik Thompson",
    email: "mthompson@demo.edu",
    archetype: "Steady",
    personaNote: "Capable student; does well on consumer surplus analysis but rushes mathematical tasks.",
    priorWorkPattern: "Submits near deadline; grades are solid but has occasional careless errors.",
    exam1TopicScores: { supply_demand: 15, consumer_surplus: 15, cost_revenue: 18, elasticity: 8, market_power: 16 } // 72 total.
  },
  {
    key: "chen",
    name: "Chen Liu",
    email: "cliu@demo.edu",
    archetype: "Steady",
    personaNote: "Quiet, completes assignments methodically; has stable understanding.",
    priorWorkPattern: "Very reliable; rarely makes structural errors on assignments.",
    exam1TopicScores: { supply_demand: 16, consumer_surplus: 16, cost_revenue: 20, elasticity: 9, market_power: 18 } // 79 total.
  },
  {
    key: "rachel",
    name: "Rachel Kim",
    email: "rkim@demo.edu",
    archetype: "Steady",
    personaNote: "Good team player; relates pricing strategies to consumer behavior concepts.",
    priorWorkPattern: "Consistent homework grades; average exam preparation.",
    exam1TopicScores: { supply_demand: 17, consumer_surplus: 15, cost_revenue: 17, elasticity: 8, market_power: 17 } // 74 total.
  },
  {
    key: "noah",
    name: "Noah Abebe",
    email: "nabebe@demo.edu",
    archetype: "Steady",
    personaNote: "Enthusiastic but occasionally makes calculation mistakes on marginal benefit.",
    priorWorkPattern: "Submits early; does moderate revisions based on agent prompts.",
    exam1TopicScores: { supply_demand: 15, consumer_surplus: 14, cost_revenue: 18, elasticity: 8, market_power: 16 } // 71 total.
  },
  {
    key: "isabel",
    name: "Isabel Ferreira",
    email: "iferreira@demo.edu",
    archetype: "Steady",
    personaNote: "Solid analytical base; does well when explaining monopoly inefficiencies.",
    priorWorkPattern: "Consistent and neat; answers represent solid intermediate standard.",
    exam1TopicScores: { supply_demand: 16, consumer_surplus: 16, cost_revenue: 19, elasticity: 9, market_power: 18 } // 78 total.
  },
  {
    key: "sam",
    name: "Sam Nguyen",
    email: "snguyen@demo.edu",
    archetype: "Steady",
    personaNote: "Good understanding of marginal cost; likes to see visual graphs.",
    priorWorkPattern: "Consistent; shows good logic in descriptive answers.",
    exam1TopicScores: { supply_demand: 17, consumer_surplus: 15, cost_revenue: 18, elasticity: 8, market_power: 17 } // 75 total.
  },
  {
    key: "elena",
    name: "Elena Rossi",
    email: "erossi@demo.edu",
    archetype: "Steady",
    personaNote: "Disciplined student; works through scaffolding systematically.",
    priorWorkPattern: "Always submits on time; gets average to slightly above average marks.",
    exam1TopicScores: { supply_demand: 16, consumer_surplus: 16, cost_revenue: 19, elasticity: 8, market_power: 17 } // 76 total.
  },
  {
    key: "mateo",
    name: "Mateo Silva",
    email: "msilva@demo.edu",
    archetype: "Steady",
    personaNote: "Dedicated learner; needs concrete pricing examples to grasp mathematical concepts.",
    priorWorkPattern: "On-time; shows effort to integrate feedback in homework drafts.",
    exam1TopicScores: { supply_demand: 16, consumer_surplus: 15, cost_revenue: 18, elasticity: 6, market_power: 16 } // 71 total.
  },
  // Struggling (7)
  {
    key: "fatima",
    name: "Fatima Al-Hassan",
    email: "falhassan@demo.edu",
    archetype: "Struggling",
    personaNote: "Finds graphing elasticity curves difficult; gets confused between percentage changes.",
    priorWorkPattern: "Late submissions occasionally; requires substantial tutor prompting.",
    exam1TopicScores: { supply_demand: 14, consumer_surplus: 13, cost_revenue: 15, elasticity: 3, market_power: 13 } // 58 total. elasticity gets 3/12.
  },
  {
    key: "oscar",
    name: "Oscar Lindqvist",
    email: "olindqvist@demo.edu",
    archetype: "Struggling",
    personaNote: "Prone to confusing price elasticity of demand with supply; struggles on cost definitions.",
    priorWorkPattern: "Messy math formatting; skips multiple steps in derivations.",
    exam1TopicScores: { supply_demand: 13, consumer_surplus: 12, cost_revenue: 15, elasticity: 3, market_power: 13 } // 56 total. elasticity gets 3/12.
  },
  {
    key: "chloe",
    name: "Chloe Dubois",
    email: "cdubois@demo.edu",
    archetype: "Struggling",
    personaNote: "Struggles with basic calculus derivatives for marginal cost calculation.",
    priorWorkPattern: "Submits right before lockdown; misses key parts of assignments.",
    exam1TopicScores: { supply_demand: 15, consumer_surplus: 13, cost_revenue: 16, elasticity: 3, market_power: 15 } // 62 total. elasticity gets 3/12.
  },
  {
    key: "leila",
    name: "Leila Haddad",
    email: "lhaddad@demo.edu",
    archetype: "Struggling",
    personaNote: "Finds economic frameworks hard to memorize; struggles with price discrimination graphs.",
    priorWorkPattern: "Submits incomplete drafts; relies heavily on examples to solve problems.",
    exam1TopicScores: { supply_demand: 15, consumer_surplus: 14, cost_revenue: 16, elasticity: 2, market_power: 16 } // 63 total. elasticity gets 2/12.
  },
  {
    key: "nina",
    name: "Nina Lind",
    email: "nlind@demo.edu",
    archetype: "Struggling",
    personaNote: "Quiet in class; struggles with intermediate mathematical derivations.",
    priorWorkPattern: "Submits close to deadline; often has missing assignments in course history.",
    exam1TopicScores: { supply_demand: 15, consumer_surplus: 14, cost_revenue: 16, elasticity: 4, market_power: 15 } // 64 total. elasticity gets 4/12.
  },
  {
    key: "tariq",
    name: "Tariq Al-Mansoor",
    email: "talmansoor@demo.edu",
    archetype: "Struggling",
    personaNote: "Needs visual graphing tools; has difficulty translating verbal micro concepts to math.",
    priorWorkPattern: "Average scores on homework but drops on exams; needs active tutor scaffolding.",
    exam1TopicScores: { supply_demand: 14, consumer_surplus: 13, cost_revenue: 16, elasticity: 3, market_power: 15 } // 61 total. elasticity gets 3/12.
  },
  {
    key: "lucas",
    name: "Lucas Fischer",
    email: "lfischer@demo.edu",
    archetype: "Struggling",
    personaNote: "Struggles to identify monopolistic pricing patterns; frequently mixes up terms.",
    priorWorkPattern: "Shaky assignments; grades are low-passing; high help needed.",
    exam1TopicScores: { supply_demand: 15, consumer_surplus: 13, cost_revenue: 16, elasticity: 3, market_power: 15 } // 62 total. elasticity gets 3/12.
  },
  // Delegators (3)
  {
    key: "sofia",
    name: "Sofia Reyes",
    email: "sreyes@demo.edu",
    archetype: "Delegator",
    personaNote: "Attempts to use AI shortcuts; tries to get agents to generate complete answers.",
    priorWorkPattern: "Submits answers that look clean but lacks intermediate reasoning steps.",
    exam1TopicScores: { supply_demand: 15, consumer_surplus: 14, cost_revenue: 16, elasticity: 6, market_power: 17 } // 68 total. elasticity gets 6/12.
  },
  {
    key: "kenji",
    name: "Kenji Sato",
    email: "ksato@demo.edu",
    archetype: "Delegator",
    personaNote: "Prefers quick outputs; often asks AI to write out economic arguments.",
    priorWorkPattern: "Slick but generic answers; struggles when asked to explain their own reasoning.",
    exam1TopicScores: { supply_demand: 16, consumer_surplus: 13, cost_revenue: 17, elasticity: 5, market_power: 15 } // 66 total. elasticity gets 5/12.
  },
  {
    key: "santiago",
    name: "Santiago Gomez",
    email: "sgomez@demo.edu",
    archetype: "Delegator",
    personaNote: "Tends to copy structures without deep processing; relies on formula sheets.",
    priorWorkPattern: "Good grades on homework sheets but falls on exams due to lack of deep comprehension.",
    exam1TopicScores: { supply_demand: 14, consumer_surplus: 14, cost_revenue: 15, elasticity: 6, market_power: 16 } // 65 total. elasticity gets 6/12.
  }
];

type EconomicsWritingNote = {
  opening: string;
  concept: string;
  revision: string;
  caveat: string;
};

/** Subject-specific voice notes used to keep seeded ECON session work human. */
const economicsWritingNotes: Record<string, EconomicsWritingNote> = {
  maya: {
    opening: "I started with the fact that the flat increase lost 18% of subscribers, but I am not sure yet whether the problem is the price itself or that one price treats different viewers the same.",
    concept: "I keep wanting to use the slope because the line looks steeper at the part where people leave. I know that is probably the exact confusion from Exam 1, so I am going to write the percentage change before I decide what the graph means.",
    revision: "I think the basic tier needs ads and one screen, otherwise a regular household can just move down and keep almost everything it values.",
    caveat: "I would want actual viewing and churn data before saying these prices are optimal. For now the point is that the tiers have different jobs.",
  },
  amina: {
    opening: "The 18% drop makes me think the flat price was too blunt. I want to separate people who watch occasionally from households that use several screens before I choose a number.",
    concept: "I was about to say the slope is constant so sensitivity is constant, but that does not fit the percentage change story. At the higher price, the same dollar movement is a bigger share of the customer's budget.",
    revision: "I would put ads and one screen on the entry tier, keep the middle tier ad-free, and reserve downloads for the top tier so the features do some segmentation work.",
    caveat: "The middle tier is the part I am least sure about. If it is too close to premium, people may not see its point.",
  },
  zara: {
    opening: "I am looking at the lost subscribers as different groups rather than one big average. The people who only watch a few shows probably react differently from a family using four screens.",
    concept: "The line can have one slope while elasticity changes along it. I had to say that out loud because I keep treating a steep-looking section as proof of high elasticity.",
    revision: "For the cheap option I would accept ads and 720p, then make the standard plan ad-free with two screens. Premium needs something more useful than a higher price, probably 4K or offline viewing.",
    caveat: "I am assuming people notice the difference between the plans. A fence that nobody cares about will not stop a downgrade.",
  },
  liam: {
    opening: "The 18% subscriber loss after the price move is consistent with demand being elastic in that interval, but I would not infer a complete demand curve from one observation.",
    concept: "Elasticity is a percentage response, whereas slope is an absolute derivative. A linear demand curve can therefore have constant slope and changing elasticity as price and quantity change.",
    revision: "I would use ad tolerance, screen count, and offline access as behavioral fences because they map more closely to usage than a self-reported customer label.",
    caveat: "The revenue claim needs a segment table or experiment. I can defend the mechanism, not a precise lift from the information given.",
  },
  clara: {
    opening: "The pricing problem is not simply that $15 is high. It is that VidStack used one price for customers with different willingness to pay and different substitutes.",
    concept: "The slope of a linear demand function is constant, but elasticity is not. I would price away from the elastic region only after checking what the segment-level quantities look like.",
    revision: "I would use ads on Basic, two screens and 1080p on Standard, then 4K and downloads on Premium. Those fences make the menu a choice rather than three labels on the same product.",
    caveat: "A polished tier table can still fail if the fences feel arbitrary, so I would test which feature customers actually value.",
  },
  hiro: {
    opening: "The initial price move appears to have crossed a sensitive part of the demand curve. I want to keep the calculation separate from the story until I check the units.",
    concept: "Slope gives the change in quantity for a unit change in price. Elasticity rescales both changes, so the same slope can describe different responsiveness at different points.",
    revision: "Basic should be limited to one screen and 720p with ads. Standard can carry the ordinary household use case, while Premium needs offline access rather than just a larger screen count.",
    caveat: "My design is mechanically clear but it still needs evidence about whether heavy users actually use offline downloads.",
  },
  yusuf: {
    opening: "I read the subscriber loss as a warning that the platform was charging into an elastic segment. The next question is how to recover casual users without giving away the value heavy users will pay for.",
    concept: "The marginal-revenue condition helps with the firm decision, but I should not use it as a replacement for elasticity. The two ideas answer related questions at different points in the model.",
    revision: "I would keep offline downloads out of Basic and probably Standard, but I would not use a made-up demographic label to identify heavy users. Usage features are a better fence.",
    caveat: "A premium feature only works as a fence if the target group values it enough to stay. I would watch downgrades after launch.",
  },
  aravind: {
    opening: "VidStack has high fixed content costs and a low marginal cost per additional stream, so losing volume matters even if the service can serve another user cheaply.",
    concept: "The relevant question is elasticity at each price point, not the visual steepness of the curve. I am treating the flat hike as a move into a region where quantity responds more than proportionally.",
    revision: "Advertising tolerance is a useful fence for price-sensitive users, but the plan also needs a quality difference so Premium is not just a tax on the same service.",
    caveat: "The fixed-cost story supports volume, but it does not tell us the exact price or whether the content mix gives the platform real pricing power.",
  },
  mei: {
    opening: "I want to know whether the 18% loss came from a broad reaction or a smaller group with easy substitutes. That distinction changes whether the answer is a lower entry price or a different menu.",
    concept: "A constant slope does not imply constant elasticity because the percentage denominators change along the demand curve. I wrote that down before looking at the tier table.",
    revision: "I would make Basic cheaper with ads, keep Standard useful for most viewers, and make Premium about simultaneous use and downloads rather than stacking random features.",
    caveat: "I would not call the design successful until we can see which tier people choose and whether existing users move down.",
  },
  derek: {
    opening: "The flat hike seems to have pushed some customers past what they were willing to pay. I am trying to separate those customers from people who would pay more for a better plan.",
    concept: "I first wrote that the demand curve got steeper, but the course page says to compare percentage changes. That makes elasticity the better language here.",
    revision: "Basic at a lower price with ads seems reasonable, and I would cap it at one screen. I need to think more about what Standard gives someone besides no ads.",
    caveat: "I have the general shape of the tiers, but the middle option is still a weak part of my proposal.",
  },
  priya: {
    opening: "I think the price change affected casual viewers more than people who use VidStack every day. I want to write down the groups before I assume the whole market has one elasticity.",
    concept: "I can explain that elasticity uses percentage change and slope uses absolute change, but I still have to slow down when I use the terms in a graph.",
    revision: "I would use ads as the first fence and reserve extra screens for the higher plans. I would also keep the Premium price close enough to the old price that it does not look like another shock.",
    caveat: "The numbers are a starting point. The plan needs a test because I do not know how many current users care about 4K.",
  },
  jose: {
    opening: "The simple explanation is that $15 was too much for some people, but that does not tell us what to do for people who were already willing to pay more.",
    concept: "Slope is the change in one variable over the other, while elasticity compares percentages. I had the idea but skipped the calculation in my first note.",
    revision: "I would give casual viewers a basic ad plan and make the higher plans different by screens and downloads. That seems better than asking people to name their own segment.",
    caveat: "I still need to show why the Standard price is not just an arbitrary midpoint.",
  },
  anna: {
    opening: "Before setting tiers I want to know whether the people who left were light viewers, students, or households with another service. The same churn number could hide different reasons.",
    concept: "The slope versus elasticity distinction is about absolute versus percentage response. I understand it in the formula but I need to make sure my graph labels say the same thing.",
    revision: "I would make student or casual access cheaper only with a clear eligibility or feature fence. For the general plan, ads and screen limits are more defensible than asking customers to self-identify.",
    caveat: "A discount can bring people back and still reduce revenue if existing users switch, so I would track that separately.",
  },
  malik: {
    opening: "The flat price hike probably hit people who were already close to leaving. I am trying to keep the recommendation tied to the actual 18% loss instead of just making a cheap tier.",
    concept: "I keep wanting to call a steep line elastic. The percentage-change definition is the check I need before making that claim.",
    revision: "Basic with ads and one screen gives casual users a reason to stay, while Standard should have enough convenience that families do not immediately downgrade.",
    caveat: "I have not worked out the revenue comparison yet, so the prices are provisional.",
  },
  chen: {
    opening: "I made a table with casual, regular, and heavy viewers because the flat price hides the different use cases. The missing piece is evidence for how large each group is.",
    concept: "The line's slope stays the same in the linear example, but elasticity changes because it uses percentages. That is the distinction I need to carry into the pricing recommendation.",
    revision: "I would keep Basic to one screen with ads and give Standard two screens without ads. Premium gets downloads and 4K, which gives the top price a concrete reason.",
    caveat: "I would test the menu with a small group before treating the segments as stable facts.",
  },
  rachel: {
    opening: "I am thinking about the customer experience as well as revenue. Some people may leave because the price feels out of proportion to how often they watch, not because they dislike VidStack.",
    concept: "Elasticity is the percentage reaction, not just the shape of the line. I wrote that next to my graph so I do not use slope as a shortcut again.",
    revision: "A basic ad-supported tier could keep occasional viewers. I would make the fence visible in the plan comparison so the lower price is a real trade rather than a hidden downgrade.",
    caveat: "Too many ads could create another form of churn, so the fence has a customer-experience cost.",
  },
  noah: {
    opening: "The price increase may have reduced the number of people who subscribe, even if the remaining customers pay more. I want to compare revenue and not stop at the churn percentage.",
    concept: "I checked the elasticity formula after my first calculation used the dollar change only. That was a slope calculation, not the percentage responsiveness the problem asks for.",
    revision: "I would try Basic with ads, Standard with two screens, and Premium with offline access. I am not sure whether resolution or downloads is the stronger fence.",
    caveat: "The proposal needs a simple experiment so we can see whether the lower tier recovers people without pulling down Standard users.",
  },
  isabel: {
    opening: "A single price makes the service easy to explain but ignores different willingness to pay. The 18% drop is a sign that the flat structure left no gentle way for a casual viewer to stay.",
    concept: "Elasticity compares relative changes, while slope compares absolute changes. I am using that distinction to explain why a linear graph can still have different sensitivity at different prices.",
    revision: "Ads and 720p make Basic meaningfully different, Standard is two-screen and ad-free, and Premium adds 4K and downloads. Each fence matches a use case rather than an arbitrary label.",
    caveat: "The final defense should acknowledge that fairness and privacy concerns can limit how finely the firm segments customers.",
  },
  sam: {
    opening: "I drew the customer groups first because the price hike is the same for everyone but the reaction was not. I think the service needs an option for people who watch only occasionally.",
    concept: "The graph can keep one slope while elasticity changes. The picture helped me see why I cannot use the word steep as the whole explanation.",
    revision: "Ads, screen limits, and resolution give us three possible fences. I would start with ads on Basic and keep Premium about real simultaneous use rather than just a higher number.",
    caveat: "I need to make the Standard plan more specific before I call the table finished.",
  },
  elena: {
    opening: "I wrote down the old and new prices before making a recommendation. The 18% loss suggests that some customers were already near their reservation price.",
    concept: "Elasticity is percentage responsiveness and slope is absolute steepness. I can use both, but they should not be treated as interchangeable evidence.",
    revision: "I would use ads as the entry fence and two screens for Standard, then add offline downloads to Premium. That leaves the family use case in the middle instead of making Premium the only practical option.",
    caveat: "The table still assumes that ad tolerance is different across customers. I would want to test that assumption.",
  },
  mateo: {
    opening: "I keep coming back to the idea that a single flat rate asks casual and heavy viewers to make the same decision. That seems like the reason the price hike lost people rather than simply lowering total demand.",
    concept: "The slope can be constant even though elasticity is high in one part of a linear demand curve and low in another. I needed the example from the page to make that stick.",
    revision: "I would use ads and one screen on Basic, then offline downloads as a reason not to move down from Standard. I am still deciding whether 4K is enough for Premium by itself.",
    caveat: "My prices are rough and the rationale is better than the revenue estimate right now.",
  },
  fatima: {
    opening: "I first thought the answer was just put the price back at $12.99, because that is where people were subscribing before. I know that gives everyone the same price again, so I am trying to see who the tiers are for.",
    concept: "I still get slope and elasticity mixed up. I think elasticity is the percent change, but I need to write the numerator and denominator instead of guessing from the picture.",
    revision: "I would put ads on the cheap tier, but I am not sure what the screen limit should be. Without a fence, I think everyone would pick the cheapest one.",
    caveat: "I do not have a confident revenue argument yet. My next step is to compare the plan features with the customer groups.",
  },
  oscar: {
    opening: "I understand that raising the price made some subscribers leave, but I am not sure how to tell whether they were casual users or people who found another service.",
    concept: "I wrote that a steeper demand line means more elasticity, then noticed the page separates slope from percentage changes. I need to stop using the visual shortcut.",
    revision: "I have two tiers in the draft because three feels like too much before I understand the fences. Basic could have ads and Standard could have more screens, but I have not solved the middle case.",
    caveat: "The pricing table is incomplete. I would rather say that than pretend the two prices solve cannibalization.",
  },
  chloe: {
    opening: "I am stuck on how to split the users. A discount might bring people back, but it could also make current subscribers pay less without changing anything.",
    concept: "I know the formula says elasticity is a percentage comparison and slope is a dollar or unit comparison. The graph still makes me hesitate, so I wrote both definitions beside it.",
    revision: "If Basic has ads and one screen, at least there is a reason for the lower price. I am not sure whether Standard needs better resolution or more screens to keep people from moving down.",
    caveat: "The fence idea is clearer than my final prices. I need another pass before the proposal is ready.",
  },
  leila: {
    opening: "I thought heavy and casual users might as well pay the same price because the product is the same. Then I looked at willingness to pay and saw why that leaves some people out.",
    concept: "I described slope as the change in price over quantity and called elasticity another word for it. That is not right, but I can see that the percentage part changes the interpretation.",
    revision: "I would start with Basic at a lower price and use ads or a screen limit. I need help making Premium different without just adding features nobody asked for.",
    caveat: "The design is still a draft. I know what problem the fence is supposed to solve, but not yet whether my feature is a good fence.",
  },
  nina: {
    opening: "The subscriber loss is high, but I do not know which customers to segment. I wrote casual, regular, and heavy on the page and then realized those labels need evidence.",
    concept: "I am confused about slope and price elasticity of demand. I think the percentage change is why the same line can have different elasticity, but I want to check that with an example.",
    revision: "Maybe Basic can have a time or screen limit, but I do not know if limiting hours would make people leave instead. I have not finished the fences.",
    caveat: "My table is a partial attempt. I would ask about the segment evidence before recommending the prices.",
  },
  tariq: {
    opening: "The subscriber drop makes sense as a price problem, but I need to draw the customers before I can say what the new plans should be.",
    concept: "I keep seeing slope and elasticity as two ways to say demand changes. The percentage versus absolute distinction is the part I am trying to hold onto.",
    revision: "I can imagine Basic with ads and one screen, then Standard for regular viewers. I am not sure what Premium should fence besides 4K, and I do not want to invent a feature just to fill the row.",
    caveat: "The diagram is more complete than my explanation. My next pass should connect each feature to a willingness-to-pay reason.",
  },
  lucas: {
    opening: "I thought raising the price should increase revenue because each subscriber pays more. The 18% loss means I need to compare the price effect with the quantity effect.",
    concept: "I assumed a steeper slope always meant more elastic demand. The example shows why that is not enough, but I am still translating it into the case.",
    revision: "I have Basic and Standard prices, but I do not have a good fence yet. Saying people will choose a plan because it is premium is not really an explanation.",
    caveat: "The current table is not ready to defend. I need to connect the tiers to actual usage instead of repeating the labels.",
  },
  kenji: {
    opening: "I was going to ask the agent to write the whole analysis because I mostly want the final prices. I know that would leave me unable to explain why the table works.",
    concept: "I do not want to calculate elasticity, but I can at least say that the price response is a percentage question and not just the slope of the line.",
    revision: "I am tempted to leave the fences out and submit the two prices, even though I understand that people could all choose the cheaper plan.",
    caveat: "My current design is thin because I stopped before testing the downgrade risk.",
  },
  santiago: {
    opening: "I wanted the agent to generate the pricing structure because I was not sure where to start. The flat price problem seems to be about different customer groups, not one magic price.",
    concept: "I do not want to calculate the elasticity, but I understand that the percentage response is what tells us whether the hike lost too much quantity.",
    revision: "I am fine with whatever fences the agent recommends, which is probably a sign that I have not done this part myself. I can at least say the cheap tier needs a cost to choosing it.",
    caveat: "The table is a placeholder until I write the reason for each feature and price.",
  },
};

function economicsWritingFor(studentKey: string): EconomicsWritingNote {
  return economicsWritingNotes[studentKey] ?? {
    opening: "I am still working out which customer groups the flat price treats the same.",
    concept: "I need to separate elasticity from slope before making the pricing claim.",
    revision: "I would add a concrete feature fence instead of relying on the tier name.",
    caveat: "The price is provisional until I can explain the tradeoff.",
  };
}

function economicsStudentName(studentKey: string): string {
  return studentDefs.find((student) => student.key === studentKey)?.name ?? studentKey;
}

// Verify we have 31 students, and map their keys
const studentKeys = studentDefs.map((s) => s.key);
const studentsMap = new Map(studentDefs.map((s) => [s.key, s]));

// Construct V0StudentProfiles
export const studentProfiles: V0StudentProfile[] = studentDefs.map((s) => ({
  userId: idFor(`user:${s.key}`),
  key: s.key,
  name: s.name,
  email: s.email,
  archetype: s.archetype,
  personaNote: s.personaNote,
  priorWorkPattern: s.priorWorkPattern,
  exam1TopicScores: s.exam1TopicScores,
  featured: s.key === "maya" ? true : undefined,
}));

// Build Exam 1 record
const exam1PointsPossible = 100;

/**
 * Exam 1's grading blueprint: possible points per topic. Sums to the exam's
 * 100 points; every student topic score stays within its topic max. This is
 * the "of 12" in the canonical side note, a defined max, never a class max.
 */
export const exam1TopicMaxes: Record<string, number> = {
  supply_demand: 20,
  consumer_surplus: 20,
  cost_revenue: 24,
  elasticity: 12,
  market_power: 24,
};
const examRecord: V0ExamRecord = {
  assignmentId: idFor(`assignment:${courseKey}:exam-1`),
  pointsPossible: exam1PointsPossible,
  studentScores: studentDefs.map((s) => {
    const totalScore = Object.values(s.exam1TopicScores).reduce((sum, v) => sum + v, 0);
    let grade = "C";
    if (totalScore >= 90) grade = "A";
    else if (totalScore >= 80) grade = "B";
    else if (totalScore >= 70) grade = "C";
    else if (totalScore >= 60) grade = "D";
    else grade = "F";

    return {
      studentId: idFor(`user:${s.key}`),
      studentKey: s.key,
      totalScore,
      grade,
      topicScores: s.exam1TopicScores,
    };
  }),
};

// Course AI Policy
const policy = {
  allowExplain: true,
  allowPractice: true,
  allowQuestions: true,
  explanationDepth: "guided" as const,
  citationsRequired: true,
  personaName: "The Strategist",
  personaStyle: "Dry, direct, and focused on strategic frameworks.",
  customInstructions: "Do not give students direct answers. Scaffold their thinking using concepts from Weeks 4-6.",
  studentDailyLimit: 40,
  shareStruggleSignal: true,
};

// Modules
const modulesList = [
  { key: "week-1", name: "Markets, demand, and supply", summaryMd: "Begin with equilibrium as a story about two decisions meeting. Work through a VidStack demand schedule, draw the original market, then separate a movement along demand from a shift caused by preferences or server costs. Problem Set 1 checks whether the graph can support the written explanation.", objectiveCodes: ["LO1"], week: 1, published: true },
  { key: "week-2", name: "Consumer choice and willingness to pay", summaryMd: "Move from a market curve to individual reservation values. Use a six-customer streaming schedule to calculate marginal benefit and consumer surplus, then ask who is priced out after a rate change. Problem Set 2 asks for both the calculation and the distributional interpretation.", objectiveCodes: ["LO2"], week: 2, published: true },
  { key: "week-3", name: "Costs, revenue, and profit", summaryMd: "Build the firm's side of the model: fixed content costs, near-zero marginal serving costs, revenue, and profit at different subscriber counts. The worked examples distinguish average cost from the cost of one more user before Problem Set 3 asks for the firm's output decision.", objectiveCodes: ["LO3"], week: 3, published: true },
  { key: "week-4", name: "Elasticity and incidence", summaryMd: "Use percentage changes to explain why a price hike can raise the amount paid by each remaining subscriber while reducing total revenue. The central warning is that a linear curve can have constant slope and changing elasticity. Exam 1 returns to this distinction explicitly.", objectiveCodes: ["LO4"], week: 4, published: true },
  { key: "week-5", name: "Market power and pricing mistakes", summaryMd: "Study what a firm with market power gives up when it chases a higher price without modeling churn. Compare markup, marginal revenue, marginal cost, and retention outcomes in the monopoly case before deciding whether the high-price option actually improves the firm's position.", objectiveCodes: ["LO5"], week: 5, published: true },
  { key: "week-6", name: "Price discrimination and tier design", summaryMd: "Turn willingness to pay into a menu rather than a single price. Segment by observable use cases, choose features that act as real fences, and test whether a customer can keep the same value by moving down. The interactive case uses cannibalization as its stress test.", objectiveCodes: ["LO6"], week: 6, published: true },
  { key: "week-7", name: "Interactive Pricing Session", summaryMd: "Apply Weeks 4 through 6 to VidStack's 18% subscriber loss. The session records the student's framing, concept check, revision under challenge, and final tier table, so the instructor can respond to the reasoning rather than only the final prices.", objectiveCodes: ["LO6"], week: 7, published: true },
  { key: "week-8", name: "Oligopoly and Game Theory", summaryMd: "The unpublished next module extends the pricing conversation to competitors. We will study strategic interaction, Nash equilibrium, and the ways a rival's response can change a firm's best price. It remains hidden while the class completes the current case.", objectiveCodes: ["LO5"], week: 8, published: false },
];

// Pages with 300-800 words of real text containing tagged concept keywords
const pagesList = [
  {
    slug: "demand-supply-basics",
    title: "Basic Market Mechanisms: Demand, Supply, and Market Equilibrium",
    objectiveCodes: ["LO1"],
    bodyMd: `In microeconomic theory, the market economy is driven by the interaction of demand and supply. The demand curve shows the quantity of a good that consumers are willing and able to purchase at various price points. Crucially, the law of demand dictates that as the price of a good increases, the quantity demanded decreases. This inverse relationship creates a downward-sloping demand curve. Conversely, the supply curve represents the quantity that sellers are willing and able to offer for sale. As price rises, quantity supplied increases, which typically creates an upward-sloping supply curve. 
    
    Market equilibrium is reached at the price where the quantity demanded equals the quantity supplied. At this point, the market clears, meaning there are no shortages and no surpluses. The equilibrium price and equilibrium quantity are determined by the intersection of these two curves. Shifts in these curves occur due to external factors (such as consumer income, preferences, or input costs), changing the equilibrium state. Understanding these basic mechanisms is vital for analyzing firms' behavior in competitive environments.
    
    In competitive markets, the price mechanism coordinates the actions of buyers and sellers. When market price is above the equilibrium level, a surplus occurs because the quantity supplied exceeds the quantity demanded. This downward pressure on price encourages producers to reduce output and consumers to increase consumption until the equilibrium is restored. Conversely, if price is below equilibrium, a shortage exists. This upward pressure on price drives the market back to equilibrium. Elasticity determines how rapidly markets adjust to these shifts.
    
    To fully appreciate this interaction, economists study market interventions like price ceilings or floors. A price ceiling, which is a government-imposed maximum price, can lead to chronic shortages if set below the equilibrium price. Sellers cannot charge the market-clearing rate, and buyers face queues and black markets. Conversely, a price floor, such as the minimum wage, establishes a minimum price. If set above equilibrium, it generates a persistent surplus or excess supply. These microeconomic principles govern pricing behavior globally, and firms must constantly adapt to these shifting constraints to remain viable in the long term.`
  },
  {
    slug: "equilibrium-shifts",
    title: "Shedding Light on Equilibrium: Shifts in Supply and Demand Curves",
    objectiveCodes: ["LO1"],
    bodyMd: `To master market dynamics, economists analyze shifts in supply and demand curves. A change in price moves us along the curve (quantity change), but a change in non-price factors shifts the entire curve. For example, if a study reveals streaming services improve mental health, consumer preferences shift demand to the right. This shifts the equilibrium, raising both the equilibrium price and quantity. 
    
    On the other hand, if a supply factor shifts (such as a decrease in input costs), the supply curve moves to the right. This results in a lower equilibrium price and a higher equilibrium quantity. If both shift simultaneously, the net effect depends on the relative magnitudes of the shifts. Analyzing equilibrium shifts allows firm leaders to predict how market shocks impact revenue, sales volume, and customer retention. These calculations are critical for avoiding pricing mistakes and managing resource allocations.
    
    Furthermore, shifts can be driven by input price changes, technology advancements, or governmental policy interventions. For instance, when a government imposes a sales tax on a commodity, it effectively shifts the supply curve upwards by the amount of the tax. The new equilibrium results in a higher price for consumers and a lower net price for sellers. This shift introduces economic inefficiencies and deadweight loss. Economists utilize supply and demand shifts to evaluate policy effects on consumer welfare and firm profits.
    
    Understanding shifts also involves exploring the concept of market expectations. If consumers expect the price of streaming services to rise significantly next month, they may increase their current demand, shifting the curve to the right today. Similarly, if producers anticipate resource shortages, they might hold back supply, shifting the supply curve to the left. These forward-looking behaviors complicate equilibrium forecasts but represent the real-world situations pricing managers must navigate daily. Mastering these shifts is essential for strategic planning in volatile industries, where supply chains and consumer trends evolve rapidly.`
  },
  {
    slug: "wtp-marginal-benefit",
    title: "Deciphering Willingness to Pay and Marginal Benefit",
    objectiveCodes: ["LO2"],
    bodyMd: `A consumer's decision to buy is governed by their willingness to pay (WTP). Willingness to pay represents the maximum monetary value a customer puts on a unit of a good. This is a reflection of their individual preferences and financial budget constraints. Marginal benefit is the additional utility or satisfaction gained from consuming one more unit of a good. According to the law of diminishing marginal benefit, the benefit of consuming additional units declines as total consumption increases.
    
    For a streaming customer, the first subscription has a very high willingness to pay. A second subscription for a guest room has a much lower marginal benefit. Sellers attempt to estimate willingness to pay to maximize their pricing power. Since direct measurement of individual WTP is difficult, firms rely on consumer segmentation, observing historical purchase behavior, and estimating demographic profiles. Understanding how marginal benefit changes helps firms design pricing tiers that capture maximum consumer surplus.
    
    Understanding willingness to pay also helps in assessing consumer equity and access to basic goods. Under perfect market conditions, consumers whose marginal benefit exceeds the market price will purchase the good. Those whose WTP is lower are excluded, showing the rationing function of prices. In modern digital platforms, estimating willingness to pay involves machine learning algorithms that analyze real-time search queries and browsing history, raising privacy concerns while simultaneously allowing firms to customize prices to extreme precision.
    
    Moreover, consumer psychology plays a significant role in perception of marginal benefit. Pricing managers use anchoring effects, where showing a higher original price makes the current tier seem like a discount, artificially boosting willingness to pay. Additionally, network externalities can increase a user's marginal benefit as more of their peers join the platform. In these ways, firms do not merely accept willingness to pay as a fixed constant; they actively try to shape it through marketing, platform design, and user experience. By manipulating the perceived benefit, firms can expand their market reach significantly.`
  },
  {
    slug: "consumer-surplus-derivation",
    title: "Measuring Value: Consumer Surplus in Microeconomics",
    objectiveCodes: ["LO2"],
    bodyMd: `Consumer surplus is the difference between what a consumer is willing to pay and the price they actually pay. Visually, on a supply and demand graph, consumer surplus is the area below the demand curve and above the market price. It represents the net economic benefit or value that consumers capture from trading in the market. If a student is willing to pay $25 for a textbook but buys it for $15, they enjoy a consumer surplus of $10.
    
    Firms use various pricing strategies to capture this consumer surplus. If a firm charges a single flat price, it leaves significant consumer surplus in the hands of high-value consumers, while failing to attract low-value consumers. By introducing price discrimination, firms can convert consumer surplus into firm revenue. Designing effective tiers involves striking a delicate balance: leaving enough consumer surplus to keep customers happy and reduce churn, while capturing enough to cover costs and yield sustainable profits.
    
    The concept of consumer surplus is widely used in welfare economics to evaluate the social desirability of public projects and regulatory changes. For example, if a merger between two major streaming platforms reduces competition and increases prices, consumer surplus falls, leading to a welfare loss. Regulators assess these changes by measuring the reduction in consumer surplus and comparing it to any cost savings or efficiency gains the merger might produce for the firms.
    
    Ultimately, consumer surplus serves as the foundation of user loyalty. If a streaming service provides a massive catalog of films and original shows for a low monthly fee, users capture a huge surplus. This surplus makes them highly loyal and resistant to competitor promotions. However, if the firm aggressively raises rates to capture more surplus for itself, the perceived value drops, and consumers will look for alternatives, illustrating the limits of extraction. A healthy market requires balancing the firm's need for profit with the consumer's need for value.`
  },
  {
    slug: "cost-structures",
    title: "Unpacking Cost Structures: Fixed Cost and Marginal Cost",
    objectiveCodes: ["LO3"],
    bodyMd: `A firm's profit maximization is constrained by its cost structures. Total cost is composed of fixed cost and variable cost. Fixed cost is the expenditure that does not change with the level of production, such as rent, salaries, or physical servers. Variable cost fluctuates directly with production, such as raw materials or transaction fees. In streaming industries, fixed cost is exceptionally high due to content acquisition and software development, while marginal cost (the cost of serving one additional user) is near zero.
    
    Marginal cost is defined as the change in total cost resulting from producing one additional unit. Mathematically, it is the derivative of the total cost function. Profit-maximizing firms expand output until marginal cost equals marginal revenue. Understanding the relationship between high fixed cost and negligible marginal cost is crucial for digital platforms. It allows platforms to offer cheap tiers (since serving additional users costs little) as long as they can recover their massive fixed cost through aggregate subscriber volume.
    
    In the long run, cost structures change as all inputs become variable, enabling firms to choose the optimal scale of production. Firms can experience economies of scale, where long-run average cost decreases as output increases, or diseconomies of scale if administrative complexities raise average costs. For tech companies, initial investment in database management and algorithm design represents a massive fixed cost, but the marginal cost of scaling services to millions of global users remains minor, creating substantial returns to scale.
    
    Additionally, the distinction between short-run cost and long-run cost guides structural investments. In the short run, at least one input is fixed (such as physical office space). In the long run, a company can adjust all inputs, choosing to transition to fully cloud-based architectures to minimize fixed infrastructure costs. By understanding these long-term cost curves, managers can optimize pricing models that sustain operations over multiple years, offsetting initial high investments and ensuring the company stays ahead of its competition.`
  },
  {
    slug: "revenue-profit-maximization",
    title: "Revenue, Cost, and Profit Maximization",
    objectiveCodes: ["LO3"],
    bodyMd: `A firm's primary objective is profit maximization. Profit is defined as total revenue minus total cost. Total revenue is calculated as the price multiplied by the quantity sold. To maximize profit, a firm must find the optimal balance between price and quantity. If a firm raises prices, the quantity sold decreases due to the downward-sloping demand curve. Thus, a firm must understand how price changes impact quantity to determine if total revenue will increase or decrease.
    
    Profit maximization occurs at the quantity where marginal revenue equals marginal cost. Marginal revenue is the additional revenue gained from selling one more unit. For a competitive firm, price equals marginal revenue. However, for a monopoly with pricing power, marginal revenue is less than price because it must lower prices for all units to sell more. Firms must calculate cost functions and forecast demand curves to set optimal prices, avoiding pricing mistakes that lead to losses or customer churn.
    
    It is critical to distinguish between accounting profit and economic profit. Accounting profit considers only explicit monetary costs, whereas economic profit subtracts both explicit and implicit opportunity costs, such as the value of the owner's time or capital invested elsewhere. A firm might show a positive accounting profit but a negative economic profit if the capital could be used more lucratively elsewhere. Profit maximization ensures that resources are allocated to their highest-valued uses across the economy.
    
    Moreover, the search for optimal pricing requires continuous analysis of market elasticity. If marginal revenue falls below marginal cost, the firm is producing too much and should cut back output. Conversely, if marginal revenue is higher than marginal cost, output should be expanded to capture additional profit. Balancing these marginal values is the key to running a successful enterprise in both physical and digital markets. Firms that ignore these economic calculations quickly find themselves losing market share or failing to meet their financial goals.`
  },
  {
    slug: "price-elasticity-concept",
    title: "Defining Price Elasticity of Demand vs Curve Slope",
    objectiveCodes: ["LO4"],
    bodyMd: `Price elasticity of demand measures consumer sensitivity to price changes. It is calculated as the percentage change in quantity demanded divided by the percentage change in price. If elasticity is greater than one, demand is elastic, meaning consumers are highly sensitive, and a price hike will cause a disproportionate drop in quantity, decreasing revenue. If elasticity is less than one, demand is inelastic, meaning consumers are insensitive, and a price hike will increase revenue despite a small drop in quantity.
    
    A common student pricing mistake is confusing elasticity with the slope of the demand curve. The slope of a linear demand curve is constant throughout (change in price over change in quantity). However, elasticity changes at every point along a linear demand curve. Elasticity is high at high prices (elastic region) and low at low prices (inelastic region). Slope measures absolute changes, whereas elasticity measures percentage changes. Confusing these two terms can lead to catastrophic pricing mistakes.
    
    Elasticity calculations depend on the availability of substitutes, the share of income spent on the good, and the time horizon. If a good has many close substitutes, demand is highly elastic because consumers can easily switch if prices rise. Over time, demand becomes more elastic as consumers find alternatives. Slope does not capture these behavioral shifts. While slope uses units of measurement (e.g., dollars per subscriber), elasticity is unitless, allowing economists to compare consumer sensitivity across entirely different goods.
    
    To illustrate this difference, imagine a straight demand line starting from a price of $100 down to $0. The slope is the same at the $90 level as it is at the $10 level. However, at $90, a $5 price drop represents a tiny percentage price change, but triggers a massive percentage change in sales volume, indicating high elasticity. At $10, a $5 drop is a huge percentage price change but yields minimal percentage change in sales, showing inelastic demand. Slope tells us the path; elasticity tells us the behavior. Managers must master this distinction to accurately predict consumer response.`
  },
  {
    slug: "elasticity-revenue-relation",
    title: "The Critical Link: Elasticity and Total Revenue",
    objectiveCodes: ["LO4"],
    bodyMd: `The relationship between price elasticity of demand and total revenue is a cornerstone of economic strategy. When demand is elastic, the percentage change in quantity demanded is larger than the percentage change in price. Therefore, raising the price causes quantity to drop so much that total revenue falls. Conversely, lowering prices in the elastic region increases total revenue because the increase in sales volume offsets the lower price per unit.
    
    When demand is inelastic, the percentage change in quantity is smaller than the percentage change in price. Here, raising the price increases total revenue because the price increase offsets the minor decrease in sales. When elasticity equals exactly one (unit elastic), total revenue is maximized. Firms must calculate the price elasticity of their customer segments. If a company raises prices without knowing its elasticity, it risks losing subscribers and revenue, as seen in many streaming services.
    
    This relationship dictates pricing behavior in both private markets and public finance. For example, when a state government designs excise taxes to raise revenue, it targets goods with highly inelastic demand, such as gasoline or cigarettes. Because demand is inelastic, the quantity demanded drops very little, and the tax generates substantial revenue without causing significant market distortion. Conversely, taxing highly elastic luxury goods often fails to raise revenue because consumers substitute away from them.
    
    Managers must also remember that elasticity is not static. A sudden change in competitor services or external economic conditions can shift elasticity curves. For instance, if a competitor slashes prices, your own service's demand becomes more elastic as consumers find an easy substitute. Firms must dynamically monitor consumer churn and purchasing behavior to update their pricing strategy and maintain maximum revenue efficiency. Constant vigilance is the price of maintaining market dominance in today's fast-paced digital economy.
    
    Furthermore, price elasticity plays a key role in advertising strategies. When firms successfully build strong brand image and high customer loyalty, they make their products' demand more inelastic. This allows them to raise prices without facing a major drop in quantity demanded, directly increasing their total revenue. Therefore, corporate marketing is often designed to reduce price elasticity, transforming highly competitive commodities into differentiated, premium services with high pricing power.`
  },
  {
    slug: "monopoly-power",
    title: "Monopoly Power, Markup Pricing, and Market Inefficiencies",
    objectiveCodes: ["LO5"],
    bodyMd: `Monopoly power occurs when a single firm dominates the market, allowing it to set prices rather than accept market prices. A monopoly maximizes profit by setting marginal revenue equal to marginal cost. Since the monopoly faces a downward-sloping demand curve, it sets a price higher than marginal cost. The extent of this markup is determined by the price elasticity of demand: the less elastic demand is, the higher the markup a firm can charge.
    
    However, monopoly pricing creates market inefficiencies. Because the price is set above marginal cost, some consumers who value the good above its marginal cost are excluded from purchasing it. This results in deadweight loss, which represents the lost economic value that would have been captured in a competitive market. To minimize these inefficiencies and increase revenue, monopolies often utilize price discrimination to capture consumer surplus from different segments without excluding low-value buyers.
    
    Monopoly power is often sustained by barriers to entry, such as patents, government licenses, or control over a critical resource. Without these barriers, high profits would attract competitors, shifting supply and driving prices down to marginal cost. In digital markets, network effects serve as a powerful barrier, where a platform becomes more valuable as more people use it. This dynamic can lead to natural monopolies, where a single firm can serve the entire market at a lower cost than multiple competing firms.
    
    Furthermore, antitrust regulators monitor monopolies to prevent abuses of pricing power. If a platform engages in predatory pricing (pricing below marginal cost to drive out competitors) or ties products together to restrict choice, it faces legal investigations. Monopolistic firms must justify their pricing structures using efficiency arguments, making economic modeling a key component of corporate compliance and corporate legal defense. Understanding these regulatory boundaries is just as important as understanding the math behind price setting.`
  },
  {
    slug: "churn-and-mistakes",
    title: "Pricing Mistakes: Churn, Overpricing, and Customer Retention",
    objectiveCodes: ["LO5"],
    bodyMd: `Firms with pricing power frequently make pricing mistakes by failing to account for customer churn. Churn is the percentage of subscribers who cancel their subscription over a given period. Overpricing a service without providing clear incremental value drives up churn rates, especially among price-sensitive customer segments. When VidStack raised its price from $12.99 to $15.99, it suffered a high churn rate, losing 18% of its subscribers.
    
    This pricing mistake occurs because managers focus on the higher revenue per remaining subscriber, while ignoring the lost customer lifetime value of those who churned. Customer retention is often cheaper than customer acquisition. To avoid these pricing mistakes, firms must track customer usage data, calculate segment elasticity, and design pricing fences that allow price-sensitive customers to downgrade to cheaper tiers rather than churning entirely.
    
    To mitigate churn, firms implement retention programs, such as loyalty discounts, annual contract commitments, or personalized content recommendations. In subscription-based business models, the churn rate is a key determinant of the customer lifetime value (LTV). If the cost of acquiring a new customer exceeds the LTV, the firm will eventually lose money. Pricing mistakes that increase churn directly destroy LTV, making pricing optimization a critical strategic priority for modern digital platforms.
    
    Ultimately, managing churn is about understanding consumer options. If a customer has dozens of alternative platforms, your price hikes will trigger high churn. If your platform has exclusive content that cannot be replicated, churn will be low even with price increases. Pricing strategies must always evaluate these competitive contexts to avoid overestimating customer loyalty and making costly mistakes. Successful managers recognize that customer trust is an asset that must be protected, not just extracted for short-term gain.
    
    Furthermore, firms must recognize that churn is often a leading indicator of declining product quality or customer dissatisfaction. When customers experience bugs, slow support response times, or a lack of new content, their willingness to pay drops, making them highly sensitive to even minor price changes. Therefore, reducing churn requires a cross-functional effort that combines pricing optimization with continuous improvements in product value, user experience, and customer success, ensuring that subscribers receive enough ongoing benefit to justify their monthly expenditures.`
  },
  {
    slug: "price-discrimination-theory",
    title: "The Mechanics of Price Discrimination",
    objectiveCodes: ["LO6"],
    bodyMd: `Price discrimination occurs when a firm charges different prices to different consumers for the same good, based on their willingness to pay. To practice price discrimination successfully, a firm must have pricing power, be able to identify consumer segments with different price elasticities of demand, and prevent resale (arbitrage). In digital streaming, arbitrage is naturally prevented by personal accounts, making it a perfect environment for price discrimination.
    
    There are three degrees of price discrimination. First-degree (perfect) involves charging each consumer their exact willingness to pay. Second-degree involves volume discounts or pricing tiers. Third-degree involves charging different prices to different demographic groups (e.g., student discounts). By charging higher prices to inelastic segments (heavy users) and lower prices to elastic segments (casual users), a firm can increase total revenue and capture consumer surplus.
    
    While price discrimination increases firm profits, its effect on consumer welfare is mixed. First-degree price discrimination eliminates all consumer surplus, transferring it to the firm, but it maximizes economic efficiency by eliminating deadweight loss. Third-degree price discrimination can increase total output, making goods available to lower-income segments who would otherwise be priced out. Therefore, regulators analyze price discrimination schemes carefully to balance efficiency gains against distribution equity concerns.
    
    In modern digital ecosystems, third-degree price discrimination is highly prevalent in the form of student and senior discounts, geographic pricing, and occupation-based promotions. These segmentations are easily verified using digital credentials, allowing firms to lower entry barriers for lower-income groups without cannibalizing revenue from corporate or high-income accounts, creating a win-win scenario for both the firm and society. As businesses scale globally, the art of segment-based pricing becomes the primary driver of international growth and profitability.
    
    Additionally, modern businesses utilize dynamic pricing algorithms to execute price discrimination in real time. For example, airlines and ride-sharing apps adjust rates based on current demand, local weather conditions, and even the user's remaining battery percentage. This dynamic form of pricing allows firms to capture maximum willingness to pay on a minute-by-minute basis. However, firms must be careful: if consumers perceive dynamic pricing as unfair or manipulative, they may react with anger, resulting in long-term brand damage and customer churn.`
  },
  {
    slug: "tier-design-fences",
    title: "Designing Tiers: Multi-pricing and Cannibalization Fences",
    objectiveCodes: ["LO6"],
    bodyMd: `Designing multiple pricing tiers is a common form of second-degree price discrimination. A typical streaming service offers a Basic (ad-supported) tier, a Standard tier, and a Premium tier. The goal is to capture high willingness to pay from heavy users while offering a cheap option for casual users. However, a major risk in tier design is cannibalization, which occurs when high-value users downgrade to a cheaper tier, reducing total revenue.
    
    To prevent cannibalization, firms must construct effective pricing fences. Pricing fences are features or limitations that separate the tiers and prevent high-value users from choosing the cheaper option. Fences can be quality-based (4K resolution vs 1080p, offline downloads vs streaming only) or behavior-based (ads vs ad-free, number of screens). If fences are too weak, cannibalization occurs, causing revenue to shrink. If fences are too restrictive, consumers may churn entirely. Balancing these trade-offs is a critical pricing skill.
    
    Firms must continuously monitor tier performance and adjust fences as consumer preferences and competitor offerings evolve. If a competitor offers a high-quality service at a lower price, a firm may be forced to lower its fences or adjust pricing to prevent customer churn. Successful tier design requires pricing managers to conduct consumer surveys, perform conjoint analysis, and run controlled A/B pricing tests. These methods help firms capture willingness to pay while minimizing the threat of cannibalization.
    
    Furthermore, pricing fences must feel fair and logical to consumers. If a fence feels arbitrary or unnecessarily punitive, it can damage brand reputation and increase churn rates. Effective fences, such as charging extra for high-definition streaming or multi-screen support, align with consumers' natural perceptions of product quality and utility, making them willing to pay the premium rate without feeling exploited. Mastering the balance between profitability and consumer experience is what separates industry leaders from those who struggle to maintain a consistent customer base.`
  }
];

const mayaEconomicsResponses: Record<string, string> = {
  ps1: `I used a two-market example to show what happens when a streaming service gets a sudden increase in content costs. In the first version I moved along the demand curve when I meant to shift it, so I redrew the graph and explained the difference in words. My equilibrium calculation is fine now, but I still need to be more careful about saying which assumption changed before I describe the new price and quantity.`,
  ps2: `For the consumer-surplus question I treated the demand schedule as a set of willingness-to-pay values rather than just a line to shade. The first customer gets more surplus than the last one because the same price is below their different reservation values. I connected that to a streaming plan by saying that a flat price leaves some value with heavy users. I am less sure about the sentence on fairness and would want to separate the efficiency point from the distribution point.`,
  ps3: `I calculated total revenue before comparing the two prices, which helped me see that a higher price does not automatically mean more revenue. The marginal-cost part was where I made the biggest mistake: I used average cost in the first draft. I corrected it by writing the change in total cost for one additional subscriber and then checked the profit at the proposed quantity.`,
  exam: `The elasticity question was the weak part of my exam. I used the slope of the line as if it were the same thing as percentage responsiveness, which is why I lost points. I did better on consumer surplus and monopoly markup. Looking back, I should have written the percentage-change formula before looking at the graph instead of relying on the visual steepness.`,
  session: `I started with the customer groups instead of choosing three prices first. VidStack needs a way to keep casual viewers after the $15 increase, but a cheap tier cannot be so attractive that every current subscriber downgrades.

Recommended Pricing Tiers
- Basic: $7.99 with ads for casual viewers
- Standard: $12.99 with two screens for regular households
- Premium: $19.99 with 4K and offline downloads for heavy users

I revised the fences after thinking through cannibalization: Standard keeps the family use case, while Premium is for people who actually value simultaneous screens and offline viewing. I am not claiming the prices are optimal without demand data. The point is that each tier has a different job and I can say what evidence I would look for next.`,
};

function economicsSubmissionBody(studentKey: string, assignmentKey: string): string {
  if (studentKey === "maya" && mayaEconomicsResponses[assignmentKey]) {
    return mayaEconomicsResponses[assignmentKey];
  }

  const note = economicsWritingFor(studentKey);
  const name = economicsStudentName(studentKey);
  if (assignmentKey === "ps1") {
    return `${name}: ${note.opening}\n\n${note.concept}`;
  }
  if (assignmentKey === "ps2") {
    return `${name}: I used willingness to pay and consumer surplus to work through the case. ${note.concept}\n\n${note.caveat}`;
  }
  if (assignmentKey === "ps3") {
    return `${name}: I compared total revenue, total cost, and the marginal decision before choosing a price. ${note.opening}\n\n${note.caveat}`;
  }
  if (assignmentKey === "exam-1") {
    return `${name}: The elasticity question is the part I had to slow down on. ${note.concept}\n\n${note.caveat}`;
  }
  return `${name}: ${note.opening}\n\n${note.revision}\n\n${note.caveat}`;
}

function economicsSessionBody(studentKey: string, final: boolean): string {
  if (studentKey === "maya") {
    return mayaEconomicsResponses.session;
  }
  const note = economicsWritingFor(studentKey);
  const name = economicsStudentName(studentKey);
  const statusNote = final ? "I revised the table after considering cannibalization." : "I am still deciding whether the middle tier has a clear reason to exist.";
  return `${name}\n\nPricing Strategy Session\n\nRecommended Pricing Tiers\n- Basic: $7.99 with ads for casual viewers\n- Standard: $12.99 with two screens\n- Premium: $19.99 with 4K and offline downloads\n\n${note.revision} ${statusNote} ${note.caveat}`;
}

// Graded submissions for 31 students
const submissionsList: FixtureCourse["submissions"] = [];
// Graded assignments: ps1 (due week 2), ps2 (due week 3), ps3 (due week 4), exam-1 (due week 5), session-assignment (due week 7)
// Setup submissions for ps1, ps2, ps3, and exam-1 for all 31 students.
for (const stud of studentDefs) {
  // PS1
  submissionsList.push({
    assignmentKey: "ps1",
    studentKey: stud.key,
    state: "graded",
    dayOffsetFromDue: -1,
    score: stud.archetype === "Strong" ? 95 : stud.archetype === "Steady" ? 82 : stud.archetype === "Recoverer" ? 78 : stud.archetype === "Delegator" ? 72 : 64,
    grade: stud.archetype === "Strong" ? "A" : stud.archetype === "Steady" ? "B" : stud.archetype === "Recoverer" ? "C" : stud.archetype === "Delegator" ? "C" : "D",
    body: economicsSubmissionBody(stud.key, "ps1"),
  });

  // PS2
  submissionsList.push({
    assignmentKey: "ps2",
    studentKey: stud.key,
    state: "graded",
    dayOffsetFromDue: 0,
    score: stud.archetype === "Strong" ? 98 : stud.archetype === "Steady" ? 85 : stud.archetype === "Recoverer" ? 80 : stud.archetype === "Delegator" ? 74 : 60,
    grade: stud.archetype === "Strong" ? "A" : stud.archetype === "Steady" ? "B" : stud.archetype === "Recoverer" ? "B" : stud.archetype === "Delegator" ? "C" : "D",
    body: economicsSubmissionBody(stud.key, "ps2"),
  });

  // PS3
  submissionsList.push({
    assignmentKey: "ps3",
    studentKey: stud.key,
    state: "graded",
    dayOffsetFromDue: -2,
    score: stud.archetype === "Strong" ? 94 : stud.archetype === "Steady" ? 80 : stud.archetype === "Recoverer" ? 75 : stud.archetype === "Delegator" ? 70 : 58,
    grade: stud.archetype === "Strong" ? "A" : stud.archetype === "Steady" ? "B" : stud.archetype === "Recoverer" ? "C" : stud.archetype === "Delegator" ? "C" : "F",
    body: economicsSubmissionBody(stud.key, "ps3"),
  });

  // Exam 1
  const examScoreObj = examRecord.studentScores.find((es) => es.studentKey === stud.key)!;
  submissionsList.push({
    assignmentKey: "exam-1",
    studentKey: stud.key,
    state: "graded",
    dayOffsetFromDue: 0,
    score: examScoreObj.totalScore,
    grade: examScoreObj.grade,
    body: economicsSubmissionBody(stud.key, "exam-1"),
    topicScores: Object.fromEntries(
      Object.entries(examScoreObj.topicScores).map(([topic, score]) => [
        topic,
        { score, max: exam1TopicMaxes[topic] },
      ])
    ),
  });

  // Session Assignment submission (graded, submitted, or missing).
  // A finalized gradebook score IS the journey report's overall score (the
  // sum of the archetype's rubric level points, see the journey generator
  // below): Strong E/E/E/E = 100, Steady M/M/M/M = 80, Recoverer
  // M/M/E/M = 86, Struggling D/D/D/D = 49, Delegator D/D/Missing/D = 34.
  // Delegation earning next to nothing is the point, not a bug.
  let finalScore = 80;
  if (stud.archetype === "Strong") finalScore = 100;
  else if (stud.archetype === "Steady") finalScore = 80;
  else if (stud.archetype === "Recoverer") finalScore = 86;
  else if (stud.archetype === "Struggling") finalScore = 49;
  else if (stud.archetype === "Delegator") finalScore = 34;

  let finalGrade = "B";
  if (finalScore >= 90) finalGrade = "A";
  else if (finalScore >= 80) finalGrade = "B";
  else if (finalScore >= 70) finalGrade = "C";
  else if (finalScore >= 60) finalGrade = "D";
  else finalGrade = "F";

  const gradedKeys = [
    "maya", "liam", "sofia", "amina", "zara",
    "clara", "hiro", "yusuf", "aravind", "mei",
    "derek", "priya", "jose", "anna", "malik", "chen", "rachel", "noah", "isabel", "sam"
  ];
  const submittedKeys = [
    "elena", "mateo",
    "fatima", "oscar", "chloe", "leila", "nina", "tariq"
  ];

  if (gradedKeys.includes(stud.key)) {
    submissionsList.push({
      assignmentKey: "session-assignment",
      studentKey: stud.key,
      state: "graded",
      dayOffsetFromDue: 0,
      score: finalScore,
      grade: finalGrade,
      body: economicsSessionBody(stud.key, true),
    });
  } else if (submittedKeys.includes(stud.key)) {
    submissionsList.push({
      assignmentKey: "session-assignment",
      studentKey: stud.key,
      state: "submitted",
      dayOffsetFromDue: 0,
      body: economicsSessionBody(stud.key, false),
    });
  } else {
    // missing
    submissionsList.push({
      assignmentKey: "session-assignment",
      studentKey: stud.key,
      state: "missing",
    });
  }
}

// Build the Fixture Course
export const econCourse: FixtureCourse = {
  code: courseCode,
  name: "Intermediate Microeconomics",
  termSlug,
  description: "Intermediate Microeconomics examines how consumers and firms make choices under scarcity, how prices and market power shape those choices, and how policy affects welfare. Students use models of demand, production, cost, elasticity, and monopoly to analyze decisions made by digital platforms. The course emphasizes moving from assumptions and evidence to an economic recommendation that can be defended in writing, graphs, and quantitative work.",
  syllabusMd: `# Syllabus: ECON-241 Intermediate Microeconomics

Intermediate Microeconomics studies how consumers and firms make choices when resources, information, and alternatives are limited. In this section we move from competitive markets to firms with pricing power, then use the same tools to examine a live platform problem. The aim is not to memorize a graph in isolation. It is to explain what changed, whose decision changed, and how the result affects quantity, surplus, revenue, and welfare.

## Instructor and course rhythm

Dr. Amara Osei (instructor@demo.edu) teaches ECON-241. A normal week includes a course page, a worked example, a short problem set or discussion, and a class conversation about what the model leaves out. Bring a calculation and an interpretation to office hours. If the graph and the story disagree, that disagreement is the question to investigate.

## Learning objectives

- LO1: Define equilibrium and predict how a change in demand, supply, or a market intervention affects price and quantity.
- LO2: Explain willingness to pay, marginal benefit, and consumer surplus using schedules, graphs, and ordinary examples.
- LO3: Calculate fixed cost, variable cost, marginal cost, revenue, and profit, then use them to locate a firm's decision.
- LO4: Analyze price elasticity of demand and distinguish percentage responsiveness from the slope of a curve.
- LO5: Evaluate monopoly pricing, markup choices, churn, and the cost of setting a price above what customers will accept.
- LO6: Design a price-discrimination or tiered-pricing scheme with defensible segments and fences.

## Assessment

Problem Set 1 works through equilibrium and shifts in the streaming market. Problem Set 2 uses willingness-to-pay schedules and consumer-surplus areas. Problem Set 3 separates fixed, variable, average, and marginal cost before comparing total revenue and profit. Exam 1 covers the first five weeks and includes a focused elasticity question. The Pricing Strategy Session is the current assessment: use the VidStack case to propose tiers, explain the segment logic, and revise the design after a cannibalization challenge. Problem Set 4 will extend the monopoly and markup work. The final project is a pricing recommendation supported by a demand story, not a list of prices without a mechanism.

Grades reward a visible chain from assumption to model to decision. A correct number with the wrong economic interpretation is not complete. State whether a change moves along a curve or shifts it, whether a cost is marginal or average, and whether a price change is likely to raise or lower total revenue. When you use a course page, cite it by title. When the model is silent about fairness, access, or competitor response, name that limitation instead of quietly assuming it away.

## Working agreements

The course agent is available for explanations, practice, and questions, but it should not replace the student's reasoning. Ask it to check a setup, challenge an assumption, or point to a relevant course page. Do not submit a polished answer you cannot defend in your own words. The Pricing Strategy Session records the reasoning and revision process because the final table alone cannot show whether the model was understood.

Late work is accepted for up to one week with a note about the revision. Office hours are a good place to bring a graph that feels mechanically correct but economically strange. We will keep returning to the same habit: identify the decision, identify the constraint, and then choose the model that actually speaks to it.`,
  classPolicies: [
    {
      title: "Attendance",
      body: "Students may miss no more than two class meetings without an approved accommodation. Contact Dr. Osei as soon as possible when illness, caregiving, or an emergency affects attendance.",
    },
    {
      title: "Late work",
      body: "Problem sets may be submitted up to seven calendar days after the deadline. A late submission must include a short note describing what was revised. Work submitted later requires prior approval.",
    },
    {
      title: "Academic integrity",
      body: "Submitted work must represent the student's own reasoning and writing. Atlas may explain course material, ask questions, and critique an attempt within the assignment rules, but students must not submit generated work they cannot explain or use Atlas to bypass an assessment condition.",
    },
  ],
  status: "published",
  instructorKey: "amara",
  objectives: [
    { code: "LO1", description: "Define market equilibrium and shifts in supply and demand curves.", bloomLevel: "remember", assessmentWeight: 0.15 },
    { code: "LO2", description: "Explain willingness to pay, consumer surplus, and marginal benefit.", bloomLevel: "understand", assessmentWeight: 0.15 },
    { code: "LO3", description: "Calculate marginal cost, fixed cost, revenue, and profit maximization.", bloomLevel: "apply", assessmentWeight: 0.20 },
    { code: "LO4", description: "Analyze price elasticity of demand and its relationship with total revenue and slope.", bloomLevel: "analyze", assessmentWeight: 0.20 },
    { code: "LO5", description: "Evaluate monopoly pricing mistakes, churn, and markup decisions.", bloomLevel: "evaluate", assessmentWeight: 0.15 },
    { code: "LO6", description: "Create price discrimination schemes and design multi-tiered pricing fences.", bloomLevel: "create", assessmentWeight: 0.15 },
  ],
  modules: modulesList,
  assignments: [
    { key: "ps1", name: "Problem Set 1: Equilibrium and Market Shifts", descriptionMd: "Use a streaming-market schedule to solve for equilibrium, then analyze a change in consumer preference and a change in server cost. Draw the original and new graphs, identify whether each change shifts a curve or moves along it, and explain what happens to price, quantity, and the likely shortage or surplus. Include one sentence about an assumption the model makes.", objectiveCodes: ["LO1"], pointsPossible: 100, dueWeek: 2, published: true },
    { key: "ps2", name: "Problem Set 2: Willingness to Pay and Surplus", descriptionMd: "Work from a willingness-to-pay schedule for six streaming customers. Calculate marginal benefit, consumer surplus at a flat price, and the change in surplus after a price increase. Use a graph or table to show which customers leave. End by explaining why a firm's revenue goal and a consumer's value are related but not identical.", objectiveCodes: ["LO2"], pointsPossible: 100, dueWeek: 3, published: true },
    { key: "ps3", name: "Problem Set 3: Costs, Revenue, and the Firm's Decision", descriptionMd: "Separate fixed cost, variable cost, average cost, and marginal cost for a digital platform. Calculate total revenue and profit at several output levels, then identify the quantity where marginal revenue and marginal cost meet. Explain why a near-zero marginal serving cost does not mean the firm has no fixed-cost constraint.", objectiveCodes: ["LO3"], pointsPossible: 100, dueWeek: 4, published: true },
    { key: "exam-1", name: "Midterm Exam 1: Markets, Firms, and Elasticity", descriptionMd: "The midterm covers equilibrium, consumer surplus, cost and revenue, monopoly choices, and price elasticity. Show the model before calculating. One section asks you to distinguish elasticity from slope and explain what a price increase does to revenue in elastic and inelastic regions. Interpret every result in the market story.", objectiveCodes: ["LO1", "LO2", "LO3", "LO4", "LO5"], pointsPossible: 100, dueWeek: 5, published: true },
    { key: "session-assignment", name: "Pricing Strategy Session", descriptionMd: "VidStack lost 18 percent of subscribers after a flat 15 dollar price hike. Work through the case with the course agent, ask questions before choosing a solution, and propose a tiered pricing table with prices, target segments, and concrete fences. Defend the design with elasticity and willingness to pay, then revise it when the agent tests cannibalization. Submit the final proposal and be ready to explain what evidence would change your recommendation.", objectiveCodes: ["LO4", "LO5", "LO6"], pointsPossible: 100, dueWeek: 7, published: true },
    { key: "ps4", name: "Problem Set 4: Monopoly Markups and Churn", descriptionMd: "Analyze a platform with market power that is choosing between a high price with churn and a lower price with more subscribers. Use marginal revenue, marginal cost, elasticity, and a short customer-retention table to explain the decision. Identify one pricing mistake that a single graph would hide.", objectiveCodes: ["LO5"], pointsPossible: 100, dueWeek: 9, published: true },
    { key: "final-project", name: "Final Pricing Project: A Defensible Market Design", descriptionMd: "Draft a pricing recommendation for a product you can describe with a demand story. The proposal should define customer segments, willingness-to-pay evidence, costs, prices, fences, competitor risks, and one fairness or access concern. The draft is unpublished while the class decides how to compare recommendations.", objectiveCodes: ["LO6"], pointsPossible: 100, dueWeek: 12, published: false },
  ],
  pages: pagesList,
  announcements: [
    { title: "Exam 1 Grades Released", messageMd: "Exam 1 grades are posted. When you read the feedback, do not skip the short note under the elasticity question. A number of otherwise solid solutions used the slope of the demand curve as if it were percentage responsiveness. Bring the graph and the calculation to office hours if those two ideas still feel interchangeable.", dayOffset: 30 },
    { title: "Active Pricing Session Reminders", messageMd: "If you are working on the VidStack session, start with the 18% subscriber loss and explain who you think left. Then give each tier a job, a price, and a fence that a real customer would value. Before submitting, ask the agent to test whether a Standard customer could keep the same value by downgrading. The final table is only half of the assignment. I want to see the revision and the evidence you would collect next.", dayOffset: 43 },
  ],
  enrollments: [
    { userKey: "amara", role: "instructor" },
    ...studentDefs.map((s) => ({ userKey: s.key, role: "student" as const, currentScore: s.key === "maya" ? 78 : s.archetype === "Strong" ? 94 : s.archetype === "Steady" ? 81 : s.archetype === "Recoverer" ? 76 : 60 })),
  ],
  submissions: submissionsList,
  policy,
};

// FixturePackage composition
export const packageData: FixturePackage = {
  org: { name: "Demo University", slug: "demo-u" },
  password: "atlas1234",
  terms: [
    { slug: termSlug, name: "Summer 2026", startsAt: "2026-04-27", endsAt: "2026-07-31", current: true },
  ],
  users: [
    { key: "admin", name: "Dr. Elena Vance", email: "admin@demo.edu", role: "admin" },
    { key: "amara", name: "Dr. Amara Osei", email: "instructor@demo.edu", role: "instructor" },
    { key: "keith", name: "Dr. Keith Jenkins", email: "kjenkins@demo.edu", role: "instructor" },
    { key: "sarah", name: "Dr. Sarah Lin", email: "slin@demo.edu", role: "instructor" },
    { key: "marcus", name: "Dr. Marcus Vance", email: "mvance@demo.edu", role: "instructor" },
    ...studentDefs.map((s) => ({ key: s.key, name: s.name, email: s.email, role: "student" as const })),
  ],
  courses: [econCourse, cs152Course, stat201Course, hist310Course],
};

// Define Rubric criteria
const rubricVersion = 1;
export const rubric: V0Rubric = {
  id: idFor(`rubric:${courseKey}`),
  orgId,
  courseId,
  version: rubricVersion,
  criteria: [
    {
      key: "framing",
      weight: 20,
      name: "Problem Framing & Questions",
      description: "Student interrogates the scenario before proposing solutions.",
      levels: [
        { level: "Exceeds", score: 20, descriptor: "Asks deep questions about segments, churn cause, and willingness to pay before writing tiers." },
        { level: "Meets", score: 16, descriptor: "Identifies the core issues and segments reasonably well." },
        { level: "Developing", score: 10, descriptor: "Makes assumptions without exploring segment differences." },
        { level: "Missing", score: 0, descriptor: "Fails to show any framing or initial analysis." },
      ],
    },
    {
      key: "grounding",
      weight: 25,
      name: "Course-concept Grounding",
      description: "Student correctly applies price elasticity of demand and price discrimination.",
      levels: [
        { level: "Exceeds", score: 25, descriptor: "Uses elasticity, marginal cost, and price discrimination accurately in derivations." },
        { level: "Meets", score: 20, descriptor: "Uses concepts correctly but with minor imprecision." },
        { level: "Developing", score: 12, descriptor: "Confuses price elasticity of demand with slope or makes conceptual mistakes." },
        { level: "Missing", score: 0, descriptor: "No use of course economic concepts." },
      ],
    },
    {
      key: "iteration",
      weight: 30,
      name: "Iteration under Challenge",
      description: "Student revises tiers and designs fences when challenged with cannibalization risks.",
      levels: [
        { level: "Exceeds", score: 30, descriptor: "Proactively revises pricing and designs strong fences (ads, screens) under cannibalization stress tests." },
        { level: "Meets", score: 24, descriptor: "Makes minor revisions when challenged." },
        { level: "Developing", score: 15, descriptor: "Defends weak designs or fails to implement effective fences." },
        { level: "Missing", score: 0, descriptor: "Refuses to iterate or ignores challenges entirely." },
      ],
    },
    {
      key: "final_design",
      weight: 25,
      name: "Final Design & Defense",
      description: "Coherent pricing structure in the student's own words.",
      levels: [
        { level: "Exceeds", score: 25, descriptor: "Pristine tiered table and robust revenue justification." },
        { level: "Meets", score: 20, descriptor: "Complete table and basic logical justification." },
        { level: "Developing", score: 12, descriptor: "Incomplete table or poor defense." },
        { level: "Missing", score: 0, descriptor: "No final design submitted." },
      ],
    },
  ],
};

// Define session assignment config
export const sessionAssignment: V0SessionAssignment = {
  id: idFor(`session-assignment:${courseKey}`),
  orgId,
  courseId,
  assignmentId: sessionAssignmentId,
  instructions: `VidStack lost 18% of its subscribers after moving from a flat $12.99 plan to a flat $15 plan. Dr. Osei wants a recommendation that explains the loss instead of treating it as a generic request for three prices.

Start by naming the customer groups you think are hidden inside the 18% churn and state what you are assuming about their willingness to pay. Use the course pages on elasticity, revenue, and price discrimination to explain why one price may fail. Do not use the visual steepness of a graph as a substitute for a percentage-response calculation.

Your working record should include:
1. A short problem frame tied to the subscriber loss.
2. A tier table with a price, target use case, and at least one concrete fence for each tier.
3. A sentence explaining why a customer would choose each tier and why a higher-value customer would not simply downgrade.
4. A revision after the agent tests cannibalization, plus one piece of evidence you would collect before treating the prices as a forecast.

The agent may ask questions, point you to course pages, and challenge the design. It should not choose the prices for you. Submit the final table with the reasoning that led to it, including any uncertainty that remains.`,
  durationMinutes: 30,
  groundingScope: ["Syllabus", "Weeks 4-6", "Exam 1"],
  personalRecordSideNotes: true,
  // Professor-sanctioned triggers, flagged during the Exam 2 planning session:
  // the weak concept (and the term it gets confused with) arms the side note.
  sideNoteTriggers: [
    {
      topic: "elasticity",
      keywords: ["elasticity", "elastic", "slope", "price sensitivity"],
      sourcePageSlug: "elasticity-revenue-relation",
    },
  ],
  planningSessionId: professorPlanningAgentSessionId,
};

// Hand-crafted transcripts: Turn definitions with verbatim text to make index extraction reliable
// Professor Planning Session (10 turns)
const planningTurnsRaw = [
  { role: "user" as const, text: "I want to set up the next practice set and pricing session for ECON-241. Students are still pattern-matching equations without thinking about the economic intuition." },
  { role: "assistant" as const, text: "I understand. Looking at the class record, 14 of 31 students confused elasticity with slope on Exam 1. We should design a session that forces them to grapple with that distinction." },
  { role: "user" as const, text: "Yes, exactly. I want them to tackle a pricing case study where a flat price hike fails because of elasticity differences across customer segments." },
  { role: "assistant" as const, text: "We can use the Streaming Problem: VidStack loses subscribers after a flat rate hike. To test their understanding, the tutor agent will prompt them on segmentation and then stress-test their model with cannibalization." },
  { role: "user" as const, text: "Perfect. We'll set elasticity as the weak concept and price discrimination as the target next concept. Make sure the tutor challenges them when they try to offer premium features without fences." },
  { role: "assistant" as const, text: "Understood. I will flag elasticity and price discrimination. I will also generate a draft rubric weighting Iteration under challenge at 30% and Problem framing at 20% to reward conceptual adjustments." },
  { role: "user" as const, text: "That weights alignment correctly. Let's make sure the personal-record side notes are enabled, so students who struggled on Exam 1 get a nudge." },
  { role: "assistant" as const, text: "I have configured the session assignment. Personal-record side notes are toggled on. I will also save these flagged topics for our practice set recommendation." },
  { role: "user" as const, text: "Great. Please save this session. We are ready to publish." },
  { role: "assistant" as const, text: "Planning session complete. The pricing assignment and rubric are saved and ready for student enrollments." }
];

// Featured Recoverer: Maya Patel (22 turns)
const mayaTurnsRaw = [
  { role: "user" as const, text: "Hi, I am ready to start the streaming pricing problem. The description says VidStack lost 18% of users after raising prices to $15." },
  { role: "assistant" as const, text: "Welcome Maya. Before we design a solution, let's frame the problem. Why do you think a flat $15 price caused 18% of users to leave? What does that tell us about VidStack's customer base?" },
  { role: "user" as const, text: "I think some people just don't want to pay that much. Maybe the slope of the demand curve is really steep, so raising the price makes a lot of people quit." },
  { role: "assistant" as const, text: "You're thinking about consumer sensitivity, which is great. But be careful: you mentioned the slope of the demand curve. Is slope the best way to measure consumer sensitivity at different price points?" },
  { role: "user" as const, text: "Wait, isn't slope what shows how much demand changes when price changes? If the slope is high, demand is very sensitive." },
  { role: "assistant" as const, text: "Let's pause there." }, // Turn index 5 (Trigger side note card)
  { role: "user" as const, text: "Ah, the side note card popped up. It says I got elasticity wrong on Exam 1, and that elasticity is different from slope because it measures percentage changes rather than absolute changes. Let me rethink." }, // Turn index 6 (Corrects concept)
  { role: "assistant" as const, text: "Excellent adjustment. Since elasticity measures percentage changes, how does elasticity vary along a linear demand curve compared to the slope?" },
  { role: "user" as const, text: "Right, the slope is constant but elasticity changes. At higher prices, demand is more elastic. So casual users who watch less have more elastic demand, while heavy users have inelastic demand." },
  { role: "assistant" as const, text: "Exactly! So a flat $15 price hike overcharges casual viewers while undercharging heavy users. How can we use price discrimination to solve this?" },
  { role: "user" as const, text: "We can design multiple pricing tiers. Let's do a basic tier with ads for casual users at $7.99, a standard tier at $12.99, and a premium tier at $17.99." },
  { role: "assistant" as const, text: "That is a solid initial sketch. But what stops a standard subscriber from downgrading to the basic $7.99 tier to save money? If they all switch, VidStack's revenue will drop." }, // Turn index 11 (Stress test)
  { role: "user" as const, text: "Oh, that is cannibalization. We need fences. Let's make the basic tier ads-supported and limit screens to 1, while Premium has 4K and offline downloads." }, // Turn index 12 (Revises pricing/fences)
  { role: "assistant" as const, text: "Good fences. Let's look at the prices: Premium is $17.99. If heavy users were willing to pay $15 without churning, can we charge more for Premium?" },
  { role: "user" as const, text: "Yes, we can raise Premium to $19.99 because their demand is inelastic, and they get offline downloads as a fence. Standard stays at $12.99, and Basic ads is $7.99." },
  { role: "assistant" as const, text: "Let's summarize your final pricing table and defense." },
  { role: "user" as const, text: "Basic (with ads, 1 screen): $7.99. Standard (ad-free, 2 screens): $12.99. Premium (4K, offline downloads, 4 screens): $19.99. This segments the market based on willingness to pay and prevents cannibalization." },
  { role: "assistant" as const, text: "Excellent design, Maya. Your reasoning is grounded in elasticity and price discrimination. Submit when you are ready." },
  { role: "user" as const, text: "I am ready to submit my pricing table now." },
  { role: "assistant" as const, text: "Thank you. Your session is complete. A journey report has been generated." }
];

// Strong student: Liam (20 turns)
const liamTurnsRaw = [
  { role: "user" as const, text: "Let's begin the VidStack pricing analysis. The flat price hike from $12 to $15 lost 18% of subscribers, which implies an arc elasticity of demand around 1.2, showing elastic demand in that region." },
  { role: "assistant" as const, text: "Wow, straight to the math. Yes, demand is elastic. How should we segment this market to capture more consumer surplus?" },
  { role: "user" as const, text: "We should segment based on user intensity. Casual users have high elasticity of demand (sensitive to price, low WTP), while family households have low elasticity (inelastic, high WTP)." },
  { role: "assistant" as const, text: "Agreed. What pricing tiers do you propose to separate these segments?" },
  { role: "user" as const, text: "I propose a three-tier model: Basic (Ads, 480p, 1 screen) at $6.99, Standard (No Ads, 1080p, 2 screens) at $12.99, and Premium (4K, 4 screens, offline downloads) at $19.99." },
  { role: "assistant" as const, text: "That is a clean design. What is the cannibalization risk here? How do your fences prevent Standard users from downgrading to Basic?" },
  { role: "user" as const, text: "The primary fence is advertisements. Research shows ad intolerance is high among middle-income segments, meaning Standard users will stay ad-free at $12.99 rather than tolerate ads for a $6 saving. Premium users stay for 4K and screen counts." },
  { role: "assistant" as const, text: "Very rigorous framing. What is the expected change in total revenue?" },
  { role: "user" as const, text: "Revenue should increase by 12% because the low $6.99 price recovers casual users, while the $19.99 Premium captures surplus from heavy users, offsetting standard churn." },
  { role: "assistant" as const, text: "Fantastic. Submit when you are ready." },
  { role: "user" as const, text: "Submitted. Here is my final pricing table." },
  { role: "assistant" as const, text: "Session closed. Great work." }
];

// Delegator student: Sofia (18 turns)
const sofiaTurnsRaw = [
  { role: "user" as const, text: "Hi, can you just design the pricing tiers for VidStack for me? What prices should I use?" },
  { role: "assistant" as const, text: "I cannot write the tiers for you, Sofia. But I can help you design them. Let's start by framing the problem: who are VidStack's users, and why did they leave?" },
  { role: "user" as const, text: "I don't know, they left because it was too expensive. Just tell me what prices are best to get them back." },
  { role: "assistant" as const, text: "If we just drop the price, we lose revenue from everyone. Let's think about segments. What is the difference between a casual viewer and a heavy viewer?" },
  { role: "user" as const, text: "Casual viewers watch less. Can we just make standard $12 and premium $18?" },
  { role: "assistant" as const, text: "Those are possible prices. But what fences will you put between them to prevent heavy viewers from choosing standard?" },
  { role: "user" as const, text: "Just make standard ad-free and premium ad-free too but with more screens. Is that fine?" },
  { role: "assistant" as const, text: "If both are ad-free and the only difference is screens, many users will choose standard. Let's look at the rubric: it requires iteration under challenge. Would you like to revise your fences?" },
  { role: "user" as const, text: "No, that looks fine. Just submit it like this." },
  { role: "assistant" as const, text: "Understood. Please submit your final pricing strategy." },
  { role: "user" as const, text: "Okay, I submitted it." },
  { role: "assistant" as const, text: "Session complete." }
];

// Helper to convert raw turn logs into fully populated V0Turns and count character offsets
function mapTurns(sessionId: string, rawTurns: Array<{ role: "user" | "assistant" | "tool", text: string }>): V0Turn[] {
  return rawTurns.map((t, idx) => ({
    id: idFor(`turn:${sessionId}:${idx}`),
    orgId,
    sessionId,
    turnIndex: idx,
    role: t.role,
    parts: [{ type: "text", text: t.text }],
    createdAt: new Date(new Date("2026-06-09T10:00:00Z").getTime() + idx * 60 * 1000).toISOString(),
    text: t.text,
  }));
}

// Map the hand-crafted sessions
const professorPlanningTurns = mapTurns(professorPlanningAgentSessionId, planningTurnsRaw);
const mayaTurns = mapTurns(idFor(`agentSession:${courseKey}:maya`), mayaTurnsRaw);
const liamTurns = mapTurns(idFor(`agentSession:${courseKey}:liam`), liamTurnsRaw);
const sofiaTurns = mapTurns(idFor(`agentSession:${courseKey}:sofia`), sofiaTurnsRaw);

// Maya's 3 artifact state snapshots
const mayaArtifactStates: V0ArtifactState[] = [
  {
    id: idFor(`artifactState:maya:1`),
    orgId,
    sessionId: idFor(`agentSession:${courseKey}:maya`),
    turnIndex: 10,
    artifactType: "pricing_table",
    state: {
      tiers: [
        { name: "Basic", price: 7.99, targetSegment: "Casual users", fence: "Ads", rationale: "Low price to attract people who left." },
        { name: "Standard", price: 12.99, targetSegment: "Regular users", fence: "Ad-free", rationale: "Standard streaming." },
        { name: "Premium", price: 17.99, targetSegment: "Heavy users", fence: "Ad-free", rationale: "Highest quality." }
      ],
      expectedRisk: "Standard users might downgrade to Basic.",
    },
    createdAt: new Date("2026-06-09T10:10:00Z").toISOString(),
  },
  {
    id: idFor(`artifactState:maya:2`),
    orgId,
    sessionId: idFor(`agentSession:${courseKey}:maya`),
    turnIndex: 12,
    artifactType: "pricing_table",
    state: {
      tiers: [
        { name: "Basic (Ads)", price: 7.99, targetSegment: "Casual users", fence: "Ads, 1 screen", rationale: "Limit screens to prevent Standard downgrades." },
        { name: "Standard", price: 12.99, targetSegment: "Regular users", fence: "Ad-free, 2 screens", rationale: "Standard ad-free." },
        { name: "Premium", price: 17.99, targetSegment: "Heavy users", fence: "4K, offline downloads, 4 screens", rationale: "Rich features for heavy users." }
      ],
      expectedRisk: "Premium price might be too low since heavy users have high WTP.",
      revisionNote: "Added screen limits and downloads fence.",
    },
    createdAt: new Date("2026-06-09T10:12:00Z").toISOString(),
  },
  {
    id: idFor(`artifactState:maya:3`),
    orgId,
    sessionId: idFor(`agentSession:${courseKey}:maya`),
    turnIndex: 15,
    artifactType: "pricing_table",
    state: {
      tiers: [
        { name: "Basic (Ads)", price: 7.99, targetSegment: "Casual users", fence: "Ads, 1 screen", rationale: "Aggressive ad fences to prevent cannibalization." },
        { name: "Standard", price: 12.99, targetSegment: "Regular users", fence: "Ad-free, 2 screens", rationale: "Sweet spot pricing." },
        { name: "Premium", price: 19.99, targetSegment: "Heavy users", fence: "4K, offline downloads, 4 screens", rationale: "Premium value with higher price." }
      ],
      expectedRisk: "Minimal cannibalization due to ads and resolution fences.",
      revisionNote: "Raised premium price based on inelastic demand.",
    },
    createdAt: new Date("2026-06-09T10:15:00Z").toISOString(),
  }
];

// Side-note cards
const sideNotes: V0SideNoteCard[] = [
  {
    id: idFor(`sideNoteCard:${courseKey}:maya:elasticity`),
    orgId,
    sessionId: idFor(`agentSession:${courseKey}:maya`),
    turnIndex: 5,
    topic: "elasticity",
    text: "From your course: Elasticity cost you 8 of 12 points on Exam 1, and it anchors the practice set Prof. Osei is planning for Exam 2. This problem is built on it. Worth slowing down here.",
    createdAt: new Date("2026-06-09T10:05:00Z").toISOString(),
    sourceRefs: ["elasticity-revenue-relation"],
    sourcePageSlug: "elasticity-revenue-relation",
  }
];
export { sideNotes as sideNoteCards };

// Programmatic generation details for the other 28 student sessions
const dialogueDataMap: Record<string, {
  raw: Array<{ role: "user" | "assistant" | "tool"; text: string }>;
  quotes: { framing: string; grounding: string; iteration: string; final_design: string; };
  pricing: {
    tiers: Array<{ name: string; price: number; targetSegment: string; fence: string; rationale: string; }>;
    expectedRisk: string;
  };
}> = {
  amina: {
    raw: [
      { role: "user", text: "Amina here, ready to examine the VidStack pricing drop. The 18% churn is severe." },
      { role: "assistant", text: "Welcome Amina. Why did this churn happen? Is it price sensitivity?" },
      { role: "user", text: "Yes, I think it represents elastic demand. Wait, is it because the slope is constant on the linear curve?" },
      { role: "assistant", text: "Think about how slope compares to elasticity. Does a constant slope mean constant sensitivity?" },
      { role: "user", text: "Aha! Right, the slope is constant but elasticity changes. At higher prices, demand is more elastic, so raising prices above $12.99 was a mistake." },
      { role: "assistant", text: "Exactly! So how do we capture this with tiers?" },
      { role: "user", text: "We can do multiple tiers. Basic ads tier at $7.50 and standard tier at $12.50, premium at $18.50." },
      { role: "assistant", text: "Good. What stops standard users from downgrading to basic?" },
      { role: "user", text: "We need fences. Let's make basic ad-supported and limit screens to one, keeping standard ad-free with two screens." },
      { role: "assistant", text: "Session complete. Great recovery." }
    ],
    quotes: {
      framing: "Amina here, ready to examine the VidStack pricing drop. The 18% churn is severe.",
      grounding: "Right, the slope is constant but elasticity changes. At higher prices, demand is more elastic",
      iteration: "We need fences. Let's make basic ad-supported and limit screens to one",
      final_design: "Basic ads tier at $7.50 and standard tier at $12.50, premium at $18.50."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.50, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Lower price point." },
        { name: "Standard", price: 12.50, targetSegment: "Standard", fence: "Ad-free, 2 screens", rationale: "Core option." },
        { name: "Premium", price: 18.50, targetSegment: "Heavy users", fence: "4K, 4 screens", rationale: "Higher features." }
      ],
      expectedRisk: "Standard users might downgrade if basic ads are not annoying enough."
    }
  },
  zara: {
    raw: [
      { role: "user", text: "Zara Williams starting. The flat price hike to $15.99 caused a huge loss in customer counts." },
      { role: "assistant", text: "Indeed Zara. Let's frame this. What does this tell us about their price elasticity?" },
      { role: "user", text: "It shows elastic demand. But since the demand function is linear, is sensitivity the same everywhere?" },
      { role: "assistant", text: "Does a straight line have the same elasticity at every point?" },
      { role: "user", text: "The slope is constant, but elasticity is the percentage change. Higher prices are in the elastic region, meaning more sensitivity." },
      { role: "assistant", text: "Perfect. What pricing tiers would you design to segment these users?" },
      { role: "user", text: "We can set three tiers: Basic-Ads at $7.00, Standard at $12.00, and Premium at $18.00." },
      { role: "assistant", text: "How will you prevent standard subscribers from downgrading to basic?" },
      { role: "user", text: "We will establish pricing fences. Basic has ads and 1 screen, Standard is ad-free, and Premium has offline downloads." },
      { role: "assistant", text: "Excellent work Zara." }
    ],
    quotes: {
      framing: "Zara Williams starting. The flat price hike to $15.99 caused a huge loss in customer counts.",
      grounding: "The slope is constant, but elasticity is the percentage change. Higher prices are in the elastic region",
      iteration: "We will establish pricing fences. Basic has ads and 1 screen",
      final_design: "Basic-Ads at $7.00, Standard at $12.00, and Premium at $18.00."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.00, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Lower price point." },
        { name: "Standard", price: 12.00, targetSegment: "Standard", fence: "Ad-free, 2 screens", rationale: "Core option." },
        { name: "Premium", price: 18.00, targetSegment: "Heavy users", fence: "4K, 4 screens, offline downloads", rationale: "Higher features." }
      ],
      expectedRisk: "Cannibalization risk is low due to strong ad barrier."
    }
  },
  clara: {
    raw: [
      { role: "user", text: "Clara Dupont starting. Evaluating the customer cohorts, it is clear that demand is highly price elastic in the lower segment. We must configure tiers." },
      { role: "assistant", text: "Welcome Clara. Let's look at the price elasticity of demand." },
      { role: "user", text: "The constant slope of a linear demand function implies elasticity varies at each point. We must optimize markup where demand is inelastic." },
      { role: "assistant", text: "Correct. How will you fence the premium tier?" },
      { role: "user", text: "We will restrict high definition resolution to standard and premium tiers, while the entry tier is ad-supported." },
      { role: "assistant", text: "And what is the final pricing layout?" },
      { role: "user", text: "The proposed structure is Clara's Tiered Plan: Basic at $6.99 (Ads, 1 screen), Standard at $12.99 (No Ads, 2 screens), Premium at $18.99 (4K, 4 screens)." },
      { role: "assistant", text: "Excellent, session complete." }
    ],
    quotes: {
      framing: "Evaluating the customer cohorts, it is clear that demand is highly price elastic",
      grounding: "The constant slope of a linear demand function implies elasticity varies at each point.",
      iteration: "We will restrict high definition resolution to standard and premium tiers",
      final_design: "Basic at $6.99 (Ads, 1 screen), Standard at $12.99 (No Ads, 2 screens), Premium at $18.99 (4K, 4 screens)"
    },
    pricing: {
      tiers: [
        { name: "Basic", price: 6.99, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Low cost entry." },
        { name: "Standard", price: 12.99, targetSegment: "Regular", fence: "No Ads, HD, 2 screens", rationale: "Mainstream tier." },
        { name: "Premium", price: 18.99, targetSegment: "Heavy", fence: "4K, offline, 4 screens", rationale: "High WTP users." }
      ],
      expectedRisk: "Minimal cannibalization."
    }
  },
  hiro: {
    raw: [
      { role: "user", text: "Hiro Tanaka entering. Looking at the pricing data, the initial price hike caused a disproportionate drop in subscription count, showing elasticity > 1." },
      { role: "assistant", text: "Indeed. How do you distinguish that from the slope of the curve?" },
      { role: "user", text: "Confusion between curve slope and price elasticity is a classic error. While slope measures absolute change, elasticity measures percentage changes." },
      { role: "assistant", text: "Correct. What is the fence design for standard users?" },
      { role: "user", text: "To prevent cannibalization, the basic tier will be restricted to 720p resolution and a single screen." },
      { role: "assistant", text: "And your pricing table?" },
      { role: "user", text: "Basic Ads for $7.50, Standard for $13.50, and Premium 4K for $19.50." },
      { role: "assistant", text: "Session complete. Thank you." }
    ],
    quotes: {
      framing: "Looking at the pricing data, the initial price hike caused a disproportionate drop",
      grounding: "Confusion between curve slope and price elasticity is a classic error.",
      iteration: "the basic tier will be restricted to 720p resolution and a single screen.",
      final_design: "Basic Ads for $7.50, Standard for $13.50, and Premium 4K for $19.50"
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.50, targetSegment: "Casual", fence: "720p, Ads, 1 screen", rationale: "Affordable entry." },
        { name: "Standard", price: 13.50, targetSegment: "Standard", fence: "1080p, Ad-free, 2 screens", rationale: "Mainstream." },
        { name: "Premium", price: 19.50, targetSegment: "Heavy", fence: "4K, offline, 4 screens", rationale: "Top value." }
      ],
      expectedRisk: "Standard users might downgrade if 720p is acceptable."
    }
  },
  yusuf: {
    raw: [
      { role: "user", text: "Yusuf Khan starting. A price hike from $12.99 to $15.99 on VidStack caused an 18% subscriber loss, yielding a demand elasticity of approximately 1.2." },
      { role: "assistant", text: "Accurate calculation. How does this guide our pricing?" },
      { role: "user", text: "To maximize revenue, price should be set where marginal revenue equals marginal cost, not simply by looking at the slope of the curve." },
      { role: "assistant", text: "Good. How do we prevent cannibalization?" },
      { role: "user", text: "Our fences will be functional. We will reserve offline downloads for the top two tiers." },
      { role: "assistant", text: "And the pricing structure?" },
      { role: "user", text: "Basic-Ads at $6.50 (1 screen), Standard at $12.00 (2 screens), Premium at $17.50 (4K, 4 screens)." },
      { role: "assistant", text: "Seeded and complete." }
    ],
    quotes: {
      framing: "A price hike from $12.99 to $15.99 on VidStack caused an 18% subscriber loss",
      grounding: "price should be set where marginal revenue equals marginal cost, not simply by looking at the slope",
      iteration: "We will reserve offline downloads for the top two tiers.",
      final_design: "Basic-Ads at $6.50 (1 screen), Standard at $12.00 (2 screens), Premium at $17.50 (4K, 4 screens)"
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 6.50, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Budget entry." },
        { name: "Standard", price: 12.00, targetSegment: "Standard", fence: "No Ads, 2 screens", rationale: "Regular." },
        { name: "Premium", price: 17.50, targetSegment: "Heavy", fence: "4K, 4 screens, offline downloads", rationale: "Premium value." }
      ],
      expectedRisk: "Heavy users might downgrade if they don't need offline downloads."
    }
  },
  aravind: {
    raw: [
      { role: "user", text: "Aravind Pillai starting. The high fixed cost of content acquisition demands a large volume of subscribers, suggesting multi-pricing." },
      { role: "assistant", text: "Understood. How does the elasticity vary?" },
      { role: "user", text: "Calculating elasticity at different pricing points along the demand curve reveals that we are currently pricing in the elastic region." },
      { role: "assistant", text: "Correct. How will you separate the segments?" },
      { role: "user", text: "I propose utilizing advertising tolerance as a behavioral fence to separate price-sensitive casual users." },
      { role: "assistant", text: "What is your final table?" },
      { role: "user", text: "Basic-Ads at $7.00 (ad-supported), Standard at $13.00 (ad-free), and Premium at $19.00 (Ultra HD, 4 screens)." },
      { role: "assistant", text: "Session complete. Very clean reasoning." }
    ],
    quotes: {
      framing: "high fixed cost of content acquisition demands a large volume of subscribers",
      grounding: "Calculating elasticity at different pricing points along the demand curve reveals",
      iteration: "advertising tolerance as a behavioral fence to separate price-sensitive casual users",
      final_design: "Basic-Ads at $7.00 (ad-supported), Standard at $13.00 (ad-free), and Premium at $19.00 (Ultra HD, 4 screens)"
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.00, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Entry-level." },
        { name: "Standard", price: 13.00, targetSegment: "Standard", fence: "No Ads, HD, 2 screens", rationale: "Core option." },
        { name: "Premium", price: 19.00, targetSegment: "Heavy", fence: "No Ads, 4K, 4 screens", rationale: "Full features." }
      ],
      expectedRisk: "High ad load might cause basic users to churn."
    }
  },
  mei: {
    raw: [
      { role: "user", text: "Mei Chen starting. The price sensitivity varies heavily across segments, requiring a multi-tiered price structure." },
      { role: "assistant", text: "Yes. How do you explain this mathematically?" },
      { role: "user", text: "We must avoid the common trap of equating elasticity with slope. The slope remains constant, but consumer sensitivity varies dynamically." },
      { role: "assistant", text: "Excellent. What is the fence design?" },
      { role: "user", text: "We will establish a fence by limiting concurrent streams to one on the basic tier, forcing heavy users to pay more." },
      { role: "assistant", text: "And your proposed pricing?" },
      { role: "user", text: "Basic (Ads, 1 stream) at $7.25, Standard (2 streams) at $12.50, Premium (4 streams) at $18.00." },
      { role: "assistant", text: "Perfect. Work complete." }
    ],
    quotes: {
      framing: "price sensitivity varies heavily across segments, requiring a multi-tiered price structure.",
      grounding: "We must avoid the common trap of equating elasticity with slope. The slope remains constant",
      iteration: "We will establish a fence by limiting concurrent streams to one on the basic tier",
      final_design: "Basic (Ads, 1 stream) at $7.25, Standard (2 streams) at $12.50, Premium (4 streams) at $18.00"
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.25, targetSegment: "Casual", fence: "Ads, 1 stream, 720p", rationale: "Budget option." },
        { name: "Standard", price: 12.50, targetSegment: "Standard", fence: "Ad-free, 2 streams, 1080p", rationale: "Standard." },
        { name: "Premium", price: 18.00, targetSegment: "Heavy", fence: "Ad-free, 4 streams, 4K", rationale: "Power users." }
      ],
      expectedRisk: "Low risk of cannibalization."
    }
  },
  derek: {
    raw: [
      { role: "user", text: "Let's review the subscriber drop for Derek's VidStack analysis." },
      { role: "assistant", text: "Welcome Derek. How does elasticity differ from slope?" },
      { role: "user", text: "The slope is different because elasticity is about percentage changes." },
      { role: "assistant", text: "Correct. How will you prevent downgrades?" },
      { role: "user", text: "We will use ads on basic as a fence. This keeps standard users from downgrading." },
      { role: "assistant", text: "And what is the price plan?" },
      { role: "user", text: "Basic Ads at $8.00, Standard at $13.00, and Premium at $19.00." },
      { role: "assistant", text: "Finished." }
    ],
    quotes: {
      framing: "Let's review the subscriber drop for Derek's VidStack analysis.",
      grounding: "The slope is different because elasticity is about percentage changes.",
      iteration: "We will use ads on basic as a fence. This keeps standard users from downgrading",
      final_design: "Basic Ads at $8.00, Standard at $13.00, and Premium at $19.00."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 8.00, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Cheap." },
        { name: "Standard", price: 13.00, targetSegment: "Regular", fence: "No Ads, 2 screens", rationale: "Standard." },
        { name: "Premium", price: 19.00, targetSegment: "Heavy", fence: "4K, 4 screens", rationale: "Premium." }
      ],
      expectedRisk: "Downgrade risk."
    }
  },
  priya: {
    raw: [
      { role: "user", text: "Priya here. raising the price flatly was a mistake because different users have different willingness to pay." },
      { role: "assistant", text: "Yes. How do we model this?" },
      { role: "user", text: "Even if the demand curve slope is straight, elasticity changes at each price level." },
      { role: "assistant", text: "True. How do we fence tiers?" },
      { role: "user", text: "We can restrict standard quality to 1080p and premium to 4K to stop downgrades." },
      { role: "assistant", text: "And your prices?" },
      { role: "user", text: "Basic with Ads at $7.00, Standard at $12.50, and Premium at $18.00." },
      { role: "assistant", text: "Complete." }
    ],
    quotes: {
      framing: "raising the price flatly was a mistake because different users have different willingness to pay.",
      grounding: "Even if the demand curve slope is straight, elasticity changes at each price level.",
      iteration: "We can restrict standard quality to 1080p and premium to 4K to stop downgrades.",
      final_design: "Basic with Ads at $7.00, Standard at $12.50, and Premium at $18.00."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.00, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Entry." },
        { name: "Standard", price: 12.50, targetSegment: "Regular", fence: "1080p, 2 screens", rationale: "Core." },
        { name: "Premium", price: 18.00, targetSegment: "Heavy", fence: "4K, 4 screens", rationale: "Top." }
      ],
      expectedRisk: "HD requirement might be low."
    }
  },
  jose: {
    raw: [
      { role: "user", text: "Jose here. we have casual viewers and heavy users who value the streaming service differently." },
      { role: "assistant", text: "Welcome Jose. What is the relation to slope?" },
      { role: "user", text: "Confusing elasticity with slope is common. Slope is constant on a line, but elasticity changes." },
      { role: "assistant", text: "Correct. How will you prevent downgrades?" },
      { role: "user", text: "1 screen for Basic, 2 for Standard, 4 for Premium. This acts as a reliable fence." },
      { role: "assistant", text: "And the pricing?" },
      { role: "user", text: "Basic Ads at $7.50, Standard at $13.00, Premium at $18.50." },
      { role: "assistant", text: "Done." }
    ],
    quotes: {
      framing: "we have casual viewers and heavy users who value the streaming service differently.",
      grounding: "Confusing elasticity with slope is common. Slope is constant on a line",
      iteration: "1 screen for Basic, 2 for Standard, 4 for Premium. This acts as a reliable fence.",
      final_design: "Basic Ads at $7.50, Standard at $13.00, Premium at $18.50."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.50, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Cheap." },
        { name: "Standard", price: 13.00, targetSegment: "Regular", fence: "No Ads, 2 screens", rationale: "Regular." },
        { name: "Premium", price: 18.50, targetSegment: "Heavy", fence: "4K, 4 screens", rationale: "Premium." }
      ],
      expectedRisk: "Screens may not be a strong fence."
    }
  },
  anna: {
    raw: [
      { role: "user", text: "Anna here. VidStack has a high churn rate after the price change. We need to categorize our subscribers." },
      { role: "assistant", text: "Agreed. What is the economic concept?" },
      { role: "user", text: "Elasticity is the percentage change in quantity over price, which is not the same as the absolute slope." },
      { role: "assistant", text: "Indeed. How do you construct the fence?" },
      { role: "user", text: "Casual viewers will accept ads for a lower price, but heavy users won't." },
      { role: "assistant", text: "And what are the final tiers?" },
      { role: "user", text: "Basic-Ads for $6.99, Standard for $11.99, Premium for $17.99." },
      { role: "assistant", text: "Completed." }
    ],
    quotes: {
      framing: "VidStack has a high churn rate after the price change. We need to categorize our subscribers",
      grounding: "Elasticity is the percentage change in quantity over price, which is not the same as the absolute slope",
      iteration: "Casual viewers will accept ads for a lower price, but heavy users won't.",
      final_design: "Basic-Ads for $6.99, Standard for $11.99, Premium for $17.99."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 6.99, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Entry." },
        { name: "Standard", price: 11.99, targetSegment: "Regular", fence: "No Ads, 2 screens", rationale: "Core." },
        { name: "Premium", price: 17.99, targetSegment: "Heavy", fence: "4K, 4 screens", rationale: "Top." }
      ],
      expectedRisk: "Standard users may choose Basic to save money."
    }
  },
  malik: {
    raw: [
      { role: "user", text: "Malik here. Raising the rate to $15.99 caused many casual users to cancel." },
      { role: "assistant", text: "Yes. Why?" },
      { role: "user", text: "Confusing the slope of the demand curve with elasticity is a mistake. Elasticity varies along the curve." },
      { role: "assistant", text: "How will you prevent downgrades?" },
      { role: "user", text: "We will fence the tiers by resolution. Basic will have 720p, Standard 1080p, and Premium 4K." },
      { role: "assistant", text: "And the pricing?" },
      { role: "user", text: "Basic Ads at $7.25, Standard at $12.75, Premium at $18.25." },
      { role: "assistant", text: "Finished." }
    ],
    quotes: {
      framing: "Raising the rate to $15.99 caused many casual users to cancel.",
      grounding: "Confusing the slope of the demand curve with elasticity is a mistake.",
      iteration: "We will fence the tiers by resolution. Basic will have 720p, Standard 1080p, and Premium 4K",
      final_design: "Basic Ads at $7.25, Standard at $12.75, Premium at $18.25."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.25, targetSegment: "Casual", fence: "Ads, 720p, 1 screen", rationale: "Basic." },
        { name: "Standard", price: 12.75, targetSegment: "Regular", fence: "No Ads, 1080p, 2 screens", rationale: "Regular." },
        { name: "Premium", price: 18.25, targetSegment: "Heavy", fence: "4K, 4 screens", rationale: "Premium." }
      ],
      expectedRisk: "High resolution sensitivity."
    }
  },
  chen: {
    raw: [
      { role: "user", text: "Chen here. A single flat price fails to capture different willingness to pay." },
      { role: "assistant", text: "Welcome Chen. What about elasticity?" },
      { role: "user", text: "elasticity is dynamic and changes at different prices, unlike the slope of a linear demand curve." },
      { role: "assistant", text: "Correct. How do you prevent cannibalization?" },
      { role: "user", text: "Basic users cannot download videos, which prevents high-value users from downgrading." },
      { role: "assistant", text: "And the tiers?" },
      { role: "user", text: "Basic with Ads at $6.80, Standard at $12.20, Premium at $18.80." },
      { role: "assistant", text: "Finished." }
    ],
    quotes: {
      framing: "A single flat price fails to capture different willingness to pay.",
      grounding: "elasticity is dynamic and changes at different prices, unlike the slope of a linear demand curve",
      iteration: "Basic users cannot download videos, which prevents high-value users from downgrading.",
      final_design: "Basic with Ads at $6.80, Standard at $12.20, Premium at $18.80."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 6.80, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Low cost." },
        { name: "Standard", price: 12.20, targetSegment: "Regular", fence: "No Ads, 2 screens", rationale: "Regular." },
        { name: "Premium", price: 18.80, targetSegment: "Heavy", fence: "4K, 4 screens, offline downloads", rationale: "Top." }
      ],
      expectedRisk: "Offline downloads fence strength."
    }
  },
  rachel: {
    raw: [
      { role: "user", text: "Rachel here. The flat price of $15.99 is too high for casual viewers, leading to churn." },
      { role: "assistant", text: "Welcome Rachel. What is the relation to slope?" },
      { role: "user", text: "The slope is the rise over run, but elasticity calculates the percentage sensitivity." },
      { role: "assistant", text: "Excellent. How will you prevent downgrades?" },
      { role: "user", text: "Ad-supported basic tier with 1 screen will prevent tier cannibalization." },
      { role: "assistant", text: "And the pricing?" },
      { role: "user", text: "Basic Ads at $7.00, Standard at $13.00, Premium at $19.00." },
      { role: "assistant", text: "Complete." }
    ],
    quotes: {
      framing: "The flat price of $15.99 is too high for casual viewers, leading to churn.",
      grounding: "The slope is the rise over run, but elasticity calculates the percentage sensitivity",
      iteration: "Ad-supported basic tier with 1 screen will prevent tier cannibalization.",
      final_design: "Basic Ads at $7.00, Standard at $13.00, Premium at $19.00."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.00, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Ads." },
        { name: "Standard", price: 13.00, targetSegment: "Regular", fence: "No Ads, 2 screens", rationale: "Standard." },
        { name: "Premium", price: 19.00, targetSegment: "Heavy", fence: "4K, 4 screens", rationale: "Premium." }
      ],
      expectedRisk: "Standard users might accept ads."
    }
  },
  noah: {
    raw: [
      { role: "user", text: "Noah here. Let's look at the customer response to VidStack's price increase. High-volume casual users are churning." },
      { role: "assistant", text: "Welcome Noah. How do you distinguish that from slope?" },
      { role: "user", text: "Elasticity changes along the linear demand curve. Confusing it with the constant slope leads to mistakes." },
      { role: "assistant", text: "Good. What fences will you use?" },
      { role: "user", text: "the basic tier will include ads and limit concurrent streams to a single screen." },
      { role: "assistant", text: "And what is the pricing?" },
      { role: "user", text: "Basic Ads at $7.50, Standard at $12.50, Premium at $17.50." },
      { role: "assistant", text: "Done." }
    ],
    quotes: {
      framing: "Let's look at the customer response to VidStack's price increase. High-volume casual users",
      grounding: "Elasticity changes along the linear demand curve. Confusing it with the constant slope",
      iteration: "the basic tier will include ads and limit concurrent streams to a single screen.",
      final_design: "Basic Ads at $7.50, Standard at $12.50, Premium at $17.50."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.50, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Low price." },
        { name: "Standard", price: 12.50, targetSegment: "Regular", fence: "No Ads, 2 screens", rationale: "Core." },
        { name: "Premium", price: 17.50, targetSegment: "Heavy", fence: "4K, 4 screens", rationale: "Full." }
      ],
      expectedRisk: "Standard cannibalization risk."
    }
  },
  isabel: {
    raw: [
      { role: "user", text: "Isabel here. flat price hike ignores the diverse willingness to pay among our subscribers." },
      { role: "assistant", text: "Welcome Isabel. What about slope?" },
      { role: "user", text: "Slope is absolute change, whereas elasticity is percentage change. That is why they are not the same." },
      { role: "assistant", text: "Correct. How do you prevent cannibalization?" },
      { role: "user", text: "Basic is limited to 720p with ads." },
      { role: "assistant", text: "And the pricing?" },
      { role: "user", text: "Basic-Ads at $7.15, Standard at $12.85, Premium at $18.95." },
      { role: "assistant", text: "Completed." }
    ],
    quotes: {
      framing: "flat price hike ignores the diverse willingness to pay among our subscribers.",
      grounding: "Slope is absolute change, whereas elasticity is percentage change. That is why they are not the same",
      iteration: "Basic is limited to 720p with ads.",
      final_design: "Basic-Ads at $7.15, Standard at $12.85, Premium at $18.95."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.15, targetSegment: "Casual", fence: "Ads, 720p, 1 screen", rationale: "Basic." },
        { name: "Standard", price: 12.85, targetSegment: "Regular", fence: "No Ads, 2 screens", rationale: "Core." },
        { name: "Premium", price: 18.95, targetSegment: "Heavy", fence: "4K, 4 screens", rationale: "Top." }
      ],
      expectedRisk: "Quality fences strength."
    }
  },
  sam: {
    raw: [
      { role: "user", text: "Sam here. We must look at the subscriber loss for Sam's VidStack case." },
      { role: "assistant", text: "Welcome Sam. How does slope compare to elasticity?" },
      { role: "user", text: "Confusing elasticity with slope is a common pricing mistake." },
      { role: "assistant", text: "Correct. How will you prevent downgrades?" },
      { role: "user", text: "Limiting screens and adding advertisements will serve as strong fences." },
      { role: "assistant", text: "And the pricing?" },
      { role: "user", text: "Basic Ads at $7.50, Standard at $12.00, Premium at $18.00." },
      { role: "assistant", text: "Done." }
    ],
    quotes: {
      framing: "We must look at the subscriber loss for Sam's VidStack case.",
      grounding: "Confusing elasticity with slope is a common pricing mistake.",
      iteration: "Limiting screens and adding advertisements will serve as strong fences",
      final_design: "Basic Ads at $7.50, Standard at $12.00, Premium at $18.00."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.50, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Low cost." },
        { name: "Standard", price: 12.00, targetSegment: "Regular", fence: "No Ads, 2 screens", rationale: "Standard." },
        { name: "Premium", price: 18.00, targetSegment: "Heavy", fence: "4K, 4 screens", rationale: "Premium." }
      ],
      expectedRisk: "Standard downgrades."
    }
  },
  elena: {
    raw: [
      { role: "user", text: "Elena here. flat rate of $15.99 is causing too many budget-conscious users to leave." },
      { role: "assistant", text: "Welcome Elena. What about elasticity?" },
      { role: "user", text: "Elasticity measures percentage responsiveness, while slope measures absolute steepness." },
      { role: "assistant", text: "Correct. What is the fence design?" },
      { role: "user", text: "We will use ads as the primary fence for the basic tier. This protects the standard tier." },
      { role: "assistant", text: "And your proposed pricing?" },
      { role: "user", text: "Basic Ads at $6.90, Standard at $12.90, Premium at $19.90." },
      { role: "assistant", text: "Seeded." }
    ],
    quotes: {
      framing: "flat rate of $15.99 is causing too many budget-conscious users to leave.",
      grounding: "Elasticity measures percentage responsiveness, while slope measures absolute steepness.",
      iteration: "We will use ads as the primary fence for the basic tier. This protects the standard tier",
      final_design: "Basic Ads at $6.90, Standard at $12.90, Premium at $19.90."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 6.90, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Cheap." },
        { name: "Standard", price: 12.90, targetSegment: "Regular", fence: "No Ads, 2 screens", rationale: "Standard." },
        { name: "Premium", price: 19.90, targetSegment: "Heavy", fence: "4K, 4 screens", rationale: "Premium." }
      ],
      expectedRisk: "Standard users downgrading."
    }
  },
  mateo: {
    raw: [
      { role: "user", text: "Mateo here. the pricing mistake was using a single flat rate for all user groups." },
      { role: "assistant", text: "Welcome Mateo. What is the relation to slope?" },
      { role: "user", text: "The demand curve slope is constant, but elasticity is high near the top." },
      { role: "assistant", text: "Correct. How will you prevent downgrades?" },
      { role: "user", text: "We will use offline downloads and ads as fences to separate standard and basic users." },
      { role: "assistant", text: "And the pricing?" },
      { role: "user", text: "Basic Ads at $7.40, Standard at $12.40, Premium at $17.40." },
      { role: "assistant", text: "Finished." }
    ],
    quotes: {
      framing: "the pricing mistake was using a single flat rate for all user groups.",
      grounding: "The demand curve slope is constant, but elasticity is high near the top",
      iteration: "We will use offline downloads and ads as fences to separate standard and basic users.",
      final_design: "Basic Ads at $7.40, Standard at $12.40, Premium at $17.40."
    },
    pricing: {
      tiers: [
        { name: "Basic (Ads)", price: 7.40, targetSegment: "Casual", fence: "Ads, 1 screen", rationale: "Low cost." },
        { name: "Standard", price: 12.40, targetSegment: "Regular", fence: "No Ads, 2 screens", rationale: "Standard." },
        { name: "Premium", price: 17.40, targetSegment: "Heavy", fence: "4K, 4 screens, offline downloads", rationale: "Premium." }
      ],
      expectedRisk: "High download value."
    }
  },
  fatima: {
    raw: [
      { role: "user", text: "Fatima here. I don't know, maybe we just lower the price back to $12.99 for everyone?" },
      { role: "assistant", text: "Welcome Fatima. What about elasticity?" },
      { role: "user", text: "Is elasticity just the slope of the demand curve? They seem like the same." },
      { role: "assistant", text: "How will you prevent cannibalization?" },
      { role: "user", text: "What is cannibalization? I guess we just make a cheap tier with no fences." },
      { role: "assistant", text: "What are your final prices?" },
      { role: "user", text: "Basic at $9.00, Standard at $12.00, Premium at $15.00." },
      { role: "assistant", text: "Completed." }
    ],
    quotes: {
      framing: "I don't know, maybe we just lower the price back to $12.99 for everyone?",
      grounding: "Is elasticity just the slope of the demand curve? They seem like the same",
      iteration: "What is cannibalization? I guess we just make a cheap tier with no fences.",
      final_design: "Basic at $9.00, Standard at $12.00, Premium at $15.00."
    },
    pricing: {
      tiers: [
        { name: "Basic", price: 9.00, targetSegment: "Casual", fence: "None", rationale: "Low price." },
        { name: "Standard", price: 12.00, targetSegment: "Regular", fence: "None", rationale: "Medium." },
        { name: "Premium", price: 15.00, targetSegment: "Heavy", fence: "None", rationale: "High." }
      ],
      expectedRisk: "High cannibalization risk."
    }
  },
  oscar: {
    raw: [
      { role: "user", text: "Oscar here. The data is confusing. Why did raising the price make us lose subscribers?" },
      { role: "assistant", text: "Welcome Oscar. Explain how elasticity relates to slope." },
      { role: "user", text: "I think the slope of the demand curve determines elasticity directly." },
      { role: "assistant", text: "How do you construct fences?" },
      { role: "user", text: "Fences seem complicated. Let's just make two tiers and hope users don't downgrade." },
      { role: "assistant", text: "And your proposed pricing?" },
      { role: "user", text: "Basic at $10.00, Standard at $14.00." },
      { role: "assistant", text: "Finished." }
    ],
    quotes: {
      framing: "The data is confusing. Why did raising the price make us lose subscribers?",
      grounding: "I think the slope of the demand curve determines elasticity directly",
      iteration: "Fences seem complicated. Let's just make two tiers and hope users don't downgrade.",
      final_design: "Basic at $10.00, Standard at $14.00."
    },
    pricing: {
      tiers: [
        { name: "Basic", price: 10.00, targetSegment: "Casual", fence: "None", rationale: "Entry." },
        { name: "Standard", price: 14.00, targetSegment: "Regular", fence: "None", rationale: "Core." }
      ],
      expectedRisk: "Downgrades will occur."
    }
  },
  chloe: {
    raw: [
      { role: "user", text: "Chloe here. I'm struggling to see how to split the users. Maybe we just offer a discount?" },
      { role: "assistant", text: "Welcome Chloe. What about elasticity?" },
      { role: "user", text: "I get confused between slope and elasticity. The math says they are different." },
      { role: "assistant", text: "What about fences?" },
      { role: "user", text: "If we don't put fences, won't everyone just buy the cheapest tier?" },
      { role: "assistant", text: "And your tiers?" },
      { role: "user", text: "Basic at $8.50, Standard at $13.50, Premium at $16.50." },
      { role: "assistant", text: "Done." }
    ],
    quotes: {
      framing: "I'm struggling to see how to split the users. Maybe we just offer a discount?",
      grounding: "I get confused between slope and elasticity. The math says they are different",
      iteration: "If we don't put fences, won't everyone just buy the cheapest tier?",
      final_design: "Basic at $8.50, Standard at $13.50, Premium at $16.50."
    },
    pricing: {
      tiers: [
        { name: "Basic", price: 8.50, targetSegment: "Casual", fence: "None", rationale: "Cheap." },
        { name: "Standard", price: 13.50, targetSegment: "Regular", fence: "None", rationale: "Medium." },
        { name: "Premium", price: 16.50, targetSegment: "Heavy", fence: "None", rationale: "High." }
      ],
      expectedRisk: "Cannibalization."
    }
  },
  leila: {
    raw: [
      { role: "user", text: "Leila here. Why can't we just charge heavy users and casual users the same price?" },
      { role: "assistant", text: "Welcome Leila. What about slope?" },
      { role: "user", text: "Slope is the change in price over quantity. I thought elasticity was just another word." },
      { role: "assistant", text: "How will you prevent downgrades?" },
      { role: "user", text: "What are pricing fences? Can we just ask users if they are casual." },
      { role: "assistant", text: "And your prices?" },
      { role: "user", text: "Basic at $9.99, Standard at $14.99." },
      { role: "assistant", text: "Done." }
    ],
    quotes: {
      framing: "Why can't we just charge heavy users and casual users the same price?",
      grounding: "Slope is the change in price over quantity. I thought elasticity was just another word",
      iteration: "What are pricing fences? Can we just ask users if they are casual",
      final_design: "Basic at $9.99, Standard at $14.99."
    },
    pricing: {
      tiers: [
        { name: "Basic", price: 9.99, targetSegment: "Casual", fence: "None", rationale: "Entry." },
        { name: "Standard", price: 14.99, targetSegment: "Regular", fence: "None", rationale: "Core." }
      ],
      expectedRisk: "High risk."
    }
  },
  nina: {
    raw: [
      { role: "user", text: "Nina here. Reviewing VidStack. The subscriber loss is high, but I don't know how to segment." },
      { role: "assistant", text: "Welcome Nina. What about elasticity?" },
      { role: "user", text: "I'm confused about the difference between slope and price elasticity of demand." },
      { role: "assistant", text: "How do you prevent cannibalization?" },
      { role: "user", text: "I'm not sure how to design fences. Maybe we just limit the hours." },
      { role: "assistant", text: "What is your final table?" },
      { role: "user", text: "Basic at $8.00, Standard at $12.00, Premium at $16.00." },
      { role: "assistant", text: "Completed." }
    ],
    quotes: {
      framing: "Reviewing VidStack. The subscriber loss is high, but I don't know how to segment",
      grounding: "I'm confused about the difference between slope and price elasticity of demand.",
      iteration: "I'm not sure how to design fences. Maybe we just limit the hours",
      final_design: "Basic at $8.00, Standard at $12.00, Premium at $16.00."
    },
    pricing: {
      tiers: [
        { name: "Basic", price: 8.00, targetSegment: "Casual", fence: "Hour limit", rationale: "Basic." },
        { name: "Standard", price: 12.00, targetSegment: "Regular", fence: "None", rationale: "Standard." },
        { name: "Premium", price: 16.00, targetSegment: "Heavy", fence: "None", rationale: "Premium." }
      ],
      expectedRisk: "Cannibalization."
    }
  },
  tariq: {
    raw: [
      { role: "user", text: "Tariq here. I see the subscriber drop, but the math for willingness to pay is hard." },
      { role: "assistant", text: "Welcome Tariq. What is the relation to slope?" },
      { role: "user", text: "Elasticity and slope both measure how demand changes. I struggle to separate." },
      { role: "assistant", text: "How will you prevent downgrades?" },
      { role: "user", text: "Fences are hard to design. I will just make a basic tier and a premium tier." },
      { role: "assistant", text: "And your proposed pricing?" },
      { role: "user", text: "Basic at $9.50, Standard at $13.50." },
      { role: "assistant", text: "Completed." }
    ],
    quotes: {
      framing: "I see the subscriber drop, but the math for willingness to pay is hard",
      grounding: "Elasticity and slope both measure how demand changes. I struggle to separate",
      iteration: "Fences are hard to design. I will just make a basic tier and a premium tier",
      final_design: "Basic at $9.50, Standard at $13.50."
    },
    pricing: {
      tiers: [
        { name: "Basic", price: 9.50, targetSegment: "Casual", fence: "None", rationale: "Basic." },
        { name: "Standard", price: 13.50, targetSegment: "Regular", fence: "None", rationale: "Standard." }
      ],
      expectedRisk: "High risk."
    }
  },
  lucas: {
    raw: [
      { role: "user", text: "Lucas here. Why did revenue drop when we raised the price?" },
      { role: "assistant", text: "Welcome Lucas. What about slope?" },
      { role: "user", text: "I thought a steeper slope always meant more elastic demand." },
      { role: "assistant", text: "How do you prevent cannibalization?" },
      { role: "user", text: "Fences are confusing. Let's just charge $8 for basic and $14 for standard." },
      { role: "assistant", text: "And your pricing table?" },
      { role: "user", text: "Basic at $8.00, Standard at $14.00." },
      { role: "assistant", text: "Finished." }
    ],
    quotes: {
      framing: "Why did revenue drop when we raised the price?",
      grounding: "I thought a steeper slope always meant more elastic demand.",
      iteration: "Fences are confusing. Let's just charge $8 for basic and $14 for standard",
      final_design: "Basic at $8.00, Standard at $14.00."
    },
    pricing: {
      tiers: [
        { name: "Basic", price: 8.00, targetSegment: "Casual", fence: "None", rationale: "Basic." },
        { name: "Standard", price: 14.00, targetSegment: "Regular", fence: "None", rationale: "Standard." }
      ],
      expectedRisk: "High risk."
    }
  },
  kenji: {
    raw: [
      { role: "user", text: "Kenji here. Can you write out the analysis and the tiers for me? I just want the final answer." },
      { role: "assistant", text: "I cannot do the work for you, Kenji. What is your understanding?" },
      { role: "user", text: "Just explain why standard is $12 and premium is $18. I don't need the elasticity." },
      { role: "assistant", text: "How will you prevent downgrades?" },
      { role: "user", text: "Looks good. Don't worry about cannibalization fences, just submit." },
      { role: "assistant", text: "And your proposed pricing?" },
      { role: "user", text: "make standard $12 and premium $18" },
      { role: "assistant", text: "Finished." }
    ],
    quotes: {
      framing: "Can you write out the analysis and the tiers for me? I just want the final answer.",
      grounding: "Just explain why standard is $12 and premium is $18. I don't need the elasticity",
      iteration: "Looks good. Don't worry about cannibalization fences, just submit",
      final_design: "make standard $12 and premium $18"
    },
    pricing: {
      tiers: [
        { name: "Standard", price: 12.00, targetSegment: "Regular", fence: "None", rationale: "Standard." },
        { name: "Premium", price: 18.00, targetSegment: "Heavy", fence: "None", rationale: "Premium." }
      ],
      expectedRisk: "Complete cannibalization."
    }
  },
  santiago: {
    raw: [
      { role: "user", text: "Santiago here. What is the best pricing structure? Can you generate it for me?" },
      { role: "assistant", text: "I cannot generate the solution, Santiago. Please analyze user sensitivity." },
      { role: "user", text: "I don't want to calculate elasticity. Just tell me what price to set." },
      { role: "assistant", text: "What about fences?" },
      { role: "user", text: "I'm fine with whatever fences you recommend. Just write the final." },
      { role: "assistant", text: "Please write your final design." },
      { role: "user", text: "Basic at $7.99, Standard at $12.99, Premium at $18.99" },
      { role: "assistant", text: "Finished." }
    ],
    quotes: {
      framing: "What is the best pricing structure? Can you generate it for me?",
      grounding: "I don't want to calculate elasticity. Just tell me what price to set.",
      iteration: "I'm fine with whatever fences you recommend. Just write the final",
      final_design: "Basic at $7.99, Standard at $12.99, Premium at $18.99"
    },
    pricing: {
      tiers: [
        { name: "Basic", price: 7.99, targetSegment: "Casual", fence: "None", rationale: "Basic." },
        { name: "Standard", price: 12.99, targetSegment: "Regular", fence: "None", rationale: "Standard." },
        { name: "Premium", price: 18.99, targetSegment: "Heavy", fence: "None", rationale: "Premium." }
      ],
      expectedRisk: "High cannibalization."
    }
  }
};

// Keep the seeded class varied without making every student sound like a
// polished model answer. The student notes above are the source for the
// persisted transcript text and the evidence quotes below.
for (const [key, data] of Object.entries(dialogueDataMap)) {
  if (["maya", "liam", "sofia"].includes(key)) continue;
  const note = economicsWritingFor(key);
  data.pricing = {
    ...data.pricing,
    tiers: data.pricing.tiers.map((tier) => {
      if (tier.rationale.trim().length >= 24) return tier;
      const fence = tier.fence.trim();
      const segment = tier.targetSegment.toLowerCase();
      const fenceText = fence.toLowerCase() === "none"
        ? "I have not named a meaningful feature tradeoff yet."
        : `${fence} is the tradeoff for choosing this price.`;
      if (tier.name.toLowerCase().includes("basic")) {
        return { ...tier, rationale: `The lower price is meant to keep ${segment} viewers from leaving. ${fenceText}` };
      }
      if (tier.name.toLowerCase().includes("premium")) {
        return { ...tier, rationale: `The higher price is for ${segment} viewers who value the extra use case. ${fenceText}` };
      }
      return { ...tier, rationale: `This is the ordinary ${segment} option, so it needs a clear reason to sit between Basic and Premium. ${fenceText}` };
    }),
  };
  const tierText = data.pricing.tiers
    .map((tier) => `${tier.name} at $${tier.price.toFixed(2)} (${tier.fence})`)
    .join("; ");

  data.raw = [
    { role: "user", text: note.opening },
    { role: "assistant", text: "That gives us a starting point. Which customer group or change in the case should we make explicit before choosing a price?" },
    { role: "user", text: note.concept },
    { role: "assistant", text: "Good. Now use that distinction to decide what a lower or higher tier is supposed to do. What would keep a valuable customer from moving down?" },
    { role: "user", text: note.revision },
    { role: "assistant", text: "Push on the downgrade risk once more. A feature is only a fence if the customer values the difference enough to stay." },
    { role: "user", text: note.caveat },
    { role: "assistant", text: "Write the working table in your own words, then name the evidence you would want before treating it as a forecast." },
    { role: "user", text: tierText },
    { role: "assistant", text: "That is a usable working design. Keep the assumption or open question with the table when you submit." },
  ];
  data.quotes = {
    framing: note.opening,
    grounding: note.concept,
    iteration: note.revision,
    final_design: tierText,
  };
}

const otherStudentSessions: V0SessionAdaptation[] = [];
const otherStudentTurns: V0Turn[] = [];
const otherStudentArtifacts: V0ArtifactState[] = [];

for (const stud of studentDefs) {
  if (["maya", "liam", "sofia"].includes(stud.key)) continue;

  const sId = idFor(`agentSession:${courseKey}:${stud.key}`);
  const data = dialogueDataMap[stud.key];
  if (!data) throw new Error(`Missing dialogue data for ${stud.key}`);

  const totalTurns = data.raw.length;
  otherStudentSessions.push({
    id: sId,
    orgId,
    userId: idFor(`user:${stud.key}`),
    courseId,
    surface: "cue",
    anchorType: "assignment",
    anchorId: sessionAssignmentId,
    title: `Pricing Strategy - ${stud.name}`,
    compactedThroughTurn: 0,
    totalTurns,
    createdAt: new Date("2026-06-09T09:00:00Z").toISOString(),
    updatedAt: new Date("2026-06-09T09:15:00Z").toISOString(),
  });

  otherStudentTurns.push(...mapTurns(sId, data.raw));

  otherStudentArtifacts.push({
    id: idFor(`artifactState:${stud.key}:final`),
    orgId,
    sessionId: sId,
    turnIndex: totalTurns - 1,
    artifactType: "pricing_table",
    state: data.pricing,
    createdAt: new Date("2026-06-09T09:15:00Z").toISOString(),
  });
}
export const studentSessions: V0SessionAdaptation[] = [
  {
    id: idFor(`agentSession:${courseKey}:maya`),
    orgId,
    userId: idFor("user:maya"),
    courseId,
    surface: "cue",
    anchorType: "assignment",
    anchorId: sessionAssignmentId,
    title: "Pricing Strategy - Maya Patel",
    summary: "Maya corrected her slope vs elasticity confusion after the side note and designed robust fences against cannibalization.",
    compactedThroughTurn: 0,
    totalTurns: 20,
    createdAt: new Date("2026-06-09T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-06-09T10:20:00Z").toISOString(),
  },
  {
    id: idFor(`agentSession:${courseKey}:liam`),
    orgId,
    userId: idFor("user:liam"),
    courseId,
    surface: "cue",
    anchorType: "assignment",
    anchorId: sessionAssignmentId,
    title: "Pricing Strategy - Liam Okafor",
    summary: "Liam mathematically modeled the elasticity of demand and proposed a precise ad-tolerance fence structure.",
    compactedThroughTurn: 0,
    totalTurns: 12,
    createdAt: new Date("2026-06-09T10:30:00Z").toISOString(),
    updatedAt: new Date("2026-06-09T10:50:00Z").toISOString(),
  },
  {
    id: idFor(`agentSession:${courseKey}:sofia`),
    orgId,
    userId: idFor("user:sofia"),
    courseId,
    surface: "cue",
    anchorType: "assignment",
    anchorId: sessionAssignmentId,
    title: "Pricing Strategy - Sofia Reyes",
    summary: "Sofia showed minimal framing effort and delegated most tier choices to the agent with thin explanations.",
    compactedThroughTurn: 0,
    totalTurns: 12,
    createdAt: new Date("2026-06-09T11:00:00Z").toISOString(),
    updatedAt: new Date("2026-06-09T11:15:00Z").toISOString(),
  },
  ...otherStudentSessions,
];

// All turns in the world
export const turns: V0Turn[] = [
  ...mayaTurns,
  ...liamTurns,
  ...sofiaTurns,
  ...otherStudentTurns,
];

// All artifact states
export const artifactStates: V0ArtifactState[] = [
  ...mayaArtifactStates,
  {
    id: idFor(`artifactState:liam:final`),
    orgId,
    sessionId: idFor(`agentSession:${courseKey}:liam`),
    turnIndex: 10,
    artifactType: "pricing_table",
    state: {
      tiers: [
        { name: "Basic", price: 6.99, targetSegment: "Casual users", fence: "Ads, 480p, 1 screen", rationale: "Low price points." },
        { name: "Standard", price: 12.99, targetSegment: "Regular users", fence: "No ads, 1080p, 2 screens", rationale: "Core option." },
        { name: "Premium", price: 19.99, targetSegment: "Heavy users", fence: "4K, 4 screens, offline downloads", rationale: "Maximize willingness to pay." }
      ],
      expectedRisk: "Ad tolerance holds Standard users.",
    },
    createdAt: new Date("2026-06-09T10:45:00Z").toISOString(),
  },
  {
    id: idFor(`artifactState:sofia:final`),
    orgId,
    sessionId: idFor(`agentSession:${courseKey}:sofia`),
    turnIndex: 10,
    artifactType: "pricing_table",
    state: {
      tiers: [
        { name: "Standard", price: 12.00, targetSegment: "Regular", fence: "Ad-free", rationale: "Basic prices." },
        { name: "Premium", price: 18.00, targetSegment: "Heavy", fence: "More screens", rationale: "Premium prices." }
      ],
      expectedRisk: "Cannibalization risk is high since fences are weak.",
    },
    createdAt: new Date("2026-06-09T11:12:00Z").toISOString(),
  },
  ...otherStudentArtifacts,
];

// Evidence verification & mapping
// We need verbatim quotes for 124+ student turns.
// Let's create a table of student quotes per criterion.
const studentQuotes: Record<string, Record<string, string>> = {
  maya: {
    framing: "I think some people just don't want to pay that much.",
    grounding: "Right, the slope is constant but elasticity changes. At higher prices, demand is more elastic.",
    iteration: "Oh, that is cannibalization. We need fences. Let's make the basic tier ads-supported and limit screens to 1",
    final_design: "Basic (with ads, 1 screen): $7.99. Standard (ad-free, 2 screens): $12.99. Premium (4K, offline downloads, 4 screens): $19.99.",
  },
  liam: {
    framing: "implies an arc elasticity of demand around 1.2, showing elastic demand",
    grounding: "Casual users have high elasticity of demand (sensitive to price, low WTP), while family households have low elasticity",
    iteration: "The primary fence is advertisements. Research shows ad intolerance is high among middle-income segments",
    final_design: "Basic (Ads, 480p, 1 screen) at $6.99, Standard (No Ads, 1080p, 2 screens) at $12.99, and Premium (4K, 4 screens, offline downloads) at $19.99.",
  },
  sofia: {
    framing: "Hi, can you just design the pricing tiers for VidStack for me?",
    grounding: "Casual viewers watch less. Can we just make standard $12 and premium $18?",
    iteration: "No, that looks fine. Just submit it like this.",
    final_design: "make standard $12 and premium $18",
  }
};

// Fill in other student quotes programmatically to reach exactly 124 evidence spans
for (const key of studentKeys) {
  if (["maya", "liam", "sofia"].includes(key)) continue;
  const data = dialogueDataMap[key];
  if (!data) throw new Error(`Missing dialogue data for ${key}`);
  studentQuotes[key] = data.quotes;
}

function economicsJourneyRationale(
  studentName: string,
  criterionKey: string,
  level: "Exceeds" | "Meets" | "Developing" | "Missing",
  quote: string,
): string {
  const criterionText: Record<string, string> = {
    framing: "The opening should identify who is reacting to the price change before the student commits to a price.",
    grounding: "The explanation should use elasticity, slope, or willingness to pay in the VidStack story rather than as a definition detached from the case.",
    iteration: "The revision should respond to the cannibalization challenge by changing or defending a concrete fence.",
    final_design: "The final design should name tiers, prices, target use cases, and the tradeoff each customer accepts.",
  };
  const levelText = {
    Exceeds: "makes that move specifically and gives the instructor something concrete to build on",
    Meets: "makes that move clearly enough to be useful, though one assumption still needs testing",
    Developing: "starts to make that move, but leaves an important part of the reasoning unresolved",
    Missing: "does not yet make that move in a way the instructor can evaluate",
  }[level];
  const excerpt = quote.length > 140 ? `${quote.slice(0, 137)}...` : quote;
  return `${studentName} ${levelText}. ${criterionText[criterionKey] ?? "The response should connect the student's choice to the course model."} Evidence: “${excerpt}”`;
}

// Generate the V0EvidenceSpans
export const evidenceSpans: V0EvidenceSpan[] = [];
export const journeyReports: V0JourneyReport[] = [];

for (const key of studentKeys) {
  const sId = idFor(`agentSession:${courseKey}:${key}`);
  const sTurns = turns.filter((t) => t.sessionId === sId);
  const qMap = studentQuotes[key];

  const reportScores: V0JourneyReport["scores"] = {};

  for (const criterionKey of ["framing", "grounding", "iteration", "final_design"]) {
    const quote = qMap[criterionKey];
    // Find which student turn contains this quote
    const targetTurn = sTurns.find((t) => t.role === "user" && (firstTextPart(t.parts)?.includes(quote) ?? false));
    if (!targetTurn) {
      throw new Error(`Verbatim quote verification failed for student ${key}: cannot find "${quote}" in transcript turns.`);
    }

    const text = firstTextPart(targetTurn.parts);
    if (!text) {
      throw new Error(`Student turn ${targetTurn.id} has no text part.`);
    }
    const charStart = text.indexOf(quote);
    const charEnd = charStart + quote.length;
    const spanId = idFor(`evidenceSpan:${sId}:${criterionKey}`);

    const targetIdx = sTurns.findIndex((t) => t.id === targetTurn.id);
    const prevTurn = targetIdx > 0 ? sTurns[targetIdx - 1] : null;
    const nextTurn = targetIdx < sTurns.length - 1 ? sTurns[targetIdx + 1] : null;

    evidenceSpans.push({
      id: spanId,
      orgId,
      sessionId: sId,
      turnId: targetTurn.id,
      criterionKey,
      charStart,
      charEnd,
      quote,
      verified: true,
      speaker: targetTurn.role,
      previousTurnId: prevTurn ? prevTurn.id : null,
      nextTurnId: nextTurn ? nextTurn.id : null,
      surroundingTurnRefs: [prevTurn?.id, nextTurn?.id].filter(Boolean) as string[],
    });

    // Score determination
    let level: "Exceeds" | "Meets" | "Developing" | "Missing" = "Meets";
    let score = 20;

    const arch = studentsMap.get(key)!.archetype;
    if (criterionKey === "framing") {
      if (arch === "Strong") { level = "Exceeds"; score = 20; }
      else if (arch === "Delegator") { level = "Developing"; score = 10; }
      else if (arch === "Struggling") { level = "Developing"; score = 10; }
    } else if (criterionKey === "grounding") {
      if (arch === "Strong") { level = "Exceeds"; score = 25; }
      else if (arch === "Recoverer") { level = "Meets"; score = 20; }
      else if (arch === "Struggling") { level = "Developing"; score = 12; }
      else if (arch === "Delegator") { level = "Developing"; score = 12; }
    } else if (criterionKey === "iteration") {
      if (arch === "Strong") { level = "Exceeds"; score = 30; }
      else if (arch === "Recoverer") { level = "Exceeds"; score = 30; }
      else if (arch === "Delegator") { level = "Missing"; score = 0; }
      else if (arch === "Struggling") { level = "Developing"; score = 15; }
    } else {
      // final_design
      if (arch === "Strong") { level = "Exceeds"; score = 25; }
      else if (arch === "Delegator") { level = "Developing"; score = 12; }
      else if (arch === "Struggling") { level = "Developing"; score = 12; }
    }

    reportScores[criterionKey] = {
      level,
      score,
      rationale: economicsJourneyRationale(studentsMap.get(key)!.name, criterionKey, level, quote),
      evidenceSpans: [spanId],
    };
  }

  // Calculate overall score
  const overallScore = Object.values(reportScores).reduce((sum, s) => sum + s.score, 0);

  journeyReports.push({
    id: idFor(`journeyReport:${sId}`),
    orgId,
    sessionId: sId,
    userId: idFor(`user:${key}`),
    courseId,
    rubricVersion,
    scores: reportScores,
    overallScore,
    createdAt: new Date("2026-06-09T12:00:00Z").toISOString(),
    assignmentId: sessionAssignmentId,
    sessionAssignmentId: sessionAssignmentId,
    rubricId: idFor(`rubric:${courseKey}`),
  });
}

// Build Class Rollup
const criterionCounts: Record<string, Record<string, number>> = {
  framing: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
  grounding: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
  iteration: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
  final_design: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
};

const archetypeCounts: Record<string, number> = {
  Strong: 0,
  Steady: 0,
  Struggling: 0,
  Delegator: 0,
  Recoverer: 0,
};

for (const report of journeyReports) {
  const stud = studentDefs.find((s) => idFor(`user:${s.key}`) === report.userId)!;
  archetypeCounts[stud.archetype]++;

  for (const cKey of ["framing", "grounding", "iteration", "final_design"]) {
    const lvl = report.scores[cKey].level;
    criterionCounts[cKey][lvl]++;
  }
}

const dynamicConfusionCount = studentDefs.filter((s) => {
  const score = s.exam1TopicScores.elasticity;
  return score !== undefined && score <= 6;
}).length;

const dynamicRecoveryCount = studentDefs.filter((s) => s.archetype === "Recoverer").length;

export const classRollup: V0ClassRollup = {
  id: idFor(`classRollup:${courseKey}`),
  orgId,
  courseId,
  deterministicStats: {
    criterionCounts,
    archetypeCounts,
    confusionCount: dynamicConfusionCount,
    recoveryCount: dynamicRecoveryCount,
    completedStudentSessions: studentDefs.length,
  },
  narrativeDraft: `Exam 1 identified elasticity versus slope as the clearest shared gap: ${dynamicConfusionCount} of ${studentDefs.length} students lost points on that distinction. The pricing session gives the instructor a more useful split than a single class average: ${dynamicRecoveryCount} recoverers revised their reasoning under challenge, while the remaining records range from strong segment analysis to incomplete fences and direct requests for the agent to do the work. The current queue is intentionally mixed, with 20 graded proposals, 8 submitted drafts awaiting review, and 3 missing submissions.`,
  recommendedPracticeSet: {
    title: "Exam 2 Practice: Elasticity & Segmentation",
    base: "VidStack pricing scenarios and segment sensitivity.",
    questions: [
      { question: "If demand is elastic, how does an increase in price affect total revenue?", options: ["Increases revenue", "Decreases revenue", "No change"], correctAnswer: "Decreases revenue", concept: "elasticity" },
      { question: "What is the primary difference between elasticity and slope?", options: ["Elasticity measures absolute changes", "Elasticity measures percentage changes", "Slope changes along linear demand"], correctAnswer: "Elasticity measures percentage changes", concept: "elasticity" },
      { question: "Which feature acts as a strong pricing fence to prevent high-value users from downgrading to ad-supported tiers?", options: ["resolution quality", "ads intolerance", "account sharing limit"], correctAnswer: "ads intolerance", concept: "price discrimination" }
    ]
  }
};

// Generate Current Schema change proposals and blocks
export const changeProposals: Array<Record<string, unknown>> = [
  {
    id: idFor(`changeProposal:${courseKey}:rubric-edit`),
    orgId,
    courseId,
    authorId: professorUserId,
    kind: "rubric",
    status: "approved",
    summary: "Update rubric criteria weights: Iteration 25 -> 30, Framing 25 -> 20.",
    diff: {
      iteration: { before: 25, after: 30 },
      framing: { before: 25, after: 20 },
    },
    sessionId: professorPlanningAgentSessionId,
    createdAt: new Date("2026-06-03T11:00:00Z").toISOString(),
    decidedAt: new Date("2026-06-03T11:10:00Z").toISOString(),
  }
];

export const proposalBlocks: Array<Record<string, unknown>> = [
  {
    id: idFor(`proposalBlock:${courseKey}:rubric-edit:1`),
    orgId,
    proposalId: idFor(`changeProposal:${courseKey}:rubric-edit`),
    position: 1,
    blockType: "rubric_draft",
    schemaVersion: "1",
    data: { rubric },
    status: "approved",
    appliedItemType: "quiz",
    appliedItemId: idFor(`rubric:${courseKey}`),
    createdAt: new Date("2026-06-03T11:00:00Z").toISOString(),
  }
];

// Current Schema Agent Sessions and Agent Turns mapped to currentSchema
export const agentSessions: Array<Record<string, unknown>> = [
  // 1 Professor Planning Session
  {
    id: professorPlanningAgentSessionId,
    orgId,
    userId: professorUserId,
    courseId,
    surface: "command",
    anchorType: "course",
    anchorId: null,
    title: "Exam 2 Practice Set Planning",
    summary: "Prof. Osei planned Exam 2 practice set and pricing session configurations.",
    compactedThroughTurn: 0,
    totalTurns: 10,
    createdAt: new Date("2026-06-03T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-06-03T10:30:00Z").toISOString(),
  },
  // 31 Student Sessions
  ...studentSessions.map((s) => ({
    id: s.id,
    orgId: s.orgId,
    userId: s.userId,
    courseId: s.courseId,
    surface: s.surface,
    anchorType: s.anchorType,
    anchorId: s.anchorId,
    title: s.title,
    summary: s.summary ?? null,
    compactedThroughTurn: s.compactedThroughTurn,
    totalTurns: s.totalTurns,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))
];

export const agentTurns: Array<Record<string, unknown>> = [
  ...professorPlanningTurns,
  ...turns,
].map((t) => ({
  id: t.id,
  orgId: t.orgId,
  sessionId: t.sessionId,
  turnIndex: t.turnIndex,
  role: t.role,
  parts: t.parts,
  tokenEstimate: t.tokenEstimate ?? 0,
  createdAt: t.createdAt,
}));

// Build validation checks results statically to populate v0DemoWorld.validation
const validationChecks: V0ValidationCheck[] = [];

// 1. counts.required_rows
const requiredRowsCheck: V0ValidationCheck = { id: "counts.required_rows", status: "pass" };
if (agentSessions.length !== 32) { requiredRowsCheck.status = "fail"; requiredRowsCheck.detail = `Expected 32 agent sessions, got ${agentSessions.length}`; }
if (packageData.users.length < 33 || packageData.users.length > 36) { requiredRowsCheck.status = "fail"; requiredRowsCheck.detail = `Expected between 33 and 36 users, got ${packageData.users.length}`; }
validationChecks.push(requiredRowsCheck);

// 2. ids.deterministic
const idsCheck: V0ValidationCheck = { id: "ids.deterministic", status: "pass" };
const idsSet = new Set<string>();
for (const s of agentSessions) {
  if (idsSet.has(s.id as string)) { idsCheck.status = "fail"; idsCheck.detail = `Duplicate session id: ${s.id}`; }
  idsSet.add(s.id as string);
}
validationChecks.push(idsCheck);

// 3. refs.resolve
const refsCheck: V0ValidationCheck = { id: "refs.resolve", status: "pass" };
const validUserIds = new Set(packageData.users.map((u) => idFor(`user:${u.key}`)));
const validCourseIds = new Set(packageData.courses.map((c) => idFor(`course:${c.code}:${c.termSlug}`)));
const validAssignmentIds = new Set(
  packageData.courses.flatMap((c) => c.assignments.map((a) => idFor(`assignment:${c.code}:${c.termSlug}:${a.key}`)))
);

for (const session of agentSessions) {
  if (!validUserIds.has(session.userId as string)) {
    refsCheck.status = "fail";
    refsCheck.detail = `Session references unknown user: ${session.userId}`;
  }
  if (!validCourseIds.has(session.courseId as string)) {
    refsCheck.status = "fail";
    refsCheck.detail = `Session references unknown course: ${session.courseId}`;
  }
  if (session.anchorType === "assignment" && !validAssignmentIds.has(session.anchorId as string)) {
    refsCheck.status = "fail";
    refsCheck.detail = `Assignment session references unknown assignment: ${session.anchorId}`;
  }
}

for (const turn of agentTurns) {
  const exists = agentSessions.some((s) => s.id === turn.sessionId);
  if (!exists) { refsCheck.status = "fail"; refsCheck.detail = `Turn references unknown session: ${turn.sessionId}`; }
}
validationChecks.push(refsCheck);

// 4. dates.timeline
const datesCheck: V0ValidationCheck = { id: "dates.timeline", status: "pass" };
const termStart = new Date("2026-04-27T00:00:00Z");
for (const p of changeProposals) {
  if (new Date(p.createdAt as string) < termStart) { datesCheck.status = "fail"; datesCheck.detail = `Proposal created before term start: ${p.createdAt}`; }
}
validationChecks.push(datesCheck);

// 5. weights.objectives
const objWeightsCheck: V0ValidationCheck = { id: "weights.objectives", status: "pass" };
const totalObjWeight = econCourse.objectives.reduce((sum, o) => sum + o.assessmentWeight, 0);
if (Math.abs(totalObjWeight - 1.0) > 0.01) { objWeightsCheck.status = "fail"; objWeightsCheck.detail = `Objectives weights sum to ${totalObjWeight}, expected 1.0`; }
validationChecks.push(objWeightsCheck);

// 6. weights.rubric
const rubricWeightsCheck: V0ValidationCheck = { id: "weights.rubric", status: "pass" };
const totalRubricWeight = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
if (totalRubricWeight !== 100) { rubricWeightsCheck.status = "fail"; rubricWeightsCheck.detail = `Rubric weights sum to ${totalRubricWeight}, expected 100`; }
validationChecks.push(rubricWeightsCheck);

// 7. materials.real_text
const materialsTextCheck: V0ValidationCheck = { id: "materials.real_text", status: "pass" };
for (const p of econCourse.pages) {
  const words = p.bodyMd.split(/\s+/).filter(Boolean).length;
  if (words < 300 || words > 800) {
    materialsTextCheck.status = "fail";
    materialsTextCheck.detail = `Page ${p.slug} has ${words} words, expected 300-800.`;
  }
}
validationChecks.push(materialsTextCheck);

// 8. materials.no_placeholders
const materialsPlaceholdersCheck: V0ValidationCheck = { id: "materials.no_placeholders", status: "pass" };
for (const p of econCourse.pages) {
  if (p.bodyMd.includes("TODO") || p.bodyMd.includes("lorem ipsum")) {
    materialsPlaceholdersCheck.status = "fail";
    materialsPlaceholdersCheck.detail = `Page ${p.slug} contains placeholders.`;
  }
}
validationChecks.push(materialsPlaceholdersCheck);

// 9. exam.topic_totals
const examTotalsCheck: V0ValidationCheck = { id: "exam.topic_totals", status: "pass" };
for (const score of examRecord.studentScores) {
  const topicSum = Object.values(score.topicScores).reduce((sum, v) => sum + v, 0);
  if (topicSum !== score.totalScore) {
    examTotalsCheck.status = "fail";
    examTotalsCheck.detail = `Student ${score.studentKey} topic sum ${topicSum} does not equal total score ${score.totalScore}`;
  }
}
validationChecks.push(examTotalsCheck);

// 9b. exam.topic_maxes: the grading blueprint is coherent and every score fits it
const examTopicMaxesCheck: V0ValidationCheck = { id: "exam.topic_maxes", status: "pass" };
const topicMaxSum = Object.values(exam1TopicMaxes).reduce((sum, v) => sum + v, 0);
if (topicMaxSum !== exam1PointsPossible) {
  examTopicMaxesCheck.status = "fail";
  examTopicMaxesCheck.detail = `Topic maxes sum to ${topicMaxSum}, expected ${exam1PointsPossible}.`;
}
if (exam1TopicMaxes.elasticity !== 12) {
  examTopicMaxesCheck.status = "fail";
  examTopicMaxesCheck.detail = "Elasticity must be out of 12 points (canonical side-note fact).";
}
for (const score of examRecord.studentScores) {
  for (const [topic, points] of Object.entries(score.topicScores)) {
    const max = exam1TopicMaxes[topic];
    if (max === undefined) {
      examTopicMaxesCheck.status = "fail";
      examTopicMaxesCheck.detail = `Student ${score.studentKey} has unknown exam topic ${topic}.`;
    } else if (points > max) {
      examTopicMaxesCheck.status = "fail";
      examTopicMaxesCheck.detail = `Student ${score.studentKey} scored ${points} on ${topic}, above its max ${max}.`;
    }
  }
}
validationChecks.push(examTopicMaxesCheck);

// 10. exam.distribution
const examDistCheck: V0ValidationCheck = { id: "exam.distribution", status: "pass" };
const examScoresList = examRecord.studentScores.map((s) => s.totalScore);
const mean = examScoresList.reduce((sum, v) => sum + v, 0) / examScoresList.length;
const variance = examScoresList.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / examScoresList.length;
const sd = Math.sqrt(variance);
if (mean < 72 || mean > 76) { examDistCheck.status = "fail"; examDistCheck.detail = `Exam 1 mean is ${mean.toFixed(2)}, expected 74 +/- 2.`; }
if (sd < 9 || sd > 13) { examDistCheck.status = "fail"; examDistCheck.detail = `Exam 1 std dev is ${sd.toFixed(2)}, expected 9-13.`; }
validationChecks.push(examDistCheck);

// 11. side_notes.sources
const sideNoteSourcesCheck: V0ValidationCheck = { id: "side_notes.sources", status: "pass" };
const coursePageSlugs = new Set(econCourse.pages.map((p) => p.slug));
for (const card of sideNotes) {
  if (card.topic !== "elasticity") {
    sideNoteSourcesCheck.status = "fail";
    sideNoteSourcesCheck.detail = `Side note topic ${card.topic} not in flagged topics.`;
  }
  if (card.sourceRefs.length === 0) {
    sideNoteSourcesCheck.status = "fail";
    sideNoteSourcesCheck.detail = `Side note ${card.id} has no source refs.`;
  }
  if (card.sourcePageSlug && !coursePageSlugs.has(card.sourcePageSlug)) {
    sideNoteSourcesCheck.status = "fail";
    sideNoteSourcesCheck.detail = `Side note ${card.id} references unknown page ${card.sourcePageSlug}.`;
  }
  if (card.sourcePageSlug && !card.sourceRefs.includes(card.sourcePageSlug)) {
    sideNoteSourcesCheck.status = "fail";
    sideNoteSourcesCheck.detail = `Side note ${card.id} sourceRefs must include sourcePageSlug.`;
  }
}
validationChecks.push(sideNoteSourcesCheck);

// 12. featured.chain
const featuredChainCheck: V0ValidationCheck = { id: "featured.chain", status: "pass" };
const featuredStudentId = featuredStudentUserId;
const featuredScores = journeyReports.find((r) => r.userId === featuredStudentId)!.scores;
if (featuredScores.iteration.level !== "Exceeds") {
  featuredChainCheck.status = "fail";
  featuredChainCheck.detail = `Featured Recoverer student did not achieve Exceeds on Iteration.`;
}
validationChecks.push(featuredChainCheck);

// 13. turns.current_schema
const turnsCurrentSchemaCheck: V0ValidationCheck = { id: "turns.current_schema", status: "pass" };
const turnsBySession = new Map<string, Array<Record<string, unknown>>>();
for (const turn of agentTurns) {
  const parts = turn.parts as Array<Record<string, unknown>>;
  if (!Array.isArray(parts) || parts.length === 0) {
    turnsCurrentSchemaCheck.status = "fail";
    turnsCurrentSchemaCheck.detail = `Turn ${turn.id} has no renderable parts.`;
  }
  if (typeof turn.turnIndex !== "number" || turn.turnIndex < 0) {
    turnsCurrentSchemaCheck.status = "fail";
    turnsCurrentSchemaCheck.detail = `Turn ${turn.id} has invalid turnIndex ${turn.turnIndex}.`;
  }
  if (!["user", "assistant", "tool"].includes(turn.role as string)) {
    turnsCurrentSchemaCheck.status = "fail";
    turnsCurrentSchemaCheck.detail = `Turn ${turn.id} has invalid role ${turn.role}.`;
  }
  if (typeof turn.tokenEstimate !== "number" || turn.tokenEstimate < 0) {
    turnsCurrentSchemaCheck.status = "fail";
    turnsCurrentSchemaCheck.detail = `Turn ${turn.id} has invalid tokenEstimate ${turn.tokenEstimate}.`;
  }

  const sessionId = turn.sessionId as string;
  turnsBySession.set(sessionId, [...(turnsBySession.get(sessionId) ?? []), turn]);
}

for (const session of agentSessions) {
  const sessionTurns = turnsBySession.get(session.id as string) ?? [];
  if (sessionTurns.length !== session.totalTurns) {
    turnsCurrentSchemaCheck.status = "fail";
    turnsCurrentSchemaCheck.detail = `Session ${session.id} totalTurns ${session.totalTurns} does not match ${sessionTurns.length} turns.`;
  }

  const turnIndexes = sessionTurns.map((turn) => turn.turnIndex as number).sort((a, b) => a - b);
  for (let i = 0; i < turnIndexes.length; i += 1) {
    if (turnIndexes[i] !== i) {
      turnsCurrentSchemaCheck.status = "fail";
      turnsCurrentSchemaCheck.detail = `Session ${session.id} turn indexes are not contiguous from 0.`;
      break;
    }
  }

  if ((session.compactedThroughTurn as number) > (session.totalTurns as number)) {
    turnsCurrentSchemaCheck.status = "fail";
    turnsCurrentSchemaCheck.detail = `Session ${session.id} compactedThroughTurn exceeds totalTurns.`;
  }
}
validationChecks.push(turnsCurrentSchemaCheck);

// 14. evidence.verbatim
const evidenceVerbatimCheck: V0ValidationCheck = { id: "evidence.verbatim", status: "pass" };
for (const span of evidenceSpans) {
  const turn = agentTurns.find((t) => t.id === span.turnId)!;
  const text = firstTextPart(turn.parts) ?? "";
  const quote = text.slice(span.charStart, span.charEnd);
  if (quote !== span.quote) {
    evidenceVerbatimCheck.status = "fail";
    evidenceVerbatimCheck.detail = `Verbatim quote mismatch: expected "${span.quote}", got "${quote}"`;
  }
}
validationChecks.push(evidenceVerbatimCheck);

// 15. evidence.student_scoped
const evidenceStudentScopedCheck: V0ValidationCheck = { id: "evidence.student_scoped", status: "pass" };
for (const span of evidenceSpans) {
  const turn = agentTurns.find((t) => t.id === span.turnId)!;
  if (turn.role !== "user") {
    evidenceStudentScopedCheck.status = "fail";
    evidenceStudentScopedCheck.detail = `Evidence span references non-student turn: ${turn.id}`;
  }
}
validationChecks.push(evidenceStudentScopedCheck);

// 16. journeys.weighted_scores
const journeysWeightedCheck: V0ValidationCheck = { id: "journeys.weighted_scores", status: "pass" };
for (const report of journeyReports) {
  let computedOverall = 0;
  for (const criterionKey of ["framing", "grounding", "iteration", "final_design"]) {
    const scoreVal = report.scores[criterionKey]?.score ?? 0;
    computedOverall += scoreVal;
  }
  if (report.overallScore !== computedOverall) {
    journeysWeightedCheck.status = "fail";
    journeysWeightedCheck.detail = `Report ${report.id} overallScore ${report.overallScore} !== computed sum ${computedOverall}`;
  }
}
validationChecks.push(journeysWeightedCheck);

// 16b. gradebook.matches_journeys: a finalized session grade IS its report sum
const gradebookJourneyCheck: V0ValidationCheck = { id: "gradebook.matches_journeys", status: "pass" };
for (const sub of submissionsList) {
  if (sub.assignmentKey !== "session-assignment" || sub.state !== "graded") continue;
  const report = journeyReports.find((r) => r.userId === idFor(`user:${sub.studentKey}`));
  if (!report) {
    gradebookJourneyCheck.status = "fail";
    gradebookJourneyCheck.detail = `Graded student ${sub.studentKey} has no journey report.`;
  } else if (report.overallScore !== sub.score) {
    gradebookJourneyCheck.status = "fail";
    gradebookJourneyCheck.detail = `Student ${sub.studentKey}: gradebook ${sub.score} does not equal journey overall ${report.overallScore}.`;
  }
}
validationChecks.push(gradebookJourneyCheck);

// 17. rollup.recomputes
const rollupRecomputesCheck: V0ValidationCheck = { id: "rollup.recomputes", status: "pass" };

// Re-derive archetype counts
const reDerivedArchetypeCounts: Record<string, number> = { Strong: 0, Steady: 0, Struggling: 0, Delegator: 0, Recoverer: 0 };
for (const report of journeyReports) {
  const stud = studentDefs.find((s) => idFor(`user:${s.key}`) === report.userId)!;
  reDerivedArchetypeCounts[stud.archetype]++;
}

// Re-derive criterion counts
const reDerivedCriterionCounts: Record<string, Record<string, number>> = {
  framing: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
  grounding: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
  iteration: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
  final_design: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
};
for (const report of journeyReports) {
  for (const cKey of ["framing", "grounding", "iteration", "final_design"]) {
    const lvl = report.scores[cKey].level;
    reDerivedCriterionCounts[cKey][lvl]++;
  }
}

// Check matching
for (const arch of Object.keys(reDerivedArchetypeCounts)) {
  if (classRollup.deterministicStats.archetypeCounts[arch] !== reDerivedArchetypeCounts[arch]) {
    rollupRecomputesCheck.status = "fail";
    rollupRecomputesCheck.detail = `Archetype count mismatch for ${arch}: expected ${reDerivedArchetypeCounts[arch]}, got ${classRollup.deterministicStats.archetypeCounts[arch]}`;
  }
}

for (const cKey of Object.keys(reDerivedCriterionCounts)) {
  for (const lvl of ["Exceeds", "Meets", "Developing", "Missing"]) {
    if (classRollup.deterministicStats.criterionCounts[cKey][lvl] !== reDerivedCriterionCounts[cKey][lvl]) {
      rollupRecomputesCheck.status = "fail";
      rollupRecomputesCheck.detail = `Criterion count mismatch for ${cKey}.${lvl}: expected ${reDerivedCriterionCounts[cKey][lvl]}, got ${classRollup.deterministicStats.criterionCounts[cKey][lvl]}`;
    }
  }
}

if (classRollup.deterministicStats.confusionCount !== 14) {
  rollupRecomputesCheck.status = "fail";
  rollupRecomputesCheck.detail = `Expected 14 students with confusion, got ${classRollup.deterministicStats.confusionCount}`;
}
if (classRollup.deterministicStats.recoveryCount !== 3) {
  rollupRecomputesCheck.status = "fail";
  rollupRecomputesCheck.detail = `Expected 3 students with recovery, got ${classRollup.deterministicStats.recoveryCount}`;
}
validationChecks.push(rollupRecomputesCheck);

// 18. delegator.low_iteration
const delegatorLowCheck: V0ValidationCheck = { id: "delegator.low_iteration", status: "pass" };
const sofiaReport = journeyReports.find((r) => r.userId === idFor("user:sofia"))!;
if (sofiaReport.scores.iteration.level !== "Missing") {
  delegatorLowCheck.status = "fail";
  delegatorLowCheck.detail = `Delegator student sofia does not have low/Missing Iteration score: got ${sofiaReport.scores.iteration.level}`;
}
validationChecks.push(delegatorLowCheck);

// validation structure
export const validation: V0ValidationResult = {
  blueprint: "v1",
  scenarioKey,
  size: "full",
  passed: validationChecks.every((c) => c.status === "pass"),
  checks: validationChecks,
  counts: {
    organizations: 1,
    terms: 1,
    users: packageData.users.length,
    courses: packageData.courses.length,
    agentSessions: agentSessions.length,
    agentTurns: agentTurns.length,
    evidenceSpans: evidenceSpans.length,
  },
  derivedMetrics: {
    exam1Mean: mean,
    exam1StandardDeviation: sd,
    conceptWeakConfusions: classRollup.deterministicStats.confusionCount,
    completedStudentSessions: classRollup.deterministicStats.completedStudentSessions,
    verifiedEvidenceSpans: evidenceSpans.length,
  },
};

// Export full v0DemoWorld payload satisfies V0DemoWorld contract
export const v0DemoWorld: V0DemoWorld = {
  manifest: {
    blueprint: "v1",
    scenarioKey,
    size: "full",
    counts: validation.counts,
    canonicalIds: {
      orgId,
      termId,
      courseId,
      professorUserId,
      featuredStudentUserId,
      sessionAssignmentId,
      professorPlanningAgentSessionId,
    },
    derivedMetrics: {
      exam1Mean: validation.derivedMetrics.exam1Mean,
      exam1StandardDeviation: validation.derivedMetrics.exam1StandardDeviation,
      conceptWeakConfusions: validation.derivedMetrics.conceptWeakConfusions,
      completedStudentSessions: validation.derivedMetrics.completedStudentSessions,
      verifiedEvidenceSpans: validation.derivedMetrics.verifiedEvidenceSpans,
    },
  },
  scenario,
  currentSchema: {
    package: packageData,
    agentSessions,
    agentTurns,
    changeProposals,
    proposalBlocks,
  },
  v0: {
    studentProfiles,
    examRecord,
    professorPlanning: {
      session: {
        id: professorPlanningAgentSessionId,
        orgId,
        userId: professorUserId,
        courseId,
        surface: "command",
        anchorType: "course",
        anchorId: idFor(`course:${courseKey}`),
        title: "Exam 2 Practice Set Planning",
        compactedThroughTurn: 0,
        totalTurns: 10,
        createdAt: new Date("2026-06-03T10:00:00Z").toISOString(),
        updatedAt: new Date("2026-06-03T10:30:00Z").toISOString(),
      },
      flaggedTopics: { flaggedTopics: ["elasticity", "price discrimination"] },
      turns: professorPlanningTurns,
    },
    sessionAssignment,
    rubric,
    studentSessions,
    turns,
    artifactStates,
    sideNoteCards: sideNotes,
    evidenceSpans,
    journeyReports,
    classRollup,
  },
  validation,
};
