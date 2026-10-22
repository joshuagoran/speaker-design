// A name the user typed shows as typed in marked UI text: its asterisks make no mark and do not go away.
import { expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { literal, MarkedText, plainText } from "../src/components/ui/MarkedText";
import { SPACE_TEXT } from "../src/constants/space";

const NAME = "A**B**C";

test("a typed name keeps its asterisks in marked text", () => {
  const html = renderToStaticMarkup(
    createElement(MarkedText, { text: SPACE_TEXT.limitsSystem("Low", literal(NAME)) }),
  );
  expect(html).toContain(`<span class="font-semibold">${NAME}</span>`);
  expect(html).toContain('<span class="font-semibold">Low</span>');
  expect(plainText(`1. ${literal(NAME)}`)).toBe(`1. ${NAME}`);
});
