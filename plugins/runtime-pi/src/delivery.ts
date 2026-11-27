// submit_delivery parameters (docs/06 §5.4, §5.7), S1 subset.
// Shared by the in-container Pi extension (declares the tool) and the host (validates the call).
// Facts such as changed files and commit SHAs are never taken from the model; the host fills them in.
import { Type, type Static } from 'typebox';

export const SubmitDeliveryParams = Type.Object({
  root_cause: Type.String({
    minLength: 1,
    description: 'Where the bug comes from: file, function and what was wrong.',
  }),
  summary: Type.String({ minLength: 1, description: 'What you changed and why it fixes the bug.' }),
  repro_tests: Type.Array(Type.String({ minLength: 1 }), {
    minItems: 1,
    description:
      'Test files you wrote that reproduce the bug: they fail before your fix and pass after it. ' +
      'Paths relative to /work, e.g. demo-web/src/pages/x/y.test.ts.',
  }),
  verification: Type.String({
    minLength: 1,
    description: 'Commands you ran to verify (tests, typecheck) and their results.',
  }),
});

export type SubmitDelivery = Static<typeof SubmitDeliveryParams>;

export const SUBMIT_DELIVERY = 'submit_delivery';
