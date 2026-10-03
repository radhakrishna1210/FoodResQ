import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, EyeOff, ShieldAlert, Star } from 'lucide-react';
import { useAllocation, useFeedback, useSubmitFeedback } from '@/hooks/queries';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Textarea, Toggle } from '@/components/ui/Form';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState, InlineError } from '@/components/ui/ErrorState';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/misc';
import { FileUpload } from '@/components/profile/FileUpload';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import type { Feedback, FeedbackInput } from '@/types';

type YesNo = boolean | null;

const DONOR_QUESTIONS = [
  { key: 'on_time', label: 'Did the Receiver arrive on time?' },
  { key: 'professional', label: 'Were they professional and courteous?' },
  { key: 'proper_containers', label: 'Did they bring proper containers?' },
] as const;
const RECEIVER_QUESTIONS = [
  { key: 'quantity_matched', label: 'Did the quantity match the post?' },
  { key: 'fresh_on_arrival', label: 'Was the food fresh on arrival?' },
  { key: 'properly_packed', label: 'Was the food properly packed?' },
] as const;

const ALL_QUESTIONS = [...DONOR_QUESTIONS, ...RECEIVER_QUESTIONS];

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: YesNo;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cn(
              'h-9 min-w-[64px] rounded-lg border px-3 text-sm font-medium transition-colors',
              value === v
                ? v
                  ? 'border-green bg-green-50 text-green-700'
                  : 'border-red bg-red-50 text-red-700'
                : 'border-line bg-white text-slate-700 hover:border-slate/40',
            )}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedbackView({ f, title }: { f: Feedback; title: string }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={formatDateTime(f.created_at)} />
      <CardBody className="space-y-3">
        <StarRating value={f.overall_rating} size={20} />
        <ul className="space-y-1 text-sm">
          {ALL_QUESTIONS.filter((q) => f[q.key] !== null && f[q.key] !== undefined).map((q) => (
            <li key={q.key} className="flex justify-between gap-3">
              <span className="text-slate">{q.label}</span>
              <span
                className={f[q.key] ? 'font-medium text-green-700' : 'font-medium text-red-700'}
              >
                {f[q.key] ? 'Yes' : 'No'}
              </span>
            </li>
          ))}
        </ul>
        {f.comment && <p className="rounded-lg bg-bg px-3 py-2 text-sm text-ink">{f.comment}</p>}
        {f.safety_issue && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-red-700">
            <ShieldAlert size={16} aria-hidden /> Food-safety issue reported
          </p>
        )}
      </CardBody>
    </Card>
  );
}

