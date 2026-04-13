export type ParseResult = {
  title: string;
  body: string;
};

export function parsePastedText(input: string): ParseResult {
  const normalized = String(input || "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return { title: "", body: "" };
  }

  const lines = normalized.split("\n").map((line) => line.trim());
  const firstNonEmptyIndex = lines.findIndex((line) => line.length > 0);

  if (firstNonEmptyIndex === -1) {
    return { title: "", body: "" };
  }

  const title = lines[firstNonEmptyIndex] || "無題";
  const body = lines.slice(firstNonEmptyIndex + 1).join("\n").trim();

  return {
    title,
    body: body || normalized,
  };
}

export async function parseFile(file: File): Promise<ParseResult> {
  const title = file.name.replace(/\.[^/.]+$/, "");

  if (file.type === "text/plain") {
    const body = await file.text();
    return { title, body };
  }

  if (file.type === "application/pdf") {
    const PDFJS = await import("pdfjs-dist");
    PDFJS.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${PDFJS.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = PDFJS.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      let lastY = -1;
      let pageText = "";
      for (const item of textContent.items as Array<{
        str?: string;
        transform: number[];
      }>) {
        if (!item.str) continue;

        const currentY = item.transform[5];
        if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
          pageText += "\n";
        } else if (
          lastY !== -1 &&
          pageText.length > 0 &&
          !pageText.endsWith(" ")
        ) {
          pageText += " ";
        }
        pageText += item.str;
        lastY = currentY;
      }

      text += pageText + "\n";
    }

    return { title, body: text };
  }

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx")
  ) {
    const arrayBuffer = await file.arrayBuffer();
    const JSZip = (await import("jszip")).default;

    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(arrayBuffer);
    const xml = await loadedZip.file("word/document.xml")?.async("text");

    if (!xml) {
      return { title, body: "DOCX解析に失敗しました" };
    }

    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const paragraphs = doc.getElementsByTagName("w:p");
    let text = "";

    const readNodeText = (node: Node): string => {
      const name = node.nodeName;
      if (name === "w:t") return node.textContent || "";
      if (name === "w:tab") return "\t";
      if (name === "w:br" || name === "w:cr") return "\n";

      let out = "";
      node.childNodes.forEach((child) => {
        out += readNodeText(child);
      });
      return out;
    };

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      text += readNodeText(paragraph);
      if (i < paragraphs.length - 1) {
        text += "\n";
      }
    }

    return { title, body: text || "DOCX解析に失敗しました" };
  }

  throw new Error(`未対応のファイル形式: ${file.type}`);
}
