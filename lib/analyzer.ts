import {
  AnalysisHighlight,
  AnalysisConcern,
  AnalysisResult,
  ComplaintDetails,
  Entity,
  EvidenceAnalysis,
  EvidenceItem,
  GroundedFact,
  TimelineEvent,
  VerificationCheck,
} from "./types";
import { reviewCategory } from "./review-policy";

interface TextSource {
  label: string;
  text: string;
}

const URL_RE = /https?:\/\/[^\s]+/gi;
const UPI_RE = /\b[\w.-]{2,256}@[a-zA-Z]{2,64}\b/g;
const EMAIL_RE = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const USER_RE = /@[a-zA-Z0-9._]{3,30}/g;
const PHONE_RE = /(?:\+91[-\s]?)?[6-9]\d{9}\b/g;
const AMOUNT_RE = /₹\s?[\d,]+|Rs\.?\s?[\d,]+/gi;
const TIME_RE = /\b(today|yesterday(?:\s+(?:morning|afternoon|evening))?|last\s+(?:night|week|month)|every\s+(?:day|night|week)|tomorrow|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/gi;

const SIGNALS = {
  ai: [/\b(ai|deepfake|fake video|cloned voice|synthetic|manipulated (?:video|audio|image))\b/i],
  financial: [/\b(money|upi|payment|investment|transfer|bank|wallet|scam|fraud|debited|₹|rs\.?\s?\d)\b/i],
  threat: [/\b(threat(?:en(?:ed|ing)?)?|kill(?:ed|ing)?|harm(?:ed|ing)?|coming (?:for|to get)|know where (?:i|you) (?:live|work)|regret blocking|stalk(?:ed|ing)?|doxx?(?:ed|ing)?|home address)\b/i],
  intimate: [/\b(explicit|intimate|nude|sexual|morphed intimate)\b/i],
  child: [/\b(child|minor|daughter|son|school student|underage|1[0-7]\s?(?:year|yr))\b/i],
  active: [/\b(still live|still happening|circulating|being shared|ongoing|every day|every night|keeps? (?:sending|calling|posting)|repeated(?:ly)?)\b/i],
  stopped: [/\b(messages? stopped|no longer happening|post was (?:removed|taken down)|account is no longer active)\b/i],
  loss: [/\b(transferred|debited|paid|lost|already sent|money was sent)\b/i],
  noLoss: [/\b(no money was sent|did not transfer|didn't transfer|did not pay|didn't pay|payment was stopped)\b/i],
  impersonation: [/\b(impersonat(?:e|ed|ing|ion)|pretending to be|my face|using my name|fake (?:profile|account).*me|fake(?: ai)? video.*me|video of me|cloned voice)\b/i],
  phishing: [/\b(phish(?:ing)?|kyc|otp|lookalike (?:site|website)|fake login|(?:asked|asking|requested|requesting|prompted)(?:\s+\w+){0,4}\s+(?:for\s+)?(?:my\s+|the\s+)?password)\b/i],
  compromise: [/\b(account (?:was )?(?:hacked|compromised|taken over)|unauthori[sz]ed login|password (?:was )?changed|locked out)\b/i],
  harassment: [/\b(harass(?:ed|ment|ing)?|abusive messages?|unwanted messages?|keeps? contacting|repeated messages?)\b/i],
  harmfulContent: [/\b(obscene|harmful (?:content|media)|questionable content|humiliat(?:e|ed|ing)|defam(?:e|ed|ation|atory)|degrading|shaming|fake explicit|non-consensual|without consent|reputation damage)\b/i],
} as const;

const PLATFORM_PATTERNS: Array<[string, RegExp]> = [
  ["Instagram", /\binstagram\b/i],
  ["Facebook", /\bfacebook\b/i],
  ["WhatsApp", /\bwhatsapp\b/i],
  ["Telegram", /\btelegram\b/i],
  ["YouTube", /\byoutube\b/i],
  ["X / Twitter", /\b(?:twitter|x\.com)\b/i],
  ["Email", /\b(?:email|e-mail)\b/i],
  ["SMS", /\b(?:sms|text message)\b/i],
];

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function structuredSources(details?: ComplaintDetails): TextSource[] {
  if (!details) return [];
  const sources: TextSource[] = [];
  const incident = [
    details.selectedCategory,
    details.incidentDate && `Incident date ${details.incidentDate}`,
    details.incidentTime && `Incident time ${details.incidentTime}`,
    details.delayReason && `Reporting delay: ${details.delayReason}`,
    details.channel && `The incident occurred on ${details.channel}`,
    details.accountOrUrl && `Account or URL ${details.accountOrUrl}`,
    details.incidentStatus === "Still available or happening" && "The content is still live and the incident is still happening",
    details.incidentStatus === "Stopped or removed" && "The content was removed and is no longer happening",
  ].filter(Boolean).join(". ");
  if (incident) sources.push({ label: "Form: incident details", text: incident });

  const location = [details.state && `State or UT ${details.state}`, details.district && `District ${details.district}`, details.policeStation && `Police station ${details.policeStation}`].filter(Boolean).join(". ");
  if (location) sources.push({ label: "Form: location", text: location });

  if (details.financial?.involved) {
    const financial = [
      "Financial fraud payment bank wallet transaction",
      details.financial.bankOrWallet && `Bank wallet or merchant ${details.financial.bankOrWallet}`,
      details.financial.transactionId && `Transaction ID ${details.financial.transactionId}`,
      details.financial.transactionDate && `Transaction date ${details.financial.transactionDate}`,
      details.financial.amount && `Amount ₹${details.financial.amount.replace(/^₹\s?/, "")}`,
      details.financial.moneyStatus === "Transferred or debited" && "Money was transferred or debited paid",
      details.financial.moneyStatus === "Payment attempted or stopped" && "Payment was stopped",
      details.financial.moneyStatus === "No money sent" && "No money was sent",
    ].filter(Boolean).join(". ");
    sources.push({ label: "Form: financial details", text: financial });
  }

  if (details.aiMisuse?.suspected) {
    const harmful = details.aiMisuse.harmfulNature || [];
    const ai = [
      "AI generated synthetic manipulated content",
      details.aiMisuse.mediaType && `Media type ${details.aiMisuse.mediaType}`,
      details.aiMisuse.identityUsed === "My identity" && "using my identity pretending to be me without permission",
      details.aiMisuse.identityUsed === "A child’s identity" && "using a minor child's identity",
      details.aiMisuse.identityUsed === "Someone else’s identity" && "using another person's identity pretending to be them",
      details.aiMisuse.permission === "No permission" && "non-consensual without consent or permission",
      harmful.includes("Sexual or intimate") && "fake explicit intimate sexual obscene content",
      harmful.includes("Humiliating or defamatory") && "humiliating defamatory degrading reputation damage",
      harmful.includes("Threatening or coercive") && "threatening harmful coercive content",
      harmful.includes("Fraud or scam") && "investment scam fraud asking for money",
      harmful.includes("Harassment or bullying") && "harassing abusive humiliating content",
      details.aiMisuse.contentUrl && `Content URL ${details.aiMisuse.contentUrl}`,
      details.aiMisuse.distribution === "Still online or spreading" && "still live circulating being shared ongoing",
      details.aiMisuse.distribution === "Removed or stopped" && "post was removed no longer happening",
    ].filter(Boolean).join(". ");
    sources.push({ label: "Form: AI-misuse details", text: ai });
  }

  const suspect = details.suspect;
  if (suspect) {
    const suspectText = [suspect.nameOrAlias && `Suspect alias ${suspect.nameOrAlias}`, suspect.phone, suspect.email, suspect.bankAccount && `Bank account ${suspect.bankAccount}`, suspect.profileOrWebsite, suspect.address && `Address ${suspect.address}`].filter(Boolean).join(". ");
    if (suspectText) sources.push({ label: "Form: suspect details", text: suspectText });
  }
  return sources;
}

function isNegated(text: string, index: number) {
  const before = text.slice(Math.max(0, index - 38), index).toLowerCase();
  return /\b(no|not|never|without|did not|didn't|was not|wasn't|is not|isn't)\b[^.!?]{0,24}$/.test(before);
}

function sourceHas(source: TextSource, patterns: readonly RegExp[], allowNegated = false) {
  return patterns.some(pattern => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const matches = [...source.text.matchAll(new RegExp(pattern.source, flags))];
    return matches.some(match => allowNegated || !isNegated(source.text, match.index || 0));
  });
}

function sourcesWith(sources: TextSource[], patterns: readonly RegExp[], allowNegated = false) {
  return sources.filter(source => sourceHas(source, patterns, allowNegated)).map(source => source.label);
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function extractEntities(sources: TextSource[]) {
  const entities: Entity[] = [];
  const facts: GroundedFact[] = [];
  const seen = new Set<string>();

  const add = (type: string, value: string, source: string) => {
    const normalized = clean(value.replace(/[.,]$/, ""));
    const key = `${type}:${normalized.toLowerCase()}`;
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    entities.push({ type, value: normalized });
    facts.push({ label: type, value: normalized, source });
  };

  for (const source of sources) {
    for (const [platform, pattern] of PLATFORM_PATTERNS) {
      if (pattern.test(source.text)) add("Platform", platform, source.label);
    }
    const emails: string[] = source.text.match(EMAIL_RE) || [];
    const upiIds: string[] = (source.text.match(UPI_RE) || []).filter(value => !emails.some(email => email.startsWith(`${value}.`) || email === value));
    emails.forEach(value => add("Email", value, source.label));
    upiIds.forEach(value => add("UPI ID", value, source.label));
    const addressValues = [...emails, ...upiIds];
    (source.text.match(USER_RE) || []).filter(value => !addressValues.some(address => address.includes(value))).forEach(value => add("Username", value, source.label));
    (source.text.match(URL_RE) || []).forEach(value => add("URL", value, source.label));
    (source.text.match(PHONE_RE) || []).forEach(value => add("Phone", value, source.label));
    (source.text.match(AMOUNT_RE) || []).forEach(value => add("Amount", value, source.label));
    const transaction = source.text.match(/\b(?:utr|transaction id|txn id)\s*[:#-]?\s*([a-z0-9]{8,24})\b/i)?.[1];
    if (transaction) add("Transaction ID", transaction, source.label);
  }

  return { entities, facts };
}

function sentenceAt(text: string, index: number) {
  const start = Math.max(text.lastIndexOf(".", index), text.lastIndexOf("!", index), text.lastIndexOf("?", index)) + 1;
  const endings = [text.indexOf(".", index), text.indexOf("!", index), text.indexOf("?", index)].filter(value => value >= 0);
  const end = endings.length ? Math.min(...endings) + 1 : text.length;
  let sentence = clean(text.slice(start, end));
  if (sentence.length < 20 && end < text.length) {
    const nextEndings = [text.indexOf(".", end), text.indexOf("!", end), text.indexOf("?", end)].filter(value => value >= 0);
    const nextEnd = nextEndings.length ? Math.min(...nextEndings) + 1 : text.length;
    sentence = clean(`${sentence} ${text.slice(end, nextEnd)}`);
  }
  return sentence.length > 150 ? `${sentence.slice(0, 147)}…` : sentence;
}

function buildTimeline(sources: TextSource[]) {
  const events: TimelineEvent[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const match of source.text.matchAll(TIME_RE)) {
      const when = match[0];
      const what = sentenceAt(source.text, match.index || 0);
      const key = `${when.toLowerCase()}:${what.toLowerCase()}`;
      if (!what || seen.has(key)) continue;
      seen.add(key);
      events.push({
        when,
        what,
        source: source.label,
        precision: /^every\b/i.test(when) ? "Repeated" : /^\d/.test(when) ? "Exact" : "Approximate",
      });
    }
  }
  return events.slice(0, 8);
}

function buildEvidenceAnalysis(files: EvidenceItem[], sources: TextSource[]) {
  return files.map<EvidenceAnalysis>(file => {
    const source = sources.find(item => item.label === `Evidence: ${file.name}`);
    const observations: string[] = [];
    const limitations: string[] = [];
    if (file.sha256) observations.push("A unique file check was saved when it was added");
    if (file.contextNote) observations.push(`The user highlighted: ${clean(file.contextNote)}`);
    if (file.extractedText) {
      observations.push("Text from this file was included in the context analysis");
      const detailCount = extractEntities(source ? [source] : []).entities.length;
      if (detailCount) observations.push(`${detailCount} useful account, payment or platform detail${detailCount === 1 ? " was" : "s were"} found`);
      if (source && sourceHas(source, SIGNALS.threat)) observations.push("Language related to threats or personal safety was found");
      if (source && sourceHas(source, SIGNALS.financial)) observations.push("Payment or financial language was found");
    } else {
      observations.push(`${file.type} file is ready for a reviewer`);
      limitations.push("The binary content needs the connected analysis pipeline or a human reviewer; local mode does not interpret it yet");
    }
    if (file.originality === "Screenshot") limitations.push("A screenshot may not include the original message metadata");
    if (file.originality === "Forwarded") limitations.push("This is forwarded material, so the original source still needs checking");
    if (file.originality === "Edited") limitations.push("The user marked this file as edited");
    if (file.demo) limitations.push("This is fictional sample evidence used only for testing");
    return {
      fileName: file.name,
      status: file.extractedText ? "Content reviewed" : "File prepared",
      observations: unique(observations),
      limitations: unique(limitations),
    };
  });
}

function reporterRole(text: string) {
  if (/\b(my (?:daughter|son|child)|i am (?:their|the) (?:parent|guardian))\b/i.test(text)) return "Parent or guardian";
  if (/\b(on behalf of|my (?:friend|colleague|employee|sister|brother) (?:was|is|has))\b/i.test(text)) return "Reporting for someone else";
  if (/\b(i|me|my)\b/i.test(text)) return "Person affected";
  return "Not clear yet";
}

function actionsFrom(text: string) {
  const actions: Array<[RegExp, string]> = [
    [/\bblock(?:ed|ing)? (?:the |this )?(?:account|number|person|user)\b/i, "Blocked the account or contact"],
    [/\b(saved|captured|took) (?:a )?(?:screenshot|copy|recording|messages?)\b/i, "Saved a copy of the evidence"],
    [/\breported (?:it|this|the account) to (?:the )?(?:platform|app|website)\b/i, "Reported it to the platform"],
    [/\bcontacted (?:the )?bank\b/i, "Contacted the bank"],
    [/\bchanged (?:my |the )?password\b/i, "Changed the password"],
    [/\b(?:called|contacted) (?:the )?(?:police|1930)\b/i, "Contacted official support"],
    [SIGNALS.noLoss[0], "Stopped or avoided the payment"],
  ];
  return actions.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

export function analyzeComplaint(text: string, evidenceOrCount: EvidenceItem[] | number = 0, details?: ComplaintDetails): AnalysisResult {
  const description = clean(text);
  const evidence = Array.isArray(evidenceOrCount) ? evidenceOrCount : [];
  const evidenceCount = Array.isArray(evidenceOrCount) ? evidenceOrCount.length : evidenceOrCount;
  const sources: TextSource[] = [{ label: "User description", text: description }];
  evidence.forEach(file => {
    const evidenceText = clean([file.extractedText, file.contextNote].filter(Boolean).join(". "));
    if (evidenceText) sources.push({ label: `Evidence: ${file.name}`, text: evidenceText });
  });
  sources.push(...structuredSources(details));
  const allText = sources.map(source => source.text).join(". ");

  const signalSources = (key: keyof typeof SIGNALS, allowNegated = false) => sourcesWith(sources, SIGNALS[key], allowNegated);
  const has = (key: keyof typeof SIGNALS, allowNegated = false) => signalSources(key, allowNegated).length > 0;
  const aiSuspected = has("ai");
  const financial = has("financial", true);
  const threat = has("threat");
  const intimate = has("intimate");
  const child = has("child");
  const harmfulContent = has("harmfulContent");
  const active = has("active");
  const stopped = has("stopped");
  const actualLoss = has("loss");
  const noLoss = has("noLoss", true);
  const impersonation = has("impersonation");
  const compromise = has("compromise");

  const folder = reviewCategory(details?.selectedCategory);
  const category = folder.label;
  const confidence = 0;
  const secondary: string[] = [];

  const riskFactors: string[] = [];
  const sensitiveChildRisk = child && (intimate || harmfulContent);
  if (sensitiveChildRisk) riskFactors.push("Reporter mentions a child and sensitive material");
  if (threat) riskFactors.push("Reporter mentions threatening language");
  if (intimate) riskFactors.push("Reporter mentions intimate content");
  if (actualLoss) riskFactors.push("Reporter says money may have moved");
  if (active) riskFactors.push("Reporter says the incident may be continuing");
  if (impersonation) riskFactors.push("Reporter mentions possible identity misuse");
  if (compromise) riskFactors.push("Reporter mentions possible account-access loss");
  const score = 0;
  const severity = "Needs review" as const;

  const extracted = extractEntities(sources);
  const entities = [...extracted.entities];
  const structuredFacts: GroundedFact[] = [];
  const addStructuredFact = (label: string, value: string | undefined, source: string, entityType?: string) => {
    const normalized = value && clean(value);
    if (!normalized) return;
    if (!extracted.facts.some(fact => fact.label === label && fact.value.toLowerCase() === normalized.toLowerCase())) structuredFacts.push({ label, value: normalized, source });
    if (entityType && !entities.some(entity => entity.type === entityType && entity.value.toLowerCase() === normalized.toLowerCase())) entities.push({ type: entityType, value: normalized });
  };
  addStructuredFact("Selected complaint type", details?.selectedCategory, "Form: incident details");
  addStructuredFact("Channel", details?.channel, "Form: incident details", "Platform");
  addStructuredFact("Reported account or URL", details?.accountOrUrl, "Form: incident details", "Reported account");
  addStructuredFact("State / UT", details?.state, "Form: location");
  addStructuredFact("District", details?.district, "Form: location");
  addStructuredFact("Police station", details?.policeStation, "Form: location");
  addStructuredFact("Bank / wallet / merchant", details?.financial?.bankOrWallet, "Form: financial details", "Financial institution");
  addStructuredFact("Transaction ID / UTR", details?.financial?.transactionId, "Form: financial details", "Transaction ID");
  addStructuredFact("Transaction amount", details?.financial?.amount ? `₹${details.financial.amount.replace(/^₹\s?/, "")}` : undefined, "Form: financial details", "Amount");
  addStructuredFact("Suspect name or alias", details?.suspect?.nameOrAlias, "Form: suspect details", "Suspect alias");
  addStructuredFact("Suspect bank account", details?.suspect?.bankAccount, "Form: suspect details", "Bank account");
  const role = details?.reporterRole || reporterRole(description);
  const harm: string[] = [];
  if (threat) harm.push("Personal safety");
  if (financial) harm.push(actualLoss ? "Financial loss" : "Possible financial loss");
  if (impersonation) harm.push("Identity or reputation");
  if (intimate) harm.push("Privacy and dignity");
  if (harmfulContent) harm.push("Dignity or reputation");
  if (compromise) harm.push("Account access");
  if (has("harassment")) harm.push("Repeated unwanted contact");
  const structuredStatus = details?.aiMisuse?.distribution === "Still online or spreading" || details?.incidentStatus === "Still available or happening"
    ? "Still happening"
    : details?.aiMisuse?.distribution === "Removed or stopped" || details?.incidentStatus === "Stopped or removed"
      ? "Stopped"
      : undefined;
  const context = {
    reporterRole: role,
    incidentStatus: active && stopped ? "Needs clarification" : structuredStatus || (active ? "Still happening" : stopped ? "Stopped" : "Not clear yet"),
    harm: unique(harm),
    actionsTaken: unique(actionsFrom(allText)),
  };

  const facts: GroundedFact[] = [
    { label: "Reporter", value: role, source: details?.reporterRole ? "Form: incident details" : "User description" },
    { label: "Current situation", value: context.incidentStatus, source: unique([...signalSources("active"), ...signalSources("stopped")]).join(", ") || "Not enough information" },
    ...extracted.facts,
    ...structuredFacts,
  ];
  const timeline = buildTimeline(sources);
  if (details?.incidentDate) timeline.unshift({ when: `${details.incidentDate}${details.incidentTime ? ` ${details.incidentTime}` : ""}`, what: "Incident occurred or content was first received/viewed", source: "Form: incident details", precision: "Exact" });
  if (details?.financial?.transactionDate) timeline.push({ when: details.financial.transactionDate, what: "Reported transaction date", source: "Form: financial details", precision: "Exact" });
  const evidenceAnalysis = buildEvidenceAnalysis(evidence, sources);

  const concerns: AnalysisConcern[] = [];
  if (actualLoss && noLoss) concerns.push({ issue: "The report contains different statements about whether money was sent.", question: "Was any money successfully transferred or debited?" });
  if (active && stopped) concerns.push({ issue: "The report describes the incident as both ongoing and stopped.", question: "Is the contact or content still active right now?" });

  const hasPlatform = Boolean(details?.channel) || entities.some(entity => entity.type === "Platform");
  const hasIdentifier = Boolean(details?.accountOrUrl || details?.suspect?.phone || details?.suspect?.email || details?.suspect?.profileOrWebsite || details?.financial?.transactionId) || entities.some(entity => ["Username", "UPI ID", "Email", "URL", "Phone", "Transaction ID", "Reported account"].includes(entity.type));
  const hasDate = Boolean(details?.incidentDate) || timeline.length > 0;
  const missing: string[] = [];
  if (!hasPlatform) missing.push("Platform or service");
  if (!hasIdentifier) missing.push("Account, link or contact detail");
  if (!hasDate) missing.push("Approximate date or time");
  if (evidenceCount === 0) missing.push("Supporting screenshot or file");
  if (financial && !actualLoss && !noLoss) missing.push("Whether money was transferred");
  if (!active && !stopped) missing.push("Whether it is still happening");
  if (details?.financial?.involved && !details.financial.bankOrWallet) missing.push("Bank, wallet or merchant name");
  if (details?.financial?.involved && !details.financial.transactionId) missing.push("Transaction ID or UTR");
  if (details?.financial?.involved && !details.financial.amount) missing.push("Fraud amount");
  if (details?.aiMisuse?.suspected && !details.aiMisuse.contentUrl && evidenceCount === 0) missing.push("AI-content source or original file");
  if (details && !details.state) missing.push("State or UT for routing");

  const questionFor: Record<string, string> = {
    "Platform or service": "Which app, website or service was involved?",
    "Account, link or contact detail": "Do you have a username, profile link, phone number or account detail?",
    "Approximate date or time": "Approximately when did this begin or happen?",
    "Supporting screenshot or file": "Can you add a screenshot, message export or original file?",
    "Whether money was transferred": "Was any money actually transferred or debited?",
    "Whether it is still happening": "Is this still happening right now?",
    "Bank, wallet or merchant name": "Which bank, wallet or merchant was involved?",
    "Transaction ID or UTR": "Do you have the transaction ID or UTR number?",
    "Fraud amount": "What amount was transferred or debited?",
    "AI-content source or original file": "Can you add the content URL or the best available original file?",
    "State or UT for routing": "Which State or Union Territory should review this complaint?",
  };
  const questions = unique([...concerns.map(concern => concern.question), ...missing.map(item => questionFor[item])]).slice(0, 4);

  const expected = 6 + (details?.financial?.involved ? 3 : 0) + (details?.aiMisuse?.suspected ? 1 : 0) + (details ? 1 : 0);
  const known = expected - missing.length;
  const completeness = Math.max(18, Math.min(96, Math.round((known / expected) * 100)));

  const departments = [folder.team];
  const reasons: string[] = [];
  reasons.push(`The reporter selected the ${category} subject folder.`);
  reasons.push("A reviewer confirms the facts, folder, and destination team.");
  const summary = `The reporter submitted information in the ${category.toLowerCase()} subject folder. The details below organise their account for human review.`;

  const highlights: AnalysisHighlight[] = [];
  const addHighlight = (key: keyof typeof SIGNALS, label: string, detail: string, level: AnalysisHighlight["level"]) => {
    for (const source of sources) {
      for (const pattern of SIGNALS[key]) {
        const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
        const match = [...source.text.matchAll(new RegExp(pattern.source, flags))].find(item => !isNegated(source.text, item.index || 0));
        if (!match) continue;
        const excerpt = sentenceAt(source.text, match.index || 0);
        highlights.push({ label, detail: `${detail}${excerpt ? ` Relevant wording: “${excerpt}”` : ""}`, source: source.label, level });
        return;
      }
    }
  };
  if (sensitiveChildRisk) addHighlight("child", "Child mentioned", "The supplied information mentions a minor and sensitive content; a reviewer must verify the context.", "Context");
  if (intimate) addHighlight("intimate", "Intimate content mentioned", "The reporter describes sexual or intimate material.", "Context");
  if (threat) addHighlight("threat", "Threat language mentioned", "The reporter describes threatening or location-related language.", "Context");
  if (harmfulContent) addHighlight("harmfulContent", "Harmful content mentioned", "The reporter describes humiliation, defamation, non-consensual use, or reputation harm.", "Context");
  if (impersonation) addHighlight("impersonation", "Identity misuse mentioned", "A person's face, voice, name, or profile is mentioned as being used without permission.", "Context");
  if (actualLoss) addHighlight("loss", "Money movement reported", "The reporter says money may have moved.", "Context");
  if (active) addHighlight("active", "Continuing activity reported", "The reporter says the content or contact may still be active.", "Context");
  if (aiSuspected) addHighlight("ai", "AI manipulation is reported", "This is a reporter-provided indicator, not a forensic authenticity finding.", "Context");

  const checks: VerificationCheck[] = [
    { label: "Incident account", status: description.length >= 40 ? "Ready" : "Missing", detail: description.length >= 40 ? "A usable first-person description is present." : "A clearer description of what happened is needed." },
    { label: "Date and time", status: hasDate ? "Ready" : "Missing", detail: hasDate ? "The incident has time context." : "No incident date or approximate time is available." },
    { label: "Source or suspect identifier", status: hasIdentifier ? "Ready" : "Missing", detail: hasIdentifier ? "At least one account, link, contact or transaction identifier is available." : "There is no account, URL, contact or transaction identifier yet." },
    { label: "Evidence attached", status: evidenceCount > 0 ? "Ready" : "Missing", detail: evidenceCount > 0 ? `${evidenceCount} evidence item${evidenceCount === 1 ? " is" : "s are"} attached.` : "No supporting file is attached." },
    { label: "File integrity check", status: evidence.length > 0 && evidence.every(file => file.sha256) ? "Ready" : evidenceCount > 0 ? "Needs review" : "Missing", detail: evidence.length > 0 && evidence.every(file => file.sha256) ? "Every selected file has a browser-generated SHA-256 fingerprint." : "A fingerprint still needs to be recorded for one or more files." },
    { label: "Evidence content", status: evidence.length > 0 && evidence.every(file => file.extractedText) ? "Ready" : evidenceCount > 0 ? "Needs review" : "Missing", detail: evidence.length > 0 && evidence.every(file => file.extractedText) ? "Readable text from every attachment was included in analysis." : "Visual, audio, PDF or video content still needs human or specialist review." },
    { label: "Reporter declaration", status: details?.declarationConfirmed ? "Ready" : details ? "Missing" : "Needs review", detail: details?.declarationConfirmed ? "The reporter confirmed the information is accurate to the best of their knowledge." : "Reporter confirmation has not been recorded." },
  ];
  const verificationPoints = checks.reduce((total, check) => total + (check.status === "Ready" ? 1 : check.status === "Needs review" ? 0.5 : 0), 0);
  const verification = {
    readiness: Math.round((verificationPoints / checks.length) * 100),
    readyChecks: checks.filter(check => check.status === "Ready").length,
    totalChecks: checks.length,
    checks,
    disclaimer: "Readiness means the case is organised for checking. It does not prove that evidence is authentic or that an allegation is true.",
  };

  const jurisdictionParts = [details?.policeStation && `${details.policeStation} Police Station`, details?.district, details?.state].filter(Boolean);
  const routingReady = Boolean(details?.state && details?.selectedCategory && completeness >= 50);
  const routing = {
    status: routingReady ? "Ready for human routing" as const : "Needs information before routing" as const,
    jurisdiction: jurisdictionParts.join(" · ") || "Jurisdiction not provided",
    primaryUnit: departments[0],
    supportingUnits: unique(departments.slice(1)),
    reasons: unique([
      `The reporter selected ${category}; an officer confirms or changes it.`,
      "No automated urgency or routing decision is generated.",
      details?.state ? `The reporter selected ${details.state} for jurisdiction review.` : "State or UT must be confirmed before routing.",
    ]),
  };

  const takedownRecommended = Boolean(details?.aiMisuse?.takedownWanted);
  const takedown = {
    recommended: takedownRecommended,
    title: takedownRecommended ? "Preserve the evidence, then request platform review" : "Platform-review guidance was not requested",
    reasons: takedownRecommended ? unique([
      aiSuspected ? "The reporter identifies the content as AI-generated or manipulated." : "Manipulation has been reported.",
      intimate ? "The report may involve non-consensual intimate material." : "The report describes possible identity, dignity or reputation harm.",
      active ? "The content may still be accessible or spreading." : "The reporter requested takedown support.",
    ]) : ["The reporter did not request platform-review guidance."],
    preservationSteps: takedownRecommended ? [
      "Save the content URL, account name, date and time before requesting removal.",
      "Keep the best available original file and an unchanged screenshot or screen recording.",
      "Use the platform's reporting flow for impersonation, manipulated media or non-consensual content.",
      "Ask the receiving authority or platform to preserve relevant account records where appropriate.",
    ] : [],
  };

  return {
    summary,
    category,
    secondary: unique(secondary),
    severity,
    score,
    completeness,
    departments: unique(departments),
    entities,
    missing,
    questions,
    riskFactors: unique(riskFactors),
    confidence,
    aiSuspected,
    context,
    facts,
    timeline,
    evidenceAnalysis,
    concerns,
    reasons,
    highlights,
    verification,
    routing,
    takedown,
  };
}
