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
You are an assistant for a meeting management system.
Summarize the transcript and return ONLY valid JSON in this exact shape:
{
  "summary": "short paragraph",
  "keyPoints": ["point"],
  "decisions": ["decision"],
  "actionItems": [{ "task": "task", "owner": "owner if mentioned otherwise Unassigned", "deadline": "deadline if mentioned otherwise Not mentioned" }],
  "risks": ["risk or blocker"]
}

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
