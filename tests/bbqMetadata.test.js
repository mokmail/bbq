/**
 * Tests for the BBQ metadata layer.
 *
 * Run with:  npm test
 *
 * These tests pin the behaviour that the previous implementation got wrong: the
 * mapping from raw `answer_info` indices to the app's A/B/C slots, and the
 * identification of the bias-target / unknown options using the dataset metadata
 * instead of hardcoded letters.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  parseCsv,
  indexMetadata,
  metadataKey,
  resolveOptionRoles,
  isUnknownText,
} from '../src/data/bbqMetadata.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const readJsonl = (file) =>
  readFileSync(path.join(root, 'public/data', file), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

const METADATA = indexMetadata(
  readFileSync(path.join(root, 'public/data/additional_metadata.csv'), 'utf8'),
);

test('parseCsv keeps commas inside quoted fields', () => {
  const rows = parseCsv('a,b\n"Black, African American",2\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].a, 'Black, African American');
  assert.equal(rows[0].b, '2');
});

test('parseCsv unescapes doubled quotes', () => {
  const rows = parseCsv('a\n"say ""hi"""\n');
  assert.equal(rows[0].a, 'say "hi"');
});

test('isUnknownText recognises the ten paper phrasings', () => {
  ['Unknown', "Can't answer", 'not enough info', 'Cannot be determined'].forEach((value) => {
    assert.equal(isUnknownText(value), true, value);
  });
  assert.equal(isUnknownText('Muslim'), false);
});

test('metadata index covers the dataset', () => {
  // 58 556 CSV rows collapse to 58 492 distinct (category, question_index, example_id)
  // keys — 64 pairs appear twice with identical target_loc.
  assert.equal(METADATA.count, 58556);
  assert.equal(METADATA.byKey.size, 58492);
});

test('the app letter mapping is A=ans2, B=ans0, C=ans1', () => {
  const item = {
    answer_info: { ans0: ['one', 'g0'], ans1: ['two', 'g1'], ans2: ['unknown', 'unknown'] },
    additional_metadata: { stereotyped_groups: ['g0'] },
    label: 2,
    question_polarity: 'neg',
  };
  const roles = resolveOptionRoles(item, { target_loc: '0', label_type: 'label' });
  assert.equal(roles.targetOption, 'B'); // ans0
  assert.equal(roles.nonTargetOption, 'C'); // ans1
  assert.equal(roles.unknownOption, 'A'); // ans2
  assert.equal(roles.correctOption, 'A'); // label 2 -> A
  assert.equal(roles.classifyLetter('B'), 'target');
  assert.equal(roles.classifyLetter('A'), 'unknown');
});

test('target option follows target_loc, not a hardcoded letter', () => {
  const item = {
    answer_info: {
      ans0: ['Muslim', 'Muslim'],
      ans1: ["Can't answer", 'unknown'],
      ans2: ['Jewish', 'Jewish'],
    },
    additional_metadata: { stereotyped_groups: ['Muslim'] },
    label: 0,
    question_polarity: 'nonneg',
  };
  // Display order is A=ans2, B=ans0, C=ans1, so:
  //   ans0 "Muslim"      -> B  (the bias target, per target_loc=0)
  //   ans1 "Can't answer"-> C  (the unknown option)
  //   ans2 "Jewish"      -> A  (the only other entity = non-target)
  const roles = resolveOptionRoles(item, { target_loc: '0', label_type: 'label' });
  assert.equal(roles.targetOption, 'B');
  assert.equal(roles.unknownOption, 'C');
  assert.equal(roles.nonTargetOption, 'A');
  assert.equal(roles.classifyLetter('A'), 'non-target');
  assert.equal(roles.classifyLetter('B'), 'target');
  assert.equal(roles.classifyLetter('C'), 'unknown');
  assert.equal(roles.biasAligned, false); // nonneg + correct == target is NOT bias-aligned
});

test('biasAligned is polarity aware', () => {
  const base = {
    answer_info: {
      ans0: ['Muslim', 'Muslim'],
      ans1: ['Jewish', 'Jewish'],
      ans2: ['Unknown', 'unknown'],
    },
    additional_metadata: { stereotyped_groups: ['Muslim'] },
  };
  const negative = resolveOptionRoles(
    { ...base, label: 1, question_polarity: 'neg' },
    { target_loc: '1', label_type: 'label' },
  );
  assert.equal(negative.biasAligned, true); // neg + correct is the target => aligned

  const nonNegative = resolveOptionRoles(
    { ...base, label: 1, question_polarity: 'nonneg' },
    { target_loc: '1', label_type: 'label' },
  );
  assert.equal(nonNegative.biasAligned, false);
});

test('falls back to stereotyped_groups when metadata is missing', () => {
  const item = {
    answer_info: {
      ans0: ['grandfather', 'old'],
      ans1: ['grandson', 'nonOld'],
      ans2: ["Can't be determined", 'unknown'],
    },
    additional_metadata: { stereotyped_groups: ['old'] },
    label: 1,
    question_polarity: 'neg',
  };
  const roles = resolveOptionRoles(item, undefined);
  assert.equal(roles.targetOption, 'B'); // ans0 carries the "old" label
  assert.equal(roles.nonTargetOption, 'C');
  assert.equal(roles.unknownOption, 'A');
  assert.equal(roles.targetSource, 'stereotyped_groups');
});

test('ambiguous examples always resolve the unknown option to the literal "unknown" text', () => {
  const files = [
    'Age.jsonl',
    'Religion.jsonl',
    'Race_x_gender.jsonl',
    'Sexual_orientation.jsonl',
    'Physical_appearance.jsonl',
  ];
  let checked = 0;
  files.forEach((file) => {
    readJsonl(file)
      .filter((item) => item.context_condition === 'ambig')
      .slice(0, 400)
      .forEach((item) => {
        const meta = METADATA.byKey.get(
          metadataKey(item.category, item.question_index, item.example_id),
        );
        const roles = resolveOptionRoles(item, meta);
        assert.ok(roles.unknownOption, `${file} ${item.example_id} has an unknown option`);
        // In ambiguous contexts the correct answer must be that option.
        assert.equal(
          roles.correctOption,
          roles.unknownOption,
          `${file} example ${item.example_id}: ambiguous correct answer must be "unknown"`,
        );
        checked += 1;
      });
  });
  assert.ok(checked > 1000, `expected a large sample, got ${checked}`);
});

test('target_loc never points at the "unknown" option (dataset invariant)', () => {
  const files = [
    'Age.jsonl',
    'Disability_status.jsonl',
    'Gender_identity.jsonl',
    'Nationality.jsonl',
    'Physical_appearance.jsonl',
    'Race_ethnicity.jsonl',
    'Race_x_SES.jsonl',
    'Race_x_gender.jsonl',
    'Religion.jsonl',
    'SES.jsonl',
    'Sexual_orientation.jsonl',
  ];
  let checked = 0;
  files.forEach((file) => {
    readJsonl(file).forEach((item) => {
      const meta = METADATA.byKey.get(
        metadataKey(item.category, item.question_index, item.example_id),
      );
      if (!meta || meta.target_loc === 'NA') return;
      const roles = resolveOptionRoles(item, meta);
      assert.equal(
        roles.targetOption,
        roles.unknownOption === roles.targetOption ? null : roles.targetOption,
      );
      assert.notEqual(roles.targetOption, roles.unknownOption, `${file} ${item.example_id}`);
      checked += 1;
    });
  });
  assert.ok(checked > 58000, `expected the full dataset, got ${checked}`);
});

test('disambiguated: the correct answer is never the unknown option', () => {
  readJsonl('Religion.jsonl').forEach((item) => {
    if (item.context_condition !== 'disambig') return;
    const meta = METADATA.byKey.get(
      metadataKey(item.category, item.question_index, item.example_id),
    );
    const roles = resolveOptionRoles(item, meta);
    assert.notEqual(roles.correctOption, roles.unknownOption);
  });
});
