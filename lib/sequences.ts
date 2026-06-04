/**
 * Pitch sequence cadence. A sequence is a fixed series of touches sent to a
 * press contact about a film. Step state is *derived* from existing send data —
 * we don't store sequence rows. The step a contact is on === how many pitch
 * emails they've received for that film; a reply ends the sequence.
 */

export type SequenceStep = {
  /** Days after the *previous* step that this one becomes due (step 0 = day 0). */
  dayOffset: number;
  label: string;
  subject: string;
  body: string;
};

export const SEQUENCE_STEPS: SequenceStep[] = [
  {
    dayOffset: 0,
    label: "Initial pitch",
    subject: "{{film_title}} — would love your coverage",
    body: `Hi {{first_name}},

I'm reaching out about {{film_title}} and thought it might be a great fit for you.

You can watch the screener here: {{screener_url}}
Press kit: {{press_kit_url}}

Would you be interested in taking a look? Happy to answer any questions.

Thanks so much,`,
  },
  {
    dayOffset: 4,
    label: "Nudge",
    subject: "Re: {{film_title}}",
    body: `Hi {{first_name}},

Just floating this back to the top of your inbox — wanted to make sure my note about {{film_title}} reached you.

The screener's still right here whenever you have a moment: {{screener_url}}

No worries at all if it's not a fit — just let me know either way!

Thanks,`,
  },
  {
    dayOffset: 5,
    label: "Last call",
    subject: "One last note on {{film_title}}",
    body: `Hi {{first_name}},

I know inboxes get busy, so this is my last nudge on {{film_title}}. If you'd like the screener or any materials, just reply and I'll send everything over.

Screener: {{screener_url}}

Either way, thanks so much for your time!`,
  },
];

export type SequenceState = {
  /** Index of the next step to send, or null if the sequence is complete. */
  nextStepIndex: number | null;
  /** Whether the next step is due now (vs. waiting out the interval). */
  due: boolean;
  /** When the next step becomes due, if waiting. */
  dueAt: Date | null;
  sentCount: number;
  lastSentAt: Date | null;
  replied: boolean;
  done: boolean;
  doneReason: "replied" | "exhausted" | null;
};

const DAY_MS = 86_400_000;

export function computeSequenceState(input: {
  sentCount: number;
  lastSentAt: Date | null;
  replied: boolean;
  now?: Date;
}): SequenceState {
  const now = input.now ?? new Date();
  const { sentCount, lastSentAt, replied } = input;

  if (replied) {
    return {
      nextStepIndex: null,
      due: false,
      dueAt: null,
      sentCount,
      lastSentAt,
      replied,
      done: true,
      doneReason: "replied",
    };
  }

  // Sequence finished once every step has been sent.
  if (sentCount >= SEQUENCE_STEPS.length) {
    return {
      nextStepIndex: null,
      due: false,
      dueAt: null,
      sentCount,
      lastSentAt,
      replied,
      done: true,
      doneReason: "exhausted",
    };
  }

  const nextStepIndex = sentCount;

  // First touch is always due immediately.
  if (sentCount === 0 || !lastSentAt) {
    return {
      nextStepIndex,
      due: true,
      dueAt: now,
      sentCount,
      lastSentAt,
      replied,
      done: false,
      doneReason: null,
    };
  }

  const intervalDays =
    SEQUENCE_STEPS[nextStepIndex].dayOffset; // days to wait after the last send
  const dueAt = new Date(lastSentAt.getTime() + intervalDays * DAY_MS);
  return {
    nextStepIndex,
    due: now.getTime() >= dueAt.getTime(),
    dueAt,
    sentCount,
    lastSentAt,
    replied,
    done: false,
    doneReason: null,
  };
}
