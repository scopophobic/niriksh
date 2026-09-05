import { ComplaintDetails, TriageCase } from "./types";
import { analyzeComplaint } from "./analyzer";

const baseAudit = (time: string): TriageCase["audit"] => [
  { label: "Complaint submitted", detail: "Citizen intake completed and reference issued.", time, actor: "System" },
  { label: "Structured intake completed", detail: "Evidence context, source-linked details, completeness, and missing fields were organised without automated priority scoring.", time, actor: "Niriksh Analysis" },
];

const DEMO_CASE_SEED: TriageCase[] = [
  {
    id: "ai-investment-video", reference: "CYB-2026-000184",
    summary: "Allegedly manipulated video impersonates the complainant to promote an investment scheme on Instagram.",
    description: "Someone created a fake AI video of me promoting an investment scheme. It is being shared from @wealthgrow_daily on Instagram and people are being asked to send money to returnsfast@upi. My colleague already transferred ₹25,000. The post is still live at https://instagram.com/reel/demo184 and I first saw it yesterday evening.",
    reviewCategory: "social", category: "Social media and identity misuse", secondary: [],
    severity: "Needs review", severityScore: 0, status: "Awaiting review", completeness: 82, aiSuspected: true,
    createdAt: "2026-08-26T09:42:00+05:30", createdLabel: "8 min ago", platform: "Instagram", location: "Mumbai, Maharashtra",
    department: ["Social media and identity review"], confidence: 0,
    entities: [{ type: "Platform", value: "Instagram" }, { type: "Username", value: "@wealthgrow_daily" }, { type: "UPI ID", value: "returnsfast@upi" }, { type: "Amount", value: "₹25,000" }, { type: "URL", value: "instagram.com/reel/demo184" }],
    evidence: [{ name: "impersonation-video.mp4", type: "Video", size: "8.4 MB", verified: true }, { name: "instagram-post.png", type: "Image", size: "1.2 MB", verified: true }, { name: "payment-receipt.pdf", type: "Document", size: "284 KB", verified: true }],
    missing: ["Original uncompressed media"], riskFactors: ["Active financial loss", "Ongoing distribution", "Identity impersonation", "Multiple potential victims"], audit: baseAudit("Today, 9:43 AM"),
    citizenVerification: { status: "Confirmed", summaryConfirmed: true, confirmedEntities: 5, totalEntities: 5, confirmedAt: "Today, 9:42 AM" },
  },
  {
    id: "child-safety", reference: "CYB-2026-000183", summary: "A guardian reports suspected synthetic intimate imagery involving a minor circulating in a school group.", description: "My daughter is 15. Students say a fake explicit image using her face is circulating in a private group. We have a screenshot but do not know who made it.", reviewCategory: "sensitive", category: "Sexual exploitation and child safety", secondary: [], severity: "Needs review", severityScore: 0, status: "In review", completeness: 67, aiSuspected: true, createdAt: "2026-08-26T09:28:00+05:30", createdLabel: "22 min ago", platform: "WhatsApp", location: "Pune, Maharashtra", department: ["Sensitive complaint review"], confidence: 0, entities: [{type:"Platform",value:"WhatsApp"}], evidence: [{name:"redacted-screenshot.png",type:"Image",size:"612 KB",verified:true}], missing: ["Group/account identifier", "Approximate first-seen date"], riskFactors: ["Reporter mentions a child", "Reporter mentions intimate content", "Reporter says distribution is continuing"], audit: baseAudit("Today, 9:29 AM"), citizenVerification: { status:"Partially confirmed", summaryConfirmed:true, confirmedEntities:0, totalEntities:1 }
  },
  {
    id: "threatening-messages", reference: "CYB-2026-000182", summary: "Repeated messages threaten physical harm and disclose the complainant’s home address.", description: "An unknown account has sent me threats every night for a week and posted my home address. The last message said they are coming tomorrow.", reviewCategory: "harassment", category: "Threats, harassment and extortion", secondary: [], severity: "Needs review", severityScore: 0, status: "Awaiting review", completeness: 91, aiSuspected: false, createdAt: "2026-08-26T08:51:00+05:30", createdLabel: "59 min ago", platform: "Telegram", location: "Delhi", department: ["Harassment and extortion review"], confidence: 0, entities: [{type:"Platform",value:"Telegram"},{type:"Date",value:"Tomorrow (reported)"}], evidence: [{name:"message-thread.pdf",type:"Document",size:"2.1 MB",verified:true},{name:"profile.png",type:"Image",size:"344 KB",verified:true}], missing: ["Account profile URL"], riskFactors: ["Reporter mentions threatening language", "Reporter describes repeat contact"], audit: baseAudit("Today, 8:52 AM")
  },
  {
    id: "phishing-bank", reference: "CYB-2026-000181", summary: "A bank-lookalike website allegedly collected credentials and initiated an unauthorized payment.", description: "I received an SMS saying my bank KYC expired. The site looked real. After entering details, ₹12,600 was debited.", reviewCategory: "financial", category: "Financial fraud", secondary: [], severity: "Needs review", severityScore: 0, status: "Awaiting review", completeness: 76, aiSuspected: false, createdAt: "2026-08-26T08:12:00+05:30", createdLabel: "1 hr ago", platform: "Web / SMS", location: "Bengaluru, Karnataka", department: ["Financial complaint review"], confidence: 0, entities: [{type:"Amount",value:"₹12,600"},{type:"Channel",value:"SMS"}], evidence: [{name:"fraudulent-sms.png",type:"Image",size:"410 KB",verified:true}], missing: ["Transaction reference", "Phishing URL"], riskFactors: ["Reporter says money was debited", "Reporter mentions account access"], audit: baseAudit("Today, 8:13 AM")
  },
  {
    id: "fake-profile", reference: "CYB-2026-000180", summary: "A social profile is allegedly using the complainant’s name and photographs to contact acquaintances.", description: "Someone copied my profile picture and name on Facebook and is sending friend requests to people I know.", reviewCategory: "social", category: "Social media and identity misuse", secondary: [], severity: "Needs review", severityScore: 0, status: "In review", completeness: 74, aiSuspected: false, createdAt: "2026-08-26T07:36:00+05:30", createdLabel: "2 hrs ago", platform: "Facebook", location: "Kolkata, West Bengal", department: ["Social media and identity review"], confidence: 0, entities: [{type:"Platform",value:"Facebook"}], evidence: [{name:"fake-profile.png",type:"Image",size:"890 KB",verified:true}], missing: ["Profile URL"], riskFactors: ["Reporter mentions possible identity misuse"], audit: baseAudit("Today, 7:37 AM")
  },
  {
    id: "voice-clone", reference: "CYB-2026-000179", summary: "A caller allegedly used a relative’s cloned voice to request a money transfer.", description: "I got a call that sounded exactly like my brother asking for emergency money. I called him separately and learned it was fake. No money was sent.", reviewCategory: "financial", category: "Financial fraud", secondary: [], severity: "Needs review", severityScore: 0, status: "Routed", completeness: 88, aiSuspected: true, createdAt: "2026-08-25T18:14:00+05:30", createdLabel: "Yesterday", platform: "Phone", location: "Jaipur, Rajasthan", department: ["Financial complaint review"], confidence: 0, entities: [{type:"Channel",value:"Phone call"}], evidence: [{name:"call-recording.mp3",type:"Audio",size:"3.8 MB",verified:true}], missing: ["Caller number"], riskFactors: ["Reporter mentions possible identity misuse", "Reporter describes a payment request"], audit: [...baseAudit("Yesterday, 6:15 PM"), {label:"Routing confirmed",detail:"An officer reviewed the case and recorded the destination.",time:"Yesterday, 6:28 PM",actor:"A. Sharma"}]
  },
  {
    id: "insufficient", reference: "CYB-2026-000178", summary: "The report mentions an online scam but lacks identifiers and other details needed for review.", description: "I think someone online tried to scam me. Please help.", reviewCategory: "other", category: "Other / needs category review", secondary: [], severity: "Needs review", severityScore: 0, status: "Needs information", completeness: 24, aiSuspected: false, createdAt: "2026-08-25T15:40:00+05:30", createdLabel: "Yesterday", department: ["General complaint review"], confidence: 0, entities: [], evidence: [], missing: ["What happened", "Contact channel or platform", "Account or payment identifier", "Approximate date"], riskFactors: [], audit: [...baseAudit("Yesterday, 3:41 PM"), {label:"Information requested",detail:"Citizen asked for platform, date and contact details.",time:"Yesterday, 3:48 PM",actor:"P. Nair"}]
  },
  {
    id: "unclear-report", reference: "CYB-2026-000177", summary: "The complaint needs more detail and human category review.", description: "There are strange things happening to my accounts and videos. I want someone to check.", reviewCategory: "other", category: "Other / needs category review", secondary: [], severity: "Needs review", severityScore: 0, status: "Awaiting review", completeness: 18, aiSuspected: false, createdAt: "2026-08-25T12:08:00+05:30", createdLabel: "Yesterday", department: ["General complaint review"], confidence: 0, entities: [], evidence: [], missing: ["Specific incident description", "Affected account", "Platform", "Approximate date", "Supporting evidence"], riskFactors: [], audit: baseAudit("Yesterday, 12:09 PM")
  }
];

