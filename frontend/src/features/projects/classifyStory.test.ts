import { describe, expect, it } from "vitest";
import type { StoryItem } from "../../api/client";
import { makeProject } from "../../test/fakeApi";
import { classifyStory, summarizeStories } from "./classifyStory";

const settings = makeProject().settings;

function story(
  latest: { score: number; verdict: string } | null,
  id = "s",
): StoryItem {
  return {
    id,
    project_id: "p1",
    title: id,
    description: "",
    notes: "",
    acceptance_criteria: [],
    created_at: "2026-10-23T12:00:00Z",
    latest_analysis: latest && {
      id: `a-${id}`,
      created_at: "2026-10-23T12:00:00Z",
      ...latest,
    },
  };
}

describe("classifyStory", () => {
  it("sin análisis es unanalyzed", () => {
    expect(classifyStory(story(null), settings)).toBe("unanalyzed");
  });

  it("respeta el veredicto del servidor", () => {
    expect(
      classifyStory(story({ score: 95, verdict: "not_ready" }), settings),
    ).toBe("blocking");
    expect(
      classifyStory(
        story({ score: 70, verdict: "ready_with_notes" }),
        settings,
      ),
    ).toBe("notes");
    expect(
      classifyStory(story({ score: 90, verdict: "ready" }), settings),
    ).toBe("ready");
  });

  it("con un veredicto desconocido usa los umbrales del proyecto", () => {
    const custom = { ...settings, not_ready_below: 40, ready_from: 70 };
    expect(classifyStory(story({ score: 39, verdict: "?" }), custom)).toBe(
      "blocking",
    );
    expect(classifyStory(story({ score: 40, verdict: "?" }), custom)).toBe(
      "notes",
    );
    expect(classifyStory(story({ score: 70, verdict: "?" }), custom)).toBe(
      "ready",
    );
  });
});

describe("summarizeStories", () => {
  it("promedia solo las historias analizadas y los totales suman", () => {
    const summary = summarizeStories(
      [
        story({ score: 50, verdict: "not_ready" }, "a"),
        story({ score: 70, verdict: "ready_with_notes" }, "b"),
        story({ score: 90, verdict: "ready" }, "c"),
        story(null, "d"),
      ],
      settings,
    );
    expect(summary.total).toBe(4);
    expect(summary.analyzed).toBe(3);
    expect(summary.meanScore).toBe(70);
    expect(summary.blockingPercent).toBe(33);
    const counts = Object.values(summary.counts);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it("sin historias analizadas no inventa cifras", () => {
    const summary = summarizeStories([story(null)], settings);
    expect(summary.meanScore).toBeNull();
    expect(summary.blockingPercent).toBeNull();
  });
});
