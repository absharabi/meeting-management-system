const fs = require('fs');
const func = `
export async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
`;
fs.appendFileSync('client/utils/pdfExport.ts', func);
