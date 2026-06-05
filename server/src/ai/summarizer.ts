export interface AISummaryResult {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: {
    task: string;
    owner: string;
    deadline: string;
  }[];
  risks: string[];
}

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
};

const parseSummaryJson = (text: string): AISummaryResult => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);

  return {
    summary: String(parsed.summary || '').trim(),
    keyPoints: asStringArray(parsed.keyPoints),
    decisions: asStringArray(parsed.decisions),
    risks: asStringArray(parsed.risks),
    actionItems: Array.isArray(parsed.actionItems)
      ? parsed.actionItems
          .map((item: any) => ({
            task: String(item.task || '').trim(),
            owner: String(item.owner || '').trim(),
            deadline: String(item.deadline || '').trim(),
          }))
          .filter((item: { task: string }) => Boolean(item.task))
      : [],
  };
};

export const summarizeTranscript = async (transcript: string): Promise<AISummaryResult> => {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3.2';

  const prompt = `
You are preparing official meeting minutes from a transcript.
Extract exhaustively. Do not compress multiple decisions into one item, do not drop minor decisions, and do not omit details just because they seem small.
Return ONLY valid JSON in this exact shape:
{
  "summary": "detailed paragraph covering all agenda topics discussed",
  "keyPoints": ["one factual discussion detail per item"],
  "decisions": ["one decision or resolution per item"],
  "actionItems": [{ "task": "task", "owner": "owner if mentioned otherwise Unassigned", "deadline": "deadline if mentioned otherwise Not mentioned" }],
  "risks": ["risk or blocker"]
}

Rules:
- Include every decision, resolution, approval, confirmation, rejection, deferral, recommendation, instruction, and agreed next step.
- Preserve names, departments, amounts, dates, deadlines, tools, models, locations, agenda numbers, and conditions whenever mentioned.
- Keep separate decisions as separate array entries, even when they are related.
- Action items must be separate from decisions when someone has to do something after the meeting.
- If no owner or deadline is stated, use "Unassigned" and "Not mentioned".
- Do not mention AI, summarization, or that this was generated.

Transcript:
${transcript}
`;

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: 'json',
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Ollama summary failed: ${message}`);
  }

  const data = await response.json();
  return parseSummaryJson(data.response || '');
};
