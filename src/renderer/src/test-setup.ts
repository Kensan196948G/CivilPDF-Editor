import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

// Silence jsdom's "not implemented: getContext" warning for canvas tests.
// jsdom does not implement Canvas 2D API; tests that need rendering
// should mock page.render() / tile-cache / render-scheduler instead.
HTMLCanvasElement.prototype.getContext = () => null;

// auto-cleanup DOM between tests (vitest does not hook this automatically
// unless globals:true is set — so we do it explicitly here)
afterEach(() => cleanup());
