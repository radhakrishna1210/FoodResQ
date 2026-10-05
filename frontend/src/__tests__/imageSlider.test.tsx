import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardBanner } from '@/components/layout/DashboardBanner';
import { ImageSlider } from '@/components/media/ImageSlider';
import { SLIDES } from '@/lib/media';

describe('ImageSlider', () => {
  it('shows the first slide caption and moves with the dots and arrows', () => {
    render(<ImageSlider slides={SLIDES} />);
    expect(screen.getByText(SLIDES[0]!.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: new RegExp(SLIDES[2]!.title) }));
    expect(screen.getByText(SLIDES[2]!.title, { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
    expect(screen.getByText(SLIDES[1]!.title, { selector: 'p' })).toBeInTheDocument();
  });

  it('exposes only the active photo to assistive tech', () => {
    render(<ImageSlider slides={SLIDES} />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });
});

describe('DashboardBanner', () => {
  it('renders the greeting and actions over the photos', () => {
    render(
      <DashboardBanner
        eyebrow="Donor dashboard"
        title="Green Kitchen"
        subtitle="Track your rescues"
        actions={<button>Post surplus food</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Green Kitchen' })).toBeInTheDocument();
    expect(screen.getByText('Track your rescues')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post surplus food' })).toBeInTheDocument();
  });
});
