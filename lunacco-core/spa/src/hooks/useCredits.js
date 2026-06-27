/**
 * useCredits — derived hook over UserContext that exposes credit-specific helpers.
 *
 * Provides:
 *   balance, membershipBalance, purchasedBalance
 *   hasCredits(cost) — true if balance >= cost
 *   isSubscriber, hasFreeDaily
 */
import { useUser } from '../contexts/UserContext.jsx';

export function useCredits() {
  const { userContext } = useUser();

  const balance = userContext.balance || 0;
  const membershipBalance = userContext.membership_balance || 0;
  const purchasedBalance = userContext.purchased_balance || 0;
  const isSubscriber = !!userContext.is_subscriber;
  const hasFreeDaily = !!userContext.has_free_daily;

  const hasCredits = ( cost ) => balance >= cost;

  return { balance, membershipBalance, purchasedBalance, hasCredits, isSubscriber, hasFreeDaily };
}
