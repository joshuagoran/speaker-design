/** Hands the viewer a text file to save (a CSV export): a link to it, clicked once, then let go. */
export function downloadText(fileName: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  // after the click has started the download
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
