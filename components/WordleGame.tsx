"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Mode = "menu" | "play" | "finder";
type LetterTone = 0 | 1 | 2 | 3; // unused, absent, present, correct

type Stats = [{ [key: string]: number }, number, number];

const DEFAULT_STATS: Stats = [
  { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
  0,
  0,
];
const STATS_KEY = "wordle-cli-stats";
const ROWS = 6;

function parseWordList(text: string, wordLength: number) {
  return text
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length === wordLength && w !== "hint");
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return structuredClone(DEFAULT_STATS);
    const parsed = JSON.parse(raw) as Stats;
    if (!Array.isArray(parsed) || parsed.length !== 3) {
      return structuredClone(DEFAULT_STATS);
    }
    return parsed;
  } catch {
    return structuredClone(DEFAULT_STATS);
  }
}

function saveStats(stats: Stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function scoreGuess(guess: string, answer: string): LetterTone[] {
  const length = answer.length;
  const result: LetterTone[] = Array(length).fill(1);
  const remaining = answer.split("");

  for (let i = 0; i < length; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 3;
      remaining[i] = "";
    }
  }

  for (let i = 0; i < length; i++) {
    if (result[i] === 3) continue;
    const idx = remaining.indexOf(guess[i]);
    if (idx !== -1) {
      result[i] = 2;
      remaining[idx] = "";
    }
  }

  return result;
}

function updateKeyboard(
  alphabet: Record<string, LetterTone>,
  guess: string,
  answer: string
) {
  const next = { ...alphabet };
  for (let i = 0; i < guess.length; i++) {
    const letter = guess[i];
    if (!answer.includes(letter)) {
      next[letter] = 1;
      continue;
    }
    if (guess[i] === answer[i]) {
      next[letter] = 3;
    } else if (next[letter] !== 3) {
      next[letter] = 2;
    }
  }
  return next;
}

function emptyAlphabet(): Record<string, LetterTone> {
  return Object.fromEntries(
    "qwertyuiopasdfghjklzxcvbnm".split("").map((letter) => [letter, 0 as LetterTone])
  );
}

function filterFinderWords(
  words: string[],
  greys: string,
  yellows: string,
  greens: string
) {
  const greyLetters = greys.toLowerCase().replace(/[^a-z]/g, "").split("");

  const yellowLetters: Array<[string, string[]]> = [];
  if (yellows.trim()) {
    for (const token of yellows.toLowerCase().split(",")) {
      const clean = token.trim();
      if (!clean) continue;
      const letter = clean[0];
      const spots = clean.slice(1).split("").filter((ch) => /\d/.test(ch));
      yellowLetters.push([letter, spots]);
    }
  }

  const greenLetters: Array<[string, string]> = [];
  if (greens.trim()) {
    for (const token of greens.toLowerCase().split(",")) {
      const clean = token.trim();
      if (clean.length < 2) continue;
      greenLetters.push([clean[0], clean[1]]);
    }
  }

  return words.filter((word) => {
    for (const letter of word) {
      if (greyLetters.includes(letter)) return false;
    }

    for (const [letter, spots] of yellowLetters) {
      if (!word.includes(letter)) return false;
      for (const spot of spots) {
        if (word[Number(spot) - 1] === letter) return false;
      }
    }

    for (const [letter, spot] of greenLetters) {
      if (word[Number(spot) - 1] !== letter) return false;
    }

    return true;
  });
}

function StatsBlock({ stats }: { stats: Stats }) {
  const [buckets, wins, plays] = stats;
  const winPct = plays === 0 ? 0 : Math.round((wins / plays) * 100);
  const biggest = Math.max(0, ...Object.values(buckets));

  return (
    <div className="cli-block">
      <p className="cli-magenta">Statistics:</p>
      <p className="cli-yellow">
        Wins: {wins}. Plays: {plays}. Win Percentage: {winPct}%
      </p>
      {Object.keys(buckets)
        .sort((a, b) => Number(a) - Number(b))
        .map((score) => {
          const count = buckets[score] ?? 0;
          const bar = "@".repeat(count);
          const pad = " ".repeat(Math.max(0, biggest + 2 - count));
          return (
            <p className="cli-line" key={score}>
              {score}: {bar}
              {count > 0 ? `${pad}${count}` : ""}
            </p>
          );
        })}
    </div>
  );
}

