/**
 * useFilter hook — re-exported from filterContext for convenience.
 * Consumers should import from this file to avoid fast-refresh issues
 * with non-component exports in the same file as a component.
 */

import { useContext } from "react";
import { FilterContext } from "./filterContextValue";

export const useFilter = () => {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    // In development builds React's component stack is appended to the error
    // message automatically by the nearest ErrorBoundary, so the component
    // name is already visible in the console. We add a direct link to the
    // fix so it is obvious without digging through the stack trace.
    throw new Error(
      "useFilter() was called outside a <GlobalFilterProvider>.\n" +
        "Wrap the officer route subtree with <GlobalFilterProvider> in AppRouter.tsx.\n" +
        "Check: (1) filterContext.tsx exports a valid React component, " +
        "(2) the import resolves to the same module as filterContextValue.ts.",
    );
  }
  return ctx;
};
