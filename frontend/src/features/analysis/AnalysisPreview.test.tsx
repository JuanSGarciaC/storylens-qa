import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { AnalysisPreview } from "./AnalysisPreview";

describe("AnalysisPreview", () => {
  it("sin animación (jsdom, como con reduced-motion) muestra el estado final completo", async () => {
    const { container } = render(<AnalysisPreview />);
    expect(
      screen.getByRole("figure", {
        name: "Así revisa StoryLens la historia de ejemplo",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("46")).toBeInTheDocument();
    expect(screen.getByText("US-AMB-001")).toBeInTheDocument();
    expect(container.querySelector(".preview--animated")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Repetir el ejemplo" }),
    ).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });
});