function KeyboardLine({ alphabet }: { alphabet: Record<string, LetterTone> }) {
  const rows = [
    "qwertyuiop".split(""),
    "asdfghjkl".split(""),
    "zxcvbnm".split(""),
  ];

  return (
    <div className="cli-keyboard">
      {rows.map((row, index) => (
        <p className={`cli-line ${index === 2 ? "cli-indent" : ""}`} key={row.join("")}>
          {row.map((letter) => {
            const tone = alphabet[letter] ?? 0;
            const toneClass =
              tone === 1
                ? "cli-absent"
                : tone === 2
                  ? "cli-yellow"
                  : tone === 3
                    ? "cli-green"
                    : "";
            return (
              <span className={toneClass} key={letter}>
                {letter}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

export function WordleGame() {
  const [mode, setMode] = useState<Mode>("menu");
  const [wordLength, setWordLength] = useState<5 | 6>(5);
  const [words5, setWords5] = useState<string[]>([]);
  const [answers5, setAnswers5] = useState<string[]>([]);
  const [words6, setWords6] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [stats, setStats] = useState<Stats>(structuredClone(DEFAULT_STATS));

  const [answer, setAnswer] = useState("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [tones, setTones] = useState<LetterTone[][]>([]);
  const [alphabet, setAlphabet] = useState(emptyAlphabet);
  const [guessInput, setGuessInput] = useState("");
  const [playMessage, setPlayMessage] = useState("");
  const [done, setDone] = useState(false);

  const [greys, setGreys] = useState("");
  const [yellows, setYellows] = useState("");
  const [greens, setGreens] = useState("");
  const [finderResults, setFinderResults] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [answersRes, validRes, sixRes] = await Promise.all([
          fetch("/wordle/answers.txt"),
          fetch("/wordle/valid.txt"),
          fetch("/wordle/words-6.txt"),
        ]);
        const answers = parseWordList(await answersRes.text(), 5);
        const valid = parseWordList(await validRes.text(), 5);
        const six = parseWordList(await sixRes.text(), 6);
        if (cancelled) return;
        setAnswers5(answers);
        setWords5([...new Set([...answers, ...valid])]);
        setWords6(six);
        setStats(loadStats());
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setLoadError("Failed to fetch word lists.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const bank = wordLength === 6 ? words6 : words5;
  const validSet = useMemo(() => new Set(bank), [bank]);

  const startPlay = (length: 5 | 6) => {
    const pool = length === 6 ? words6 : answers5;
    const next = pool[Math.floor(Math.random() * pool.length)] ?? "";
    setWordLength(length);
    setAnswer(next);
    setGuesses([]);
    setTones([]);
    setAlphabet(emptyAlphabet());
    setGuessInput("");
    setDone(false);
    setPlayMessage("Start guessing!:");
    setMode("play");
  };

  const startFinder = (length: 5 | 6) => {
    setWordLength(length);
    setGreys("");
    setYellows("");
    setGreens("");
    setFinderResults(null);
    setMode("finder");
  };

  const recordResult = (guessCount: number) => {
    setStats((prev) => {
      const next: Stats = [
        { ...prev[0] },
        prev[1],
        prev[2] + 1,
      ];
      if (guessCount > 0) {
        next[0][String(guessCount)] = (next[0][String(guessCount)] ?? 0) + 1;
        next[1] += 1;
      }
      saveStats(next);
      return next;
    });
  };

  const submitGuess = (event?: FormEvent) => {
    event?.preventDefault();
    if (done || !answer) return;

    const guess = guessInput.trim().toLowerCase();
    if (guess.length !== wordLength) {
      setPlayMessage(`Invalid response, please enter a valid ${wordLength} letter word`);
      return;
    }
    if (guess === "cheat") {
      setPlayMessage(`The answer is ${answer}`);
      setGuessInput("");
      return;
    }
    if (guess === "hint") {
      const greysFromPlay = Object.entries(alphabet)
        .filter(([, tone]) => tone === 1)
        .map(([letter]) => letter)
        .join("");
      const yellowParts: string[] = [];
      const greenParts: string[] = [];
      guesses.forEach((past, row) => {
        past.split("").forEach((letter, col) => {
          const tone = tones[row]?.[col];
          if (tone === 3) greenParts.push(`${letter}${col + 1}`);
          if (tone === 2) yellowParts.push(`${letter}${col + 1}`);
        });
      });
      const remaining = filterFinderWords(
        [...validSet],
        greysFromPlay,
        yellowParts.join(","),
        greenParts.join(",")
      );
      setPlayMessage(
        `hint candidates (${remaining.length}): ${remaining.slice(0, 40).join(", ")}${remaining.length > 40 ? "…" : ""}`
      );
      setGuessInput("");
      return;
    }
    if (!validSet.has(guess)) {
      setPlayMessage(`Invalid response, please enter a valid ${wordLength} letter word`);
      return;
    }

    const row = scoreGuess(guess, answer);
    const nextGuesses = [...guesses, guess];
    const nextTones = [...tones, row];
    setGuesses(nextGuesses);
    setTones(nextTones);
    setAlphabet((prev) => updateKeyboard(prev, guess, answer));
    setGuessInput("");

    if (guess === answer) {
      setDone(true);
      setPlayMessage("Way to go!");
      recordResult(nextGuesses.length);
      return;
    }

    if (nextGuesses.length >= ROWS) {
      setDone(true);
      setPlayMessage(`Try again next time. The answer was ${answer}`);
      recordResult(0);
      return;
    }

    setPlayMessage("Start guessing!:");
  };

  const runFinder = (event: FormEvent) => {
    event.preventDefault();
    const results = filterFinderWords(bank, greys, yellows, greens);
    setFinderResults(results);
  };

  if (loading) {
    return <div className="cli-terminal">Loading word lists…</div>;
  }

  if (loadError) {
    return <div className="cli-terminal cli-red">{loadError}</div>;
  }

  return (
    <div className="cli-terminal">
      {mode === "menu" ? (
        <div className="cli-block">
          <p className="cli-red">
            Would you like to play normal wordle or use a word finder? For the
            finder, enter &apos;f&apos;:
          </p>
          <div className="cli-actions">
            <button type="button" className="cli-btn" onClick={() => startPlay(5)}>
              play (5)
            </button>
            <button type="button" className="cli-btn" onClick={() => startPlay(6)}>
              play (6)
            </button>
            <button type="button" className="cli-btn" onClick={() => startFinder(5)}>
              f · finder (5)
            </button>
            <button type="button" className="cli-btn" onClick={() => startFinder(6)}>
              f · finder (6)
            </button>
          </div>
          <StatsBlock stats={stats} />
        </div>
      ) : null}

      {mode === "play" ? (
        <div className="cli-block">
          <p className="cli-green">
            Welcome to Wordle! Try and guess a random {wordLength} letter-word in
            6 guesses.
          </p>
          <p className="cli-blue">
            Just enter any {wordLength} letter word, and the letters will be
            colored with the following hints:
          </p>
          <p className="cli-line">
            <span className="cli-green">@</span> - letter is in the correct spot
          </p>
          <p className="cli-line">
            <span className="cli-yellow">@</span> - letter is not in the correct
            spot but is in the word
          </p>
          <p className="cli-line">
            <span className="cli-absent">@</span> - letter is not in the word
          </p>

          <KeyboardLine alphabet={alphabet} />

          <div className="cli-guesses">
            {guesses.map((guess, row) => (
              <p className="cli-line" key={`${guess}-${row}`}>
                {guess.split("").map((letter, col) => {
                  const tone = tones[row]?.[col] ?? 0;
                  const toneClass =
                    tone === 1
                      ? "cli-absent"
                      : tone === 2
                        ? "cli-yellow"
                        : tone === 3
                          ? "cli-green"
                          : "";
                  return (
                    <span className={toneClass} key={`${col}-${letter}`}>
                      {letter}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>

          <p className={done ? "cli-blue" : "cli-blue"}>{playMessage}</p>

          {!done ? (
            <form className="cli-prompt" onSubmit={submitGuess}>
              <span className="cli-prompt-mark">&gt;</span>
              <input
                className="cli-input"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value.toLowerCase())}
                maxLength={wordLength}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                aria-label="Guess"
              />
              <button type="submit" className="cli-btn">
                enter
              </button>
            </form>
          ) : (
            <div className="cli-actions">
              <button type="button" className="cli-btn" onClick={() => startPlay(wordLength)}>
                play again
              </button>
              <button type="button" className="cli-btn" onClick={() => setMode("menu")}>
                menu
              </button>
            </div>
          )}

          {done ? <StatsBlock stats={stats} /> : null}
        </div>
      ) : null}

      {mode === "finder" ? (
        <div className="cli-block">
          <p className="cli-blue">
            Finder mode · {wordLength}-letter words · same criteria format as the
            CLI
          </p>
          <form className="cli-finder" onSubmit={runFinder}>
            <label className="cli-absent">
              Which letters aren&apos;t used in the word? (ex: oghxl)
              <input
                className="cli-input"
                value={greys}
                onChange={(e) => setGreys(e.target.value.toLowerCase())}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <label className="cli-yellow">
              Which letters are in the word but not in the correct spot? (ex:
              s24,t1,r3)
              <input
                className="cli-input"
                value={yellows}
                onChange={(e) => setYellows(e.target.value.toLowerCase())}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <label className="cli-green">
              Which letters are in the correct spot, AND which spot? (ex: a3,r4)
              <input
                className="cli-input"
                value={greens}
                onChange={(e) => setGreens(e.target.value.toLowerCase())}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <div className="cli-actions">
              <button type="submit" className="cli-btn">
                find
              </button>
              <button type="button" className="cli-btn" onClick={() => setMode("menu")}>
                menu
              </button>
            </div>
          </form>

          {finderResults ? (
            <div className="cli-block">
              <p className="cli-magenta">{finderResults.join(", ") || "(none)"}</p>
              <p className="cli-blue">
                Number of possible answers: {finderResults.length}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