export function complaintDetailsForCase(item: TriageCase): ComplaintDetails {
  if (item.complaintDetails) return item.complaintDetails;
  const location = (item.location || "").split(",").map(value => value.trim()).filter(Boolean);
  return {
    selectedCategory: item.reviewCategory || "other",
    state: location.at(-1),
    district: location.length > 1 ? location[0] : undefined,
    channel: item.platform,
    reporterRole: undefined,
    incidentStatus: "Not sure",
    financial: { involved: /financial|phishing|investment|money|bank/i.test(`${item.category} ${item.description}`), moneyStatus: "Not sure" },
    aiMisuse: { suspected: item.aiSuspected, harmfulNature: [], identityUsed: "Not sure", permission: "Not sure", distribution: "Not sure", takedownWanted: false },
    suspect: {},
    declarationConfirmed: item.citizenVerification?.status === "Confirmed",
  };
}

export function withCurrentAnalysis(item: TriageCase): TriageCase {
  const complaintDetails = complaintDetailsForCase(item);
  return { ...item, complaintDetails, analysisDetails: analyzeComplaint(item.description, item.evidence, complaintDetails) };
}

export const DEMO_CASES: TriageCase[] = DEMO_CASE_SEED.map(withCurrentAnalysis);

export const DEMO_DESCRIPTION = "Someone created a fake AI video of me promoting an investment scheme. It is being shared from @wealthgrow_daily on Instagram and people are being asked to send money to returnsfast@upi. My colleague already transferred ₹25,000. The post is still live at https://instagram.com/reel/demo184 and I first saw it yesterday evening.";

export const DEMO_CHAT_DESCRIPTION = "An unknown account has been sending me threatening messages every night. Yesterday they said they know where I work and that I will regret blocking them. I told them to stop contacting me and saved a screenshot of the chat. The messages are ongoing and I am worried the person may try to harm me.";
