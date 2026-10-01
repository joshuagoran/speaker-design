/** Small boxed message. */
export function Notice({ children }) {
  return (
    <div className="mt-2 text-xs text-amber-800 bg-amber-50 rounded border-l-4 border-amber-300 px-2 py-1">
      {children}
    </div>
  );
}
