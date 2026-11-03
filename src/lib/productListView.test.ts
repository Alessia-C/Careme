import { describe, expect, it } from 'vitest';
import {
  getProductListAnnouncement,
  getProductListView,
} from './productListView';

const state = {
  isPending: false,
  hasListError: false,
  total: 0,
  isFirstSearch: true,
};

describe('getProductListView', () => {
  it('is loading while the first load is pending', () => {
    expect(getProductListView({ ...state, isPending: true })).toBe('loading');
  });

  it('is error when the whole list failed', () => {
    expect(getProductListView({ ...state, hasListError: true })).toBe('error');
  });

  it('is list when there are products', () => {
    expect(getProductListView({ ...state, total: 3 })).toBe('list');
  });

  it('is first access when an empty list answers no search', () => {
    expect(getProductListView(state)).toBe('first-access');
  });

  it('is no results when an empty list answers a search', () => {
    expect(getProductListView({ ...state, isFirstSearch: false })).toBe(
      'no-results',
    );
  });
});

describe('getProductListAnnouncement', () => {
  const announcement = {
    view: 'list' as const,
    shown: 12,
    total: 30,
    isPlaceholderData: false,
  };

  it('announces the loading of a new search', () => {
    expect(
      getProductListAnnouncement({ ...announcement, isPlaceholderData: true }),
    ).toBe('Loading products…');
  });

  it('announces how many products are shown', () => {
    expect(getProductListAnnouncement(announcement)).toBe(
      'Showing 12 of 30 products',
    );
  });

  it('announces a search with no matches', () => {
    expect(
      getProductListAnnouncement({ ...announcement, view: 'no-results' }),
    ).toBe('No product found');
  });

  it('announces nothing for the other states', () => {
    expect(
      getProductListAnnouncement({ ...announcement, view: 'first-access' }),
    ).toBe('');
  });
});
