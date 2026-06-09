const zoomEvent = {
  location: "https://example.zoom.us/j/123456789?pwd=abc",
};

const meetEvent = {
  conferenceData: {
    entryPoints: [{ uri: "https://meet.google.com/abc-defg-hij" }],
  },
};

function extractMeetingUrl(event) {
  const candidates = [
    event.hangoutLink,
    ...(event.conferenceData?.entryPoints?.map((entry) => entry.uri) ?? []),
    event.location,
    event.description,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const match = candidate.match(/https:\/\/(?:[\w.-]*zoom\.us\/j\/[^\s<>"')]+|meet\.google\.com\/[a-z0-9-]+)/i);
    if (match?.[0]) {
      return match[0];
    }
  }

  return null;
}

const transcriptFixture = {
  event: "transcript.data",
  data: {
    bot: { id: "bot_fixture" },
    transcript: {
      id: "segment_fixture",
      speaker: { name: "Parker", id: "speaker_1" },
      is_final: true,
      words: [
        { text: "We", start_timestamp: { relative: 1.2 }, end_timestamp: { relative: 1.4 } },
        { text: "should", start_timestamp: { relative: 1.4 }, end_timestamp: { relative: 1.7 } },
        { text: "ship", start_timestamp: { relative: 1.7 }, end_timestamp: { relative: 2.0 } },
      ],
    },
  },
};

function normalizeTranscript(payload) {
  return payload.data.transcript.words.map((word) => word.text).join(" ");
}

const checks = [
  ["Zoom URL extraction", extractMeetingUrl(zoomEvent)?.includes("zoom.us/j/123456789")],
  ["Meet URL extraction", extractMeetingUrl(meetEvent) === "https://meet.google.com/abc-defg-hij"],
  ["Transcript normalization", normalizeTranscript(transcriptFixture) === "We should ship"],
];

const failures = checks.filter(([, passed]) => !passed);

if (failures.length) {
  console.error(`Fixture verification failed: ${failures.map(([name]) => name).join(", ")}`);
  process.exit(1);
}

console.log("Fixture verification passed.");
