import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

// auto-cleanup DOM between tests (vitest does not hook this automatically
// unless globals:true is set — so we do it explicitly here)
afterEach(() => cleanup());
