import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { foodmeApi } from "@/api/foodme";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FullOrderDto, OrderListResponseDto } from "@/types";

const MAX_STARS = 5;
const MAX_COMMENT = 1000;
const STAR_LABELS = ["Terrible", "Bad", "Okay", "Good", "Excellent"];

/** Read-only stars, announced to screen readers as "Rated N out of 5". */
export function StarRatingDisplay({ stars, size = 16, className }: { stars: number; size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`Rated ${stars} out of ${MAX_STARS}`}
      className={cn("inline-flex items-center gap-0.5", className)}
      data-testid="order-rating-stars"
    >
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={1.75}
          aria-hidden="true"
          className={i < stars ? "fill-amber-400 text-amber-400" : "fill-transparent text-zinc-300"}
        />
      ))}
    </span>
  );
}

/**
 * Star picker built on native radio inputs: arrow keys, touch and screen
 * readers work without extra code. The inputs are visually hidden; the
 * labels draw the stars.
 */
function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (stars: number) => void;
  disabled?: boolean;
}) {
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="sr-only">Your rating</legend>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: MAX_STARS }, (_, i) => {
          const stars = i + 1;
          const id = `${name}-${stars}`;
          return (
            <span key={stars}>
              <input
                type="radio"
                id={id}
                name={name}
                value={stars}
                checked={value === stars}
                onChange={() => onChange(stars)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                onMouseEnter={() => setHover(stars)}
                className={cn(
                  "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full",
                  "transition-transform duration-150 hover:scale-110 active:scale-95",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-900 peer-focus-visible:ring-offset-2",
                  "peer-disabled:cursor-not-allowed",
                )}
              >
                <Star
                  size={30}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={stars <= shown ? "fill-amber-400 text-amber-400" : "fill-transparent text-zinc-300"}
                />
                <span className="sr-only">
                  {stars} {stars === 1 ? "star" : "stars"}, {STAR_LABELS[i]}
                </span>
              </label>
            </span>
          );
        })}
      </div>
      <p className="mt-1 h-5 text-sm font-medium text-zinc-600" aria-hidden="true">
        {shown ? STAR_LABELS[shown - 1] : ""}
      </p>
    </fieldset>
  );
}

export function RateOrderDialog({
  orderNumber,
  open,
  onOpenChange,
}: {
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const commentId = useId();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  const rate = useMutation({
    mutationFn: () =>
      foodmeApi.rateOrder(orderNumber, {
        stars,
        comment: comment.trim() ? comment.trim() : undefined,
      }),
    onSuccess: (updated: FullOrderDto) => {
      queryClient.setQueryData(["order", orderNumber], updated);
      // Swap the button for stars right away instead of waiting for the refetch.
      queryClient.setQueriesData<OrderListResponseDto>({ queryKey: ["my-orders"] }, (old) =>
        old && {
          ...old,
          list: old.list.map((o) => (o.number === updated.number ? updated : o)),
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      // The chef's storefront rating was just recalculated.
      void queryClient.invalidateQueries({ queryKey: ["chef"] });
      void queryClient.invalidateQueries({ queryKey: ["chefs"] });
      onOpenChange(false);
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (rate.isPending) return;
    if (!next) {
      setStars(0);
      setComment("");
      rate.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md overflow-y-auto p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (stars > 0) rate.mutate();
          }}
        >
          <DialogTitle className="font-display pr-8 text-lg font-bold text-zinc-900">
            Rate order {orderNumber}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-relaxed text-zinc-500">
            How was your food? Your rating helps other customers choose a chef.
          </DialogDescription>

          <div className="mt-5">
            <StarRatingInput value={stars} onChange={setStars} disabled={rate.isPending} />
          </div>

          <label htmlFor={commentId} className="mt-4 block text-sm font-semibold text-zinc-800">
            Comment <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <textarea
            id={commentId}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={MAX_COMMENT}
            rows={4}
            disabled={rate.isPending}
            placeholder="Tell us about your order"
            className={cn(
              "mt-1.5 w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900",
              "placeholder:text-zinc-400 hover:border-zinc-300",
              "focus-visible:outline-none focus-visible:border-zinc-400 focus-visible:ring-4 focus-visible:ring-zinc-100",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          <p className="mt-1 text-right text-xs tabular-nums text-zinc-400" aria-live="polite">
            {comment.length}/{MAX_COMMENT}
          </p>

          {rate.isError && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {rate.error.message || "Couldn’t save your rating. Please try again."}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={rate.isPending}
              onClick={() => handleOpenChange(false)}
            >
              Not now
            </Button>
            <Button type="submit" className="rounded-full" disabled={stars === 0 || rate.isPending}>
              {rate.isPending ? "Submitting…" : "Submit rating"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
