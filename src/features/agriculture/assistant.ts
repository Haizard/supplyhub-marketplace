export interface AgricultureSignals {
  requestId: string;
  language: "en" | "sw";
  question: string;
  region: string | null;
  areaAcres: number;
  crops: {
    evidenceId: string;
    cropName: string;
    status: string;
    costPerKgMinor: number | null;
    harvestedKg: number;
    expectedHarvestAt: string | null;
  }[];
  offers: {
    evidenceId: string;
    cropName: string;
    pricePerUnitMinor: number;
    unit: string;
  }[];
  inputs: {
    evidenceId: string;
    name: string;
    category: string;
    pricePerUnitMinor: number;
    unit: string;
  }[];
}

export interface AdvicePayload {
  summary: string;
  recommendations: {
    topic: string;
    advice: string;
    confidence: number;
    evidence: string[];
  }[];
  caveats: string[];
}

export function evidenceIds(signals: AgricultureSignals): string[] {
  return [
    ...signals.crops.map((crop) => crop.evidenceId),
    ...signals.offers.map((offer) => offer.evidenceId),
    ...signals.inputs.map((input) => input.evidenceId),
    "farm:area",
  ];
}

const SW = {
  cost: (crop: string, value: number) =>
    `Gharama iliyorekodiwa ya ${crop} ni TZS ${(value / 100).toFixed(2)} kwa kilo.`,
  harvest: (crop: string, date: string) => `${crop}: mavuno yanatarajiwa ${date.slice(0, 10)}.`,
  offer: (crop: string, value: number) =>
    `Ofa iliyorekodiwa ya ${crop} ni TZS ${(value / 100).toFixed(2)} kwa kitengo.`,
  input: (name: string, value: number) =>
    `Bei iliyorekodiwa ya ${name} ni TZS ${(value / 100).toFixed(2)} kwa kitengo.`,
  noRecords: "Hakuna data ya shamba au mauzo bado. Rekodi shamba, mazao na matumizi kwanza.",
  caveat:
    "Ushauri huu ni wa maelezo tu, si mbadala wa majaribio ya maabara wala ushauri wa wataalamu wa kilimo.",
};

const EN = {
  cost: (crop: string, value: number) =>
    `Recorded production cost for ${crop} is TZS ${(value / 100).toFixed(2)} per kg.`,
  harvest: (crop: string, date: string) => `${crop}: expected harvest around ${date.slice(0, 10)}.`,
  offer: (crop: string, value: number) =>
    `Recorded offer for ${crop} is TZS ${(value / 100).toFixed(2)} per unit.`,
  input: (name: string, value: number) =>
    `Recorded price for ${name} is TZS ${(value / 100).toFixed(2)} per unit.`,
  noRecords: "No farm or trade records yet. Register a farm, crop and expenses first.",
  caveat:
    "This is advisory only and is not a substitute for laboratory testing or qualified agronomic advice.",
};

/** Deterministic, record-based advice. Always available; never calls a model. */
export function buildBaselineAdvice(signals: AgricultureSignals): AdvicePayload {
  const t = signals.language === "sw" ? SW : EN;
  const recommendations: AdvicePayload["recommendations"] = [];
  const summaries: string[] = [];

  for (const crop of signals.crops) {
    if (crop.costPerKgMinor !== null) {
      recommendations.push({
        topic: "cost",
        advice: t.cost(crop.cropName, crop.costPerKgMinor),
        confidence: 90,
        evidence: [crop.evidenceId],
      });
      summaries.push(t.cost(crop.cropName, crop.costPerKgMinor));
    }
    if (crop.expectedHarvestAt) {
      recommendations.push({
        topic: "calendar",
        advice: t.harvest(crop.cropName, crop.expectedHarvestAt),
        confidence: 80,
        evidence: [crop.evidenceId],
      });
    }
  }

  for (const offer of signals.offers) {
    recommendations.push({
      topic: "market",
      advice: t.offer(offer.cropName, offer.pricePerUnitMinor),
      confidence: 85,
      evidence: [offer.evidenceId],
    });
  }

  for (const input of signals.inputs) {
    recommendations.push({
      topic: "inputs",
      advice: t.input(input.name, input.pricePerUnitMinor),
      confidence: 85,
      evidence: [input.evidenceId],
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({ topic: "records", advice: t.noRecords, confidence: 100, evidence: [] });
  }

  return {
    summary: summaries.slice(0, 2).join(" ") || t.noRecords,
    recommendations: recommendations.slice(0, 6),
    caveats: [t.caveat],
  };
}

/** Removes direct identifiers from the free-text question before it leaves the server. */
export function sanitizeQuestion(question: string): string {
  return question
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\+?\d[\d\s()-]{7,}\d/g, "[number]")
    .replace(/https?:\/\/\S+/g, "[link]")
    .trim()
    .slice(0, 500);
}