export default function FeedbackPage() {
  const { id = '' } = useParams();
  const { role, user } = useAuth();
  const alloc = useAllocation(id);
  const visible = useFeedback(id);
  const submit = useSubmitFeedback(id);
  const toast = useToast();

  const [rating, setRating] = useState(0);
  const [answers, setAnswers] = useState<Record<string, YesNo>>({});
  const [comment, setComment] = useState('');
  const [safetyIssue, setSafetyIssue] = useState(false);
  const [photoPath, setPhotoPath] = useState<string | null>(null);

  if (alloc.isLoading) return <PageSpinner />;
  if (alloc.isError || !alloc.data)
    return <ErrorState error={alloc.error} onRetry={() => void alloc.refetch()} />;
  const a = alloc.data;
  const isReceiver = role === 'receiver';
  const otherName = isReceiver ? a.donor_org_name : a.receiver_org_name;
  const questions = isReceiver ? RECEIVER_QUESTIONS : DONOR_QUESTIONS;
  const backTo = isReceiver ? `/receiver/pickups/${a.id}` : `/donor/donations/${a.donation_id}`;
  const v = visible.data;
  // Parties get the blind view {mine, theirs, …}; Admins get {items} (§13.3).
  const all = v && 'items' in v ? v.items : [];
  const mine =
    (v && 'mine' in v ? v.mine : all.find((f) => f.from_user_id === user?.id)) ?? undefined;
  const theirs =
    (v && 'theirs' in v ? v.theirs : all.find((f) => f.from_user_id !== user?.id)) ?? undefined;
  const submitted = a.feedback_submitted_by_me || Boolean(mine) || submit.isSuccess;
  const windowClosed =
    v?.window_closed ??
    (a.completed_at ? Date.now() - new Date(a.completed_at).getTime() > 24 * 3600_000 : false);

  const commentTooShort = safetyIssue && comment.trim().length < 10;
  const canSubmit = rating >= 1 && !commentTooShort;

  const onSubmit = () => {
    const body: FeedbackInput = { overall_rating: rating, comment: comment.trim() || null };
    for (const q of questions) body[q.key] = answers[q.key] ?? null;
    if (isReceiver) {
      body.safety_issue = safetyIssue;
      body.photo_path = safetyIssue ? photoPath : null;
    }
    submit.mutate(body, {
      onSuccess: () => toast({ title: 'Thanks for your feedback', tone: 'success' }),
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden /> Back
      </Link>
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Feedback for {otherName}</h1>
        <p className="mt-1 text-sm text-slate">
          {a.donation?.title} · {a.servings} servings
        </p>
      </div>
      <p className="flex items-start gap-2 rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
        <EyeOff size={16} className="mt-0.5 shrink-0" aria-hidden />
        Your feedback is shared after both sides submit, or after 24 hours.
      </p>

      {a.status !== 'COMPLETED' ? (
        <ErrorState
          error={new Error('Feedback opens after the rescue is completed.')}
          title="Not yet"
        />
      ) : submitted ? (
        <div className="space-y-4">
          <div className="card flex items-center gap-3 p-4">
            <CheckCircle2 className="text-green" aria-hidden />
            <p className="text-sm font-medium text-ink">You have submitted your feedback.</p>
          </div>
          {mine && <FeedbackView f={mine} title="Your feedback" />}
          {theirs ? (
            <FeedbackView f={theirs} title={`Feedback from ${otherName}`} />
          ) : (
            <p className="text-sm text-slate">Waiting for {otherName}&apos;s feedback.</p>
          )}
        </div>
      ) : windowClosed ? (
        <div className="space-y-4">
          <ErrorState
            error={new Error('The 24-hour feedback window has closed.')}
            title="Feedback closed"
          />
          {theirs && <FeedbackView f={theirs} title={`Feedback from ${otherName}`} />}
        </div>
      ) : (
        <form
          className="card space-y-5 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }}
          noValidate
        >
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
              <Star size={16} className="text-gold" aria-hidden /> Overall rating{' '}
              <span className="text-red">*</span>
            </p>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div className="space-y-3 border-t border-line pt-4">
            {questions.map((q) => (
              <YesNoField
                key={q.key}
                label={q.label}
                value={answers[q.key] ?? null}
                onChange={(v) => setAnswers((s) => ({ ...s, [q.key]: v }))}
              />
            ))}
          </div>
          {isReceiver && (
            <div
              className={cn(
                'rounded-card border p-4',
                safetyIssue ? 'border-red/40 bg-red-50/50' : 'border-line',
              )}
            >
              <Toggle
                tone="red"
                checked={safetyIssue}
                onChange={setSafetyIssue}
                label="Report a food-safety issue"
                description="The FoodResQ team reviews every report."
              />
              {safetyIssue && (
                <div className="mt-4">
                  <Field label="Photo" hint="Optional">
                    <FileUpload
                      bucket="feedback-photos"
                      allocationId={a.id}
                      accept="image/jpeg,image/png,image/webp"
                      label="Add a photo"
                      value={photoPath}
                      onUploaded={setPhotoPath}
                      onClear={() => setPhotoPath(null)}
                      image
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
          <Field
            label={safetyIssue ? 'Describe the safety issue' : 'Comment'}
            htmlFor="fb-comment"
            hint={
              safetyIssue ? 'Required · at least 10 characters' : 'Optional · up to 500 characters'
            }
            error={
              commentTooShort && comment.length > 0
                ? 'Please describe the issue (at least 10 characters)'
                : undefined
            }
            required={safetyIssue}
          >
            <Textarea
              id="fb-comment"
              maxLength={500}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <InlineError error={submit.error} />
          <Button type="submit" size="lg" block disabled={!canSubmit} loading={submit.isPending}>
            Submit feedback
          </Button>
        </form>
      )}
    </div>
  );
}
