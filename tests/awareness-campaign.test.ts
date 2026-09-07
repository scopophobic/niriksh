import assert from "node:assert/strict";
import test from "node:test";
import { buildAwarenessCampaign, campaignAsText } from "../lib/awareness-campaign";

const pattern = {
  id: "verified-pattern",
  title: "Parcel-release fee pattern",
  status: "VERIFIED",
  behavioural_pattern: "Parcel claim → urgency → payment request",
  complaint_count: 4,
  indicators: [
    { type_label: "Phone number", display_value: "+91 99999 11111", case_count: 4 },
    { type_label: "UPI ID", display_value: "private@upi", case_count: 3 },
  ],
};

test("awareness campaign uses pattern evidence without exposing raw identifiers", () => {
  const campaign = buildAwarenessCampaign(pattern, "English", "General public");
  const output = campaignAsText(campaign);
  assert.equal(campaign.scenes.length, 4);
  assert.match(output, /4 reports/);
  assert.match(output, /Phone number, UPI ID/);
  assert.doesNotMatch(output, /99999 11111|private@upi/);
});

test("parcel campaign gives a relevant verification action", () => {
  const campaign = buildAwarenessCampaign(pattern, "English", "Older adults");
  assert.match(campaign.scenes.at(-1)?.narration || "", /official website/);
});

test("image awareness produces a poster brief without raw identifiers", () => {
  const campaign = buildAwarenessCampaign(pattern, "Hindi", "General public", "image");
  const output = campaignAsText(campaign);
  assert.equal(campaign.format, "image");
  assert.match(campaign.image.headline, /parcel-release fee pattern/i);
  assert.match(output, /Format: Image awareness/);
  assert.match(output, /Warning signs:/);
  assert.doesNotMatch(output, /99999 11111|private@upi/);
});

test("text awareness produces a complete public advisory", () => {
  const campaign = buildAwarenessCampaign(pattern, "English", "Small businesses", "text");
  const output = campaignAsText(campaign);
  assert.equal(campaign.format, "text");
  assert.match(campaign.text.headline, /Public advisory/);
  assert.match(output, /What to do:/);
  assert.match(output, /official website/);
  assert.doesNotMatch(output, /99999 11111|private@upi/);
});
