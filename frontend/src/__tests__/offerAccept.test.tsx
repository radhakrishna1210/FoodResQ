import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeQueryClient } from '@/lib/queryClient';
import { ToastProvider } from '@/components/ui/Toast';
import { OfferCard } from '@/components/offer/OfferCard';
import type { Offer } from '@/types';

const now = Date.now();
const offer: Offer = {
  id: 'offer-a',
  donation_id: 'don-1',
  receiver_id: 'rcv-a',
  match_run_id: 'run-1',
  rank: 1,
  match_score: 91,
  factor_scores: {
    distance: 0.81,
    capacity: 1,
    feasibility: 0.82,
    demand: 1,
    reliability: 0.9,
    diet: 1,
    availability: 1,
  },
  reasons: [
    'Very close: 1.9 km (about 21 min)',
    'Can take all 120 servings',
    'Arrives well before the deadline',
  ],
  distance_km: 1.9,
  eta_minutes: 21,
  offered_servings: 120,
  status: 'PENDING',
  offered_at: new Date(now - 60_000).toISOString(),
  expires_at: new Date(now + 6 * 60_000).toISOString(),
  responded_at: null,
  decline_reason: null,
  receiver_org_name: 'Receiver A (Demo NGO)',
  allocation_id: null,
  donation: {
    id: 'don-1',
    title: 'Veg pulao and dal (120 meals)',
    food_category: 'cooked_meal',
    diet_type: 'veg',
    priority_level: 'HIGH',
    donor_org_name: 'College A (Demo)',
    pickup_lat: 18.4636,
    pickup_lng: 73.8682,
    effective_deadline: new Date(now + 116 * 60_000).toISOString(),
  },
};

function renderCard() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter
          initialEntries={['/receiver']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/receiver" element={<OfferCard offer={offer} />} />
            <Route path="/receiver/pickups/:allocationId" element={<p>Pickup page alloc-1</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('offer accept flow (mocked API)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the large score, reasons and response countdown', () => {
    renderCard();
    expect(screen.getByTestId('match-score')).toHaveTextContent('91%');
    expect(screen.getByText('Very close: 1.9 km (about 21 min)')).toBeInTheDocument();
    expect(screen.getByText('Can take all 120 servings')).toBeInTheDocument();
    expect(screen.getByText(/Respond in \d+ min/)).toBeInTheDocument();
  });

  it('POSTs /offers/{id}/accept and navigates to the pickup page', async () => {
    fetchMock.mockResolvedValue(
      json(200, { id: 'alloc-1', offer_id: 'offer-a', status: 'ACCEPTED' }),
    );
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() => expect(screen.getByText('Pickup page alloc-1')).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/offers\/offer-a\/accept$/);
    expect(init.method).toBe('POST');
  });

  it('shows the API error message on 409 (double acceptance)', async () => {
    fetchMock.mockResolvedValue(
      json(409, {
        error: {
          code: 'OFFER_NOT_AVAILABLE',
          message: 'Another Receiver has already taken this food.',
          details: {},
        },
      }),
    );
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(
      await screen.findByText('Another Receiver has already taken this food.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('OFFER_NOT_AVAILABLE')).not.toBeInTheDocument();
  });
});
