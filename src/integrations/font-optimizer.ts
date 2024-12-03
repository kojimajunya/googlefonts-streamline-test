import type { AstroIntegration } from "astro";
import { promises as fs } from "fs";
import { JSDOM } from "jsdom";

const limitChars = 1000;

export default (): AstroIntegration => ({
  name: "font-optimizer",
  hooks: {
    "astro:build:done": async ({ routes }) => {
      for (const route of routes) {
        try {
          const filePath = route.distURL?.pathname;

          // htmlファイルにのみ処理を開始
          if (filePath && filePath.endsWith(".html")) {
            const htmlContent = await fs.readFile(filePath, "utf-8");

            // JSOMでhtmlをパース
            const dom = new JSDOM(htmlContent);
            const document = dom.window.document;

            // html内のテキストを抽出し、URLエンコードする
            const { uniqueText, encodedText } =
              await extractBodyTextAndEncode(filePath);

            // URLエンコード前の文字数が制限を超える場合は処理をスキップ
            if (uniqueText.length > limitChars) {
              console.warn(
                `Skipped processing ${filePath} because text length exceeds characters limit.`
              );
              continue;
            }

            const linkTag = document.querySelector(
              'link[href*="https://fonts.googleapis.com/css2?family="]'
            );

            // Google Fontsの<link>タグが見つかった場合の処理
            if (linkTag) {
              // href属性の値を取得し、テキストのパラメータを更新する
              const originalHref = linkTag.getAttribute("href") || "";
              const newHref = originalHref.includes("&text=")
                ? originalHref.replace(/&text=.*$/, `&text=${encodedText}`)
                : `${originalHref}&text=${encodedText}`;
              linkTag.setAttribute("href", newHref);
            } else {
              console.warn(
                "The <link> tag for Google Fonts was not found:",
                filePath
              );
            }

            // ファイルを上書き保存
            await fs.writeFile(filePath, dom.serialize(), "utf-8");
            console.log(`Processed and saved: ${filePath}`);
          }
        } catch (error) {
          console.error(
            `Error processing route ${route.distURL?.pathname}:`,
            error
          );
        }
      }
    },
  },
});

/**
 * Reads an HTML file, removes <script> tags, extracts unique characters from the <body> tag, and URL encodes the result.
 * @param filePath - Path to the HTML file
 * @returns Promise<{ uniqueText: string, encodedText: string }>
 */
export const extractBodyTextAndEncode = async (
  filePath: string
): Promise<{ uniqueText: string; encodedText: string }> => {
  try {
    const data = await fs.readFile(filePath, "utf-8");

    const dom = new JSDOM(data);
    const body = dom.window.document.body;

    if (!body) {
      throw new Error("No <body> tag found in the HTML file.");
    }

    // <script>タグの除外
    const scriptTags = body.querySelectorAll("script");
    scriptTags.forEach((script) => script.remove());

    // body内のテキストを取得し、前後の空白を削除
    const textContent = body.textContent?.trim() ?? "";

    // 全角スペースと半角スペースを削除
    const cleanedText = textContent.replace(/[\s\u3000]+/g, "");

    // ユニークな文字のみを抽出
    const uniqueText = Array.from(new Set(cleanedText)).join("");

    // URLエンコード
    const encodedText = encodeURIComponent(uniqueText);

    return { uniqueText, encodedText };
  } catch (error) {
    throw new Error(
      `Error processing file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
