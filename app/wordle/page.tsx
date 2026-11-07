import type { Metadata } from "next";
import { WordleGame } from "@/components/WordleGame";

export const metadata: Metadata = {
  title: "Wordle",
};

export default function WordlePage() {
  return (
    <section>
      <h1 className="section-title">Wordle</h1>
      <p className="section-lead">
        Terminal-style port of my Python Wordle CLI — play mode plus the word
        finder, with the same prompts and color hints.
      </p>
      <WordleGame />
    </section>
  );
}
