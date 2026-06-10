const fs = require('fs');
const p = 'c:/Users/hadya/OneDrive/Documents/web dev - internship/meeting-management-system/client/utils/pdfExport.ts';
let content = fs.readFileSync(p, 'utf8');

// Normalize line endings to LF for easier replacing
content = content.replace(/\r\n/g, '\n');

// PDF - Agenda Comments
const pdfCommentsSearch = '        if (resolutionBlock) {\n          rows.push(["Resolution", stripHtml(String(resolutionBlock.value || ""))]);\n        }';
const pdfCommentsReplace = `        if (resolutionBlock) {
          rows.push(["Resolution", stripHtml(String(resolutionBlock.value || ""))]);
        }
        if (item.comments && item.comments.length > 0) {
          const commentsStr = item.comments.map(c => \`[\${c.userName}]: \${c.text}\`).join('\\n');
          rows.push(["Comments", stripHtml(commentsStr)]);
        }`;

content = content.replace(pdfCommentsSearch, pdfCommentsReplace);

// PDF - General Remarks
const pdfRemarksSearch = '  y = ensureSpace(doc, y, 120, meeting);\n  doc.setFont("times", "normal");\n  doc.setFontSize(10);\n  doc.setTextColor(25, 35, 50);\n  doc.text("The meeting ended with thanks to the Chair.", margin, y);';
const pdfRemarksReplace = `  if (meeting.momGeneralRemarks && meeting.momGeneralRemarks.length > 0) {
    y = ensureSpace(doc, y, 60, meeting);
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 35, 60);
    doc.text("General Remarks", margin, y);
    y += 15;
    
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.setTextColor(25, 35, 50);
    
    meeting.momGeneralRemarks.forEach(remark => {
      y = ensureSpace(doc, y, 30, meeting);
      doc.setFont("times", "bold");
      doc.text(\`\${remark.userName} (\${new Date(remark.createdAt).toLocaleString()}):\`, margin, y);
      y += 12;
      doc.setFont("times", "normal");
      const splitText = doc.splitTextToSize(remark.text || "", pageWidth - margin * 2);
      doc.text(splitText, margin, y);
      y += splitText.length * 12 + 8;
    });
  }

  y = ensureSpace(doc, y, 120, meeting);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(25, 35, 50);
  doc.text("The meeting ended with thanks to the Chair.", margin, y);`;

content = content.replace(pdfRemarksSearch, pdfRemarksReplace);

// Word - Agenda Comments
const wordCommentsSearch = '            </tr>\n            ` : ""}\n          </table>';
const wordCommentsReplace = `            </tr>
            \` : ""}
            \${item.comments && item.comments.length > 0 ? \`
              <tr>
                <td class="bog-left">Comments</td>
                <td>\${escapeHtml(item.comments.map(c => \`[\${c.userName}]: \${c.text}\`).join('\\n')).replace(/\\n/g, "<br>")}</td>
              </tr>
            \` : ""}
          </table>`;

content = content.replace(wordCommentsSearch, wordCommentsReplace);

// Word - General Remarks
const wordRemarksSearch = '        ${agendaHtml || "<p>No agenda items recorded.</p>"}\n        <p style="text-align: center; margin-top: 36pt;">The meeting ended with thanks to the Chair.</p>';
const wordRemarksReplace = `        \${agendaHtml || "<p>No agenda items recorded.</p>"}
        \${meeting.momGeneralRemarks && meeting.momGeneralRemarks.length > 0 ? \`
          <h2>General Remarks</h2>
          <table class="bog-table">
            <tr><th style="width: 25%">User</th><th style="width: 20%">Date</th><th>Remark</th></tr>
            \${meeting.momGeneralRemarks.map(remark => \`
              <tr>
                <td style="font-weight: bold;">\${escapeHtml(remark.userName)}</td>
                <td>\${new Date(remark.createdAt).toLocaleString()}</td>
                <td>\${escapeHtml(remark.text || "").replace(/\\n/g, "<br>")}</td>
              </tr>
            \`).join("")}
          </table>
        \` : ""}
        <p style="text-align: center; margin-top: 36pt;">The meeting ended with thanks to the Chair.</p>`;

content = content.replace(wordRemarksSearch, wordRemarksReplace);

fs.writeFileSync(p, content);
console.log('Done patching pdfExport.ts');
