import { describe, expect, test } from "bun:test";
import { PANAS_ITEMS, countAnswered, isComplete, scorePanas, type PanasAnswers } from "../src/panas";
import { buildAnonymizedSurveysCsv } from "../src/surveys";
import { checkRateLimit } from "../src/rateLimit";
import {
  validateBirthDate,
  validateConfirm,
  validateCrm,
  validateEmail,
  validateName,
  validatePassword,
  validateSpecialty,
  validateUf,
} from "../src/authValidation";

describe("PANAS scale & scoring", () => {
  test("contains 10 positive and 10 negative items", () => {
    expect(PANAS_ITEMS).toHaveLength(20);
    expect(PANAS_ITEMS.filter(i => i.kind === "positive")).toHaveLength(10);
    expect(PANAS_ITEMS.filter(i => i.kind === "negative")).toHaveLength(10);
  });

  test("scores positive and negative affect independently from 10 to 50", () => {
    const answers: PanasAnswers = {};
    for (const item of PANAS_ITEMS) {
      answers[item.id] = item.kind === "positive" ? 5 : 1;
    }
    expect(isComplete(answers)).toBe(true);
    expect(countAnswered(answers)).toBe(20);
    expect(scorePanas(answers)).toEqual({ positive: 50, negative: 10 });
  });

  test("returns null when incomplete or out-of-range", () => {
    expect(scorePanas({ 1: 3 })).toBeNull();
    expect(countAnswered({ 1: 3, 2: 6, 3: 0 })).toBe(1);
  });
});

describe("Anonymized PANAS CSV export", () => {
  test("never leaks names or emails and properly escapes values", () => {
    const csv = buildAnonymizedSurveysCsv([
      {
        id: "r1",
        anonymousCode: "P-ABC123",
        instrument: "PANAS",
        sessionId: "s-1",
        moment: "before",
        answers: { "1": 4, "2": 2 },
        scorePositive: 35,
        scoreNegative: 15,
        scoreTotal: null,
        createdAt: "2026-11-24T20:00:00Z",
      },
    ]);
    const [header, row] = csv.split("\n");
    expect(header).toStartWith("codigo_participante,sessao,momento,data,");
    expect(header).not.toContain("email");
    expect(header).not.toContain("nome");
    expect(row).toContain("P-ABC123,s-1,antes,2026-11-24T20:00:00Z");
    expect(row?.endsWith(",35,15")).toBe(true);
  });
});

describe("Auth & signup validation", () => {
  test("validates names, emails, passwords, CRM, UF, specialty and birth date", () => {
    expect(validateName("Ana Silva")).toBeNull();
    expect(validateName("Ana")).not.toBeNull();

    expect(validateEmail("paciente@teste.com")).toBeNull();
    expect(validateEmail("invalido")).not.toBeNull();

    expect(validatePassword("Senha123")).toBeNull();
    expect(validatePassword("12345678")).not.toBeNull();
    expect(validatePassword("abcdefg")).not.toBeNull();

    expect(validateConfirm("Senha123", "Senha123")).toBeNull();
    expect(validateConfirm("Senha123", "Outra123")).not.toBeNull();

    expect(validateCrm("123456")).toBeNull();
    expect(validateCrm("12")).not.toBeNull();

    expect(validateUf("BA")).toBeNull();
    expect(validateUf("XX")).not.toBeNull();

    expect(validateSpecialty("Ansiedade e burnout")).toBeNull();
    expect(validateSpecialty("Qualquer")).not.toBeNull();

    expect(validateBirthDate("2000-01-15")).toBeNull();
    expect(validateBirthDate("2020-01-15")).not.toBeNull();
  });
});

describe("Rate limiter", () => {
  test("blocks after exceeding window limit", () => {
    const key = `test-limit-${Date.now()}`;
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    const third = checkRateLimit(key, 2, 60_000);
    expect(third.allowed).toBe(false);
  });
});
